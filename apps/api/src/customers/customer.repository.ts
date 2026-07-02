import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { isDuplicateKeyError } from '../common/mongo.util.js';
import { TenantScopedRepository } from '../common/tenant-scoped.repository.js';
import { Customer, type CustomerDocument } from './customer.schema.js';

interface CustomerInput {
  name: string;
  phone: string;
  email?: string;
  locale?: string;
}

@Injectable()
export class CustomerRepository extends TenantScopedRepository<CustomerDocument> {
  constructor(@InjectModel(Customer.name) model: Model<CustomerDocument>, ctx: RequestContextService) {
    super(model, ctx);
  }

  findByPhone(phone: string): Promise<CustomerDocument | null> {
    return this.findOne({ phone });
  }

  async findOrCreate(input: CustomerInput): Promise<CustomerDocument> {
    const existing = await this.findByPhone(input.phone);
    if (existing) return existing;
    return this.create({
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      locale: input.locale ?? 'en',
    });
  }

  // Booking/waitlist accept either an existing customerId or an inline customer.
  async resolveId(ref: { customerId?: string; customer?: CustomerInput }): Promise<Types.ObjectId> {
    if (ref.customerId) {
      const c = await this.findById(ref.customerId);
      if (!c) throw new BadRequestException('unknown customer');
      return new Types.ObjectId(String(c._id));
    }
    if (!ref.customer) throw new BadRequestException('customerId or customer is required');
    const c = await this.findOrCreate(ref.customer);
    return new Types.ObjectId(String(c._id));
  }

  findByReferralCode(code: string): Promise<CustomerDocument | null> {
    return this.findOne({ referralCode: code });
  }

  // Most customers never refer anyone, so the code is generated lazily rather
  // than at creation. Retries on the (rare) random collision against the
  // {tenantId, referralCode} unique index.
  async getOrCreateReferralCode(customerId: string): Promise<string> {
    const existing = await this.findById(customerId);
    if (!existing) throw new BadRequestException('unknown customer');
    if (existing.referralCode) return existing.referralCode;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = `R-${randomBytes(4).toString('hex').toUpperCase()}`;
      try {
        const updated = await this.updateById(customerId, { referralCode: code } as never);
        if (updated?.referralCode) return updated.referralCode;
      } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;
      }
    }
    throw new Error('failed to generate a unique referral code after 5 attempts');
  }
}
