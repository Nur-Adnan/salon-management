import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { normalizeContact, resolveLoyaltyTier } from '@salon/shared';
import type { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import { type Connection, type Model, Types } from 'mongoose';
import { CustomerSubscription, type CustomerSubscriptionDocument } from '../crm/schemas/customer-subscription.schema.js';
import { GiftCard, type GiftCardDocument } from '../crm/schemas/gift-card.schema.js';
import { LoyaltyAccount, type LoyaltyAccountDocument } from '../crm/schemas/loyalty-account.schema.js';
import { LoyaltyLedgerEntry, type LoyaltyLedgerEntryDocument } from '../crm/schemas/loyalty-ledger-entry.schema.js';
import { Organization, type OrganizationDocument } from '../iam/schemas/organization.schema.js';
import { REDIS } from '../infra/redis/redis.module.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AppointmentCancelled } from '../scheduling/events.js';
import { Appointment, type AppointmentDocument } from '../scheduling/schemas/appointment.schema.js';
import { SlotReservation, type SlotReservationDocument } from '../scheduling/schemas/slot-reservation.schema.js';
import { Customer, type CustomerDocument } from './customer.schema.js';

@Injectable()
export class ClientPortalService {
  private readonly logger = new Logger(ClientPortalService.name);

  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(Customer.name) private readonly customers: Model<CustomerDocument>,
    @InjectModel(Organization.name) private readonly orgs: Model<OrganizationDocument>,
    @InjectModel(Appointment.name) private readonly appts: Model<AppointmentDocument>,
    @InjectModel(SlotReservation.name) private readonly reservations: Model<SlotReservationDocument>,
    @InjectModel(LoyaltyAccount.name) private readonly loyaltyAccounts: Model<LoyaltyAccountDocument>,
    @InjectModel(LoyaltyLedgerEntry.name) private readonly loyaltyLedger: Model<LoyaltyLedgerEntryDocument>,
    @InjectModel(CustomerSubscription.name)
    private readonly subscriptions: Model<CustomerSubscriptionDocument>,
    @InjectModel(GiftCard.name) private readonly giftCards: Model<GiftCardDocument>,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly eventBus: EventBus,
  ) {}

  private async getOrgBySlug(slug: string): Promise<OrganizationDocument> {
    const org = await this.orgs.findOne({ slug, deletedAt: null }).exec();
    if (!org) throw new NotFoundException('Salon not found');
    return org;
  }

  async requestOtp(slug: string, phone: string): Promise<{ success: boolean; message: string }> {
    const org = await this.getOrgBySlug(slug);
    const contact = normalizeContact(phone);
    if (!contact.isValid || contact.type !== 'phone') {
      throw new BadRequestException('A valid mobile phone number is required');
    }

    // Generate 6-digit OTP code (fixed in test/dev for deterministic testing, random in prod)
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    const otp = isProd ? Math.floor(100000 + Math.random() * 900000).toString() : '123456';

    const redisKey = `otp:${org._id}:${contact.normalized}`;
    try {
      await this.redis.set(redisKey, otp, 'EX', 300); // 5 min expiry
    } catch (err: any) {
      this.logger.warn(`Redis unavailable for OTP, logging instead: ${err.message}`);
    }

    // Deliver OTP via notification queue
    try {
      await this.notifications.queueNotification({
        tenantId: org._id,
        channel: 'sms',
        recipient: contact.normalized,
        template: 'campaign_broadcast',
        data: {
          subject: `${org.name} Verification Code`,
          body: `Your ${org.name} login code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
        },
        idempotencyKey: `otp:${org._id}:${contact.normalized}:${Date.now()}`,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to enqueue OTP SMS: ${err.message}`);
    }

    return { success: true, message: `Verification code sent to ${contact.normalized}` };
  }

  async verifyOtp(
    slug: string,
    phone: string,
    code: string,
  ): Promise<{ token: string; customer: { id: string; name: string; phone: string } }> {
    const org = await this.getOrgBySlug(slug);
    const contact = normalizeContact(phone);
    if (!contact.isValid || contact.type !== 'phone') {
      throw new BadRequestException('Invalid phone number');
    }

    const redisKey = `otp:${org._id}:${contact.normalized}`;
    let storedOtp: string | null = null;
    try {
      storedOtp = await this.redis.get(redisKey);
    } catch {
      // Redis fallback for dev
    }

    const isDev = this.config.get<string>('NODE_ENV') !== 'production';
    const isValid = storedOtp === code || (isDev && code === '123456');

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    // Clean up used OTP
    try {
      await this.redis.del(redisKey);
    } catch {}

    // Find or create customer in tenant
    let customer = await this.customers
      .findOne({ tenantId: org._id, phone: contact.normalized, deletedAt: null })
      .exec();

    if (!customer) {
      customer = await this.customers.create({
        tenantId: org._id,
        phone: contact.normalized,
        name: 'Guest Customer',
        locale: 'en',
      });
    }

    const secret = this.config.get<string>('SUPABASE_JWT_SECRET') ?? 'dev-secret';
    const token = jwt.sign(
      {
        sub: String(customer._id),
        customerId: String(customer._id),
        tenantId: String(org._id),
        role: 'client',
        phone: customer.phone,
        name: customer.name,
      },
      secret,
      { expiresIn: '30d' },
    );

    return {
      token,
      customer: {
        id: String(customer._id),
        name: customer.name,
        phone: customer.phone,
      },
    };
  }

  async getProfile(tenantIdStr: string, customerIdStr: string) {
    const tenantId = new Types.ObjectId(tenantIdStr);
    const customerId = new Types.ObjectId(customerIdStr);

    const customer = await this.customers.findOne({ _id: customerId, tenantId, deletedAt: null }).exec();
    if (!customer) throw new NotFoundException('Customer profile not found');

    const loyalty = await this.loyaltyAccounts.findOne({ tenantId, customerId }).exec();
    const activeSubsCount = await this.subscriptions.countDocuments({ tenantId, customerId, status: 'active' });
    const activeCards = await this.giftCards.find({
      tenantId,
      issuedToCustomerId: customerId,
      status: 'active',
      'balance.amount': { $gt: 0 },
    }).exec();

    const points = loyalty?.balance ?? 0;
    const tier = resolveLoyaltyTier(points);

    return {
      id: String(customer._id),
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      marketingOptOut: customer.marketingOptOut,
      loyalty: {
        points,
        tier,
      },
      activeSubscriptionsCount: activeSubsCount,
      activeGiftCardsCount: activeCards.length,
    };
  }

  async updateProfile(
    tenantIdStr: string,
    customerIdStr: string,
    dto: { name?: string; email?: string; marketingOptOut?: boolean },
  ) {
    const tenantId = new Types.ObjectId(tenantIdStr);
    const customerId = new Types.ObjectId(customerIdStr);

    const update: Record<string, unknown> = {};
    if (dto.name !== undefined) update.name = dto.name.trim();
    if (dto.email !== undefined) update.email = dto.email ? dto.email.trim().toLowerCase() : null;
    if (dto.marketingOptOut !== undefined) {
      update.marketingOptOut = dto.marketingOptOut;
      if (dto.marketingOptOut) update.optOutAt = new Date();
    }

    const updated = await this.customers
      .findOneAndUpdate({ _id: customerId, tenantId, deletedAt: null }, { $set: update }, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('Customer not found');
    return updated;
  }

  async getAppointments(tenantIdStr: string, customerIdStr: string) {
    const tenantId = new Types.ObjectId(tenantIdStr);
    const customerId = new Types.ObjectId(customerIdStr);

    const all = await this.appts
      .find({ tenantId, customerId, deletedAt: null })
      .sort({ 'lines.start': -1 })
      .limit(100)
      .exec();

    const now = new Date();
    const upcoming: AppointmentDocument[] = [];
    const past: AppointmentDocument[] = [];

    for (const a of all) {
      const firstLine = a.lines[0];
      if (firstLine && firstLine.start >= now && (a.status === 'booked' || a.status === 'confirmed')) {
        upcoming.push(a);
      } else {
        past.push(a);
      }
    }

    return { upcoming, past };
  }

  async cancelAppointment(tenantIdStr: string, customerIdStr: string, appointmentIdStr: string) {
    const tenantId = new Types.ObjectId(tenantIdStr);
    const customerId = new Types.ObjectId(customerIdStr);
    const _id = new Types.ObjectId(appointmentIdStr);

    // IDOR Protection: must match both tenantId AND customerId
    const appt = await this.appts.findOne({ _id, tenantId, customerId, deletedAt: null }).exec();
    if (!appt) throw new NotFoundException('Appointment not found');

    if (appt.status === 'cancelled' || appt.status === 'completed') {
      throw new BadRequestException(`Appointment is already ${appt.status}`);
    }

    // Cancellation window rule: cannot cancel within 2 hours of appointment start
    const firstLine = appt.lines[0];
    if (firstLine) {
      const msUntilStart = firstLine.start.getTime() - Date.now();
      const twoHoursMs = 2 * 60 * 60 * 1000;
      if (msUntilStart < twoHoursMs) {
        throw new BadRequestException(
          'Appointments cannot be cancelled within 2 hours of the scheduled time. Please contact the salon directly.',
        );
      }
    }

    const session = await this.conn.startSession();
    try {
      await session.withTransaction(async () => {
        await this.appts.updateOne({ _id, tenantId }, { $set: { status: 'cancelled' } }, { session });
        await this.reservations.deleteMany({ tenantId, appointmentId: _id }, { session });
      });
    } finally {
      await session.endSession();
    }

    this.eventBus.publish(
      new AppointmentCancelled(String(tenantId), String(appt.branchId), String(_id), 'cancelled'),
    );

    return { success: true, message: 'Appointment cancelled successfully' };
  }

  async getLoyalty(tenantIdStr: string, customerIdStr: string) {
    const tenantId = new Types.ObjectId(tenantIdStr);
    const customerId = new Types.ObjectId(customerIdStr);

    const account = await this.loyaltyAccounts.findOne({ tenantId, customerId }).exec();
    const history = await this.loyaltyLedger
      .find({ tenantId, customerId })
      .sort({ createdAt: -1 })
      .limit(30)
      .exec();

    const points = account?.balance ?? 0;
    return {
      points,
      tier: resolveLoyaltyTier(points),
      history,
    };
  }

  async getSubscriptions(tenantIdStr: string, customerIdStr: string) {
    const tenantId = new Types.ObjectId(tenantIdStr);
    const customerId = new Types.ObjectId(customerIdStr);

    return this.subscriptions.find({ tenantId, customerId }).sort({ createdAt: -1 }).exec();
  }

  async getGiftCards(tenantIdStr: string, customerIdStr: string) {
    const tenantId = new Types.ObjectId(tenantIdStr);
    const customerId = new Types.ObjectId(customerIdStr);

    return this.giftCards
      .find({ tenantId, issuedToCustomerId: customerId })
      .sort({ createdAt: -1 })
      .exec();
  }
}
