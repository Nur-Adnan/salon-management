import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  type AvailabilityQuery,
  type CreateAppointment,
  availabilityQuerySchema,
  createAppointmentSchema,
} from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { Service, type ServiceDocument } from '../catalog/schemas/service.schema.js';
import { RequestContextService } from '../common/context/request-context.service.js';
import { serializeName } from '../common/embeds.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { Public } from '../iam/auth/public.decorator.js';
import { Branch, type BranchDocument } from '../iam/schemas/branch.schema.js';
import { Membership, type MembershipDocument } from '../iam/schemas/membership.schema.js';
import { Organization, type OrganizationDocument } from '../iam/schemas/organization.schema.js';
import { User, type UserDocument } from '../iam/schemas/user.schema.js';
import { AvailabilityService } from './availability.service.js';
import { BookingService } from './booking.service.js';
import { serializeAppointment } from './mappers.js';

// Unauthenticated per-tenant booking surface (the public `booking` app). Tenant is
// resolved by slug; the request context is set manually (no JWT here).
@Public()
@Controller('public')
export class PublicBookingController {
  constructor(
    @InjectModel(Organization.name) private readonly orgModel: Model<OrganizationDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    @InjectModel(Service.name) private readonly serviceModel: Model<ServiceDocument>,
    @InjectModel(Membership.name) private readonly membershipModel: Model<MembershipDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly availability: AvailabilityService,
    private readonly booking: BookingService,
    private readonly ctx: RequestContextService,
  ) {}

  @Get(':slug')
  async salon(@Param('slug') slug: string) {
    const org = await this.orgModel.findOne({ slug, deletedAt: null }).exec();
    if (!org) throw new NotFoundException('salon not found');
    const branches = await this.branchModel
      .find({ tenantId: org._id, status: 'active', deletedAt: null })
      .exec();
    return {
      name: org.name,
      slug: org.slug,
      branches: branches.map((b) => ({ id: String(b._id), name: b.name, timezone: b.timezone })),
    };
  }

  @Get(':slug/:branchId/services')
  async services(@Param('slug') slug: string, @Param('branchId') branchId: string) {
    const org = await this.scopeTo(slug, branchId);
    const list = await this.serviceModel
      .find({ tenantId: org._id, active: true, deletedAt: null })
      .exec();
    return list.map((s) => ({
      id: String(s._id),
      name: serializeName(s.name),
      durationMin: s.durationMin,
      price: { amount: s.price.amount, currency: s.price.currency },
    }));
  }

  @Get(':slug/:branchId/staff')
  async staff(@Param('slug') slug: string, @Param('branchId') branchId: string) {
    const org = await this.scopeTo(slug, branchId);
    const members = await this.membershipModel
      .find({ tenantId: org._id, status: 'active', userId: { $ne: null } })
      .exec();
    const userIds = [...new Set(members.map((m) => String(m.userId)))].map((id) => new Types.ObjectId(id));
    const users = await this.userModel.find({ _id: { $in: userIds } }).exec();
    return users.map((u) => ({ id: String(u._id), name: u.profile?.name ?? u.email.split('@')[0] ?? u.email }));
  }

  @Get(':slug/:branchId/availability')
  async availabilitySlots(
    @Param('slug') slug: string,
    @Param('branchId') branchId: string,
    @Query(new ZodValidationPipe(availabilityQuerySchema)) q: AvailabilityQuery,
  ) {
    await this.scopeTo(slug, branchId);
    return { slots: await this.availability.staffAvailability(q.staffId, q.serviceId, q.date) };
  }

  @Post(':slug/:branchId/appointments')
  async book(
    @Param('slug') slug: string,
    @Param('branchId') branchId: string,
    @Body(new ZodValidationPipe(createAppointmentSchema)) dto: CreateAppointment,
  ) {
    await this.scopeTo(slug, branchId);
    return serializeAppointment(await this.booking.book({ ...dto, source: 'online' }));
  }

  private async scopeTo(slug: string, branchId: string): Promise<OrganizationDocument> {
    const org = await this.orgModel.findOne({ slug, deletedAt: null }).exec();
    if (!org) throw new NotFoundException('salon not found');
    const branch = await this.branchModel
      .findOne({ _id: new Types.ObjectId(branchId), tenantId: org._id, status: 'active', deletedAt: null })
      .exec();
    if (!branch) throw new NotFoundException('branch not found');
    this.ctx.set({ tenantId: String(org._id), branchId: String(branch._id) });
    return org;
  }
}
