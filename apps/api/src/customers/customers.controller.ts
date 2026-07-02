import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import {
  type CreateCustomer,
  type UpdateCustomerProfile,
  createCustomerSchema,
  objectIdSchema,
  updateCustomerProfileSchema,
} from '@salon/shared';
import { Types } from 'mongoose';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import type { CustomerDocument } from './customer.schema.js';
import { CustomerRepository } from './customer.repository.js';

export const serializeCustomer = (c: CustomerDocument) => ({
  id: String(c._id),
  name: c.name,
  phone: c.phone,
  email: c.email ?? null,
  locale: c.locale,
  preferredStaffId: c.preferredStaffId ? String(c.preferredStaffId) : null,
  preferenceNotes: c.preferenceNotes ?? null,
  allergies: c.allergies ?? [],
  referralCode: c.referralCode ?? null,
});

@Controller('customers')
export class CustomersController {
  constructor(private readonly repo: CustomerRepository) {}

  @Get()
  @CheckAbility('read', 'Customer')
  async list() {
    return (await this.repo.find()).map(serializeCustomer);
  }

  @Post()
  @CheckAbility('create', 'Customer')
  async create(@Body(new ZodValidationPipe(createCustomerSchema)) dto: CreateCustomer) {
    return serializeCustomer(await this.repo.create(dto));
  }

  @Get(':id')
  @CheckAbility('read', 'Customer')
  async get(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    const c = await this.repo.findById(id);
    if (!c) throw new NotFoundException('customer not found');
    return serializeCustomer(c);
  }

  // Preferences + allergies (Phase 5 CRM). Distinct from a per-visit TreatmentRecord.
  @Patch(':id/profile')
  @CheckAbility('update', 'Customer')
  async updateProfile(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateCustomerProfileSchema)) dto: UpdateCustomerProfile,
  ) {
    const patch: Record<string, unknown> = {};
    if (dto.preferredStaffId !== undefined) {
      patch.preferredStaffId = dto.preferredStaffId ? new Types.ObjectId(dto.preferredStaffId) : null;
    }
    if (dto.preferenceNotes !== undefined) patch.preferenceNotes = dto.preferenceNotes;
    if (dto.allergies !== undefined) patch.allergies = dto.allergies;
    const u = await this.repo.updateById(id, patch as never);
    if (!u) throw new NotFoundException('customer not found');
    return serializeCustomer(u);
  }

  // Lazily generate (or return) this customer's shareable referral code.
  @Post(':id/referral-code')
  @CheckAbility('update', 'Customer')
  async referralCode(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    return { referralCode: await this.repo.getOrCreateReferralCode(id) };
  }
}
