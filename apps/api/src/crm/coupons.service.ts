import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { CreateCoupon, UpdateCoupon } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { isDuplicateKeyError } from '../common/mongo.util.js';
import { Coupon, type CouponDocument } from './schemas/coupon.schema.js';

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel(Coupon.name) private readonly coupons: Model<CouponDocument>,
    private readonly ctx: RequestContextService,
  ) {}

  private tenantId(): Types.ObjectId {
    const t = this.ctx.get()?.tenantId;
    if (!t) throw new ForbiddenException('no active tenant');
    return new Types.ObjectId(t);
  }

  list(): Promise<CouponDocument[]> {
    return this.coupons.find({ tenantId: this.tenantId(), deletedAt: null }).exec();
  }

  async create(dto: CreateCoupon): Promise<CouponDocument> {
    try {
      return await this.coupons.create({
        tenantId: this.tenantId(),
        code: dto.code,
        type: dto.type,
        value: dto.value,
        maxDiscount: dto.maxDiscount ?? null,
        minSpend: dto.minSpend,
        maxRedemptions: dto.maxRedemptions ?? null,
        activeFrom: dto.activeFrom ? new Date(dto.activeFrom) : null,
        activeUntil: dto.activeUntil ? new Date(dto.activeUntil) : null,
        active: dto.active,
      } as never);
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new ConflictException('coupon code already exists in this tenant');
      throw err;
    }
  }

  async update(id: string, dto: UpdateCoupon): Promise<CouponDocument> {
    const patch: Record<string, unknown> = { ...dto };
    if (dto.activeFrom !== undefined) patch.activeFrom = new Date(dto.activeFrom);
    if (dto.activeUntil !== undefined) patch.activeUntil = new Date(dto.activeUntil);
    try {
      const c = await this.coupons
        .findOneAndUpdate(
          { _id: new Types.ObjectId(id), tenantId: this.tenantId(), deletedAt: null },
          patch,
          { new: true },
        )
        .exec();
      if (!c) throw new NotFoundException('coupon not found');
      return c;
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new ConflictException('coupon code already exists in this tenant');
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const c = await this.coupons
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), tenantId: this.tenantId(), deletedAt: null },
        { deletedAt: new Date() },
      )
      .exec();
    if (!c) throw new NotFoundException('coupon not found');
  }
}
