import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { dueBalance, money } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { CustomerRepository } from '../customers/customer.repository.js';
import type { CustomerDocument } from '../customers/customer.schema.js';
import { serializeAppointment } from '../scheduling/mappers.js';
import { Appointment, type AppointmentDocument } from '../scheduling/schemas/appointment.schema.js';
import { serializeSale } from '../pos/mappers.js';
import { Sale, type SaleDocument } from '../pos/schemas/sale.schema.js';
import { GiftCard, type GiftCardDocument } from './schemas/gift-card.schema.js';
import { LoyaltyAccount, type LoyaltyAccountDocument } from './schemas/loyalty-account.schema.js';
import { serializeCustomer } from '../customers/customers.controller.js';
import {
  serializeCustomerSubscription,
  serializeGiftCard,
  serializeReferral,
  serializeTreatmentRecord,
} from './mappers.js';
import { Referral, type ReferralDocument } from './schemas/referral.schema.js';
import { TreatmentRecord, type TreatmentRecordDocument } from './schemas/treatment-record.schema.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Injectable()
export class CustomerProfileService {
  constructor(
    @InjectModel(Appointment.name) private readonly appts: Model<AppointmentDocument>,
    @InjectModel(Sale.name) private readonly sales: Model<SaleDocument>,
    @InjectModel(TreatmentRecord.name) private readonly treatments: Model<TreatmentRecordDocument>,
    @InjectModel(LoyaltyAccount.name) private readonly loyaltyAccounts: Model<LoyaltyAccountDocument>,
    @InjectModel(GiftCard.name) private readonly giftCards: Model<GiftCardDocument>,
    @InjectModel(Referral.name) private readonly referrals: Model<ReferralDocument>,
    private readonly customers: CustomerRepository,
    private readonly subscriptions: SubscriptionsService,
    private readonly ctx: RequestContextService,
  ) {}

  private tenantId(): Types.ObjectId {
    const t = this.ctx.get()?.tenantId;
    if (!t) throw new ForbiddenException('no active tenant');
    return new Types.ObjectId(t);
  }

  async profile(customerId: string) {
    const tenantId = this.tenantId();
    const custObjId = new Types.ObjectId(customerId);
    const customer: CustomerDocument | null = await this.customers.findById(customerId);
    if (!customer) throw new NotFoundException('customer not found');

    const [appointments, sales, treatments, loyalty, giftCards, subs, referral] = await Promise.all([
      this.appts.find({ tenantId, customerId: custObjId, deletedAt: null }).sort({ 'lines.start': -1 }).limit(100).exec(),
      this.sales.find({ tenantId, customerId: custObjId, deletedAt: null }).sort({ createdAt: -1 }).limit(100).exec(),
      this.treatments.find({ tenantId, customerId: custObjId, deletedAt: null }).sort({ createdAt: -1 }).exec(),
      this.loyaltyAccounts.findOne({ tenantId, customerId: custObjId }).exec(),
      this.giftCards.find({ tenantId, issuedToCustomerId: custObjId }).exec(),
      this.subscriptions.listForCustomer(customerId),
      this.referrals.find({ tenantId, referrerCustomerId: custObjId }).exec(),
    ]);

    const due = dueBalance(
      sales.map((s) => ({
        total: money(s.total.amount),
        capturedTotal: money(
          s.payments.filter((p) => p.status === 'captured').reduce((n, p) => n + p.amount.amount, 0),
        ),
        voided: s.status === 'voided',
      })),
    );

    return {
      customer: serializeCustomer(customer),
      dueBalance: due.amount,
      loyaltyBalance: loyalty?.balance ?? 0,
      appointments: appointments.map(serializeAppointment),
      sales: sales.map(serializeSale),
      treatments: treatments.map(serializeTreatmentRecord),
      giftCards: giftCards.map(serializeGiftCard),
      subscriptions: subs.map(({ doc, billingState }) => ({
        ...serializeCustomerSubscription(doc),
        billingState,
      })),
      referralsMade: referral.map(serializeReferral),
    };
  }
}
