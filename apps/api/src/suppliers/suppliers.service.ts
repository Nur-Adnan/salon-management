import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { CreateSupplier, UpdateSupplier } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { isDuplicateKeyError } from '../common/mongo.util.js';
import { Supplier, type SupplierDocument } from './schemas/supplier.schema.js';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectModel(Supplier.name) private readonly suppliers: Model<SupplierDocument>,
    private readonly ctx: RequestContextService,
  ) {}

  private tenantId(): Types.ObjectId {
    const t = this.ctx.get()?.tenantId;
    if (!t) throw new ForbiddenException('no active tenant');
    return new Types.ObjectId(t);
  }

  async create(dto: CreateSupplier): Promise<SupplierDocument> {
    try {
      return await this.suppliers.create({ ...dto, tenantId: this.tenantId() } as never);
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new ConflictException('a supplier with this name already exists');
      throw err;
    }
  }

  async update(id: string, dto: UpdateSupplier): Promise<SupplierDocument> {
    try {
      const s = await this.suppliers
        .findOneAndUpdate(
          { _id: new Types.ObjectId(id), tenantId: this.tenantId(), deletedAt: null },
          { $set: dto },
          { new: true },
        )
        .exec();
      if (!s) throw new NotFoundException('supplier not found');
      return s;
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new ConflictException('a supplier with this name already exists');
      throw err;
    }
  }

  list(): Promise<SupplierDocument[]> {
    return this.suppliers.find({ tenantId: this.tenantId(), deletedAt: null }).sort({ name: 1 }).exec();
  }

  async get(id: string): Promise<SupplierDocument> {
    const s = await this.suppliers
      .findOne({ _id: new Types.ObjectId(id), tenantId: this.tenantId(), deletedAt: null })
      .exec();
    if (!s) throw new NotFoundException('supplier not found');
    return s;
  }

  async remove(id: string): Promise<{ id: string }> {
    const s = await this.suppliers
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), tenantId: this.tenantId(), deletedAt: null },
        { $set: { deletedAt: new Date() } },
        { new: true },
      )
      .exec();
    if (!s) throw new NotFoundException('supplier not found');
    return { id };
  }
}
