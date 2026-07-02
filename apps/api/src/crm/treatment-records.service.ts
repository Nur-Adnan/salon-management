import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  AddTreatmentPhoto,
  CreateTreatmentRecord,
  TreatmentPhotoConsentAction,
} from '@salon/shared';
import { canTransitionConsent } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { TreatmentRecord, type TreatmentRecordDocument } from './schemas/treatment-record.schema.js';

@Injectable()
export class TreatmentRecordsService {
  constructor(
    @InjectModel(TreatmentRecord.name) private readonly records: Model<TreatmentRecordDocument>,
    private readonly ctx: RequestContextService,
  ) {}

  private tenantId(): Types.ObjectId {
    const t = this.ctx.get()?.tenantId;
    if (!t) throw new ForbiddenException('no active tenant');
    return new Types.ObjectId(t);
  }
  private userId(): Types.ObjectId | null {
    const u = this.ctx.get()?.userId;
    return u ? new Types.ObjectId(u) : null;
  }

  forCustomer(customerId: string): Promise<TreatmentRecordDocument[]> {
    return this.records
      .find({ tenantId: this.tenantId(), customerId: new Types.ObjectId(customerId), deletedAt: null })
      .sort({ createdAt: -1 })
      .exec();
  }

  async get(id: string): Promise<TreatmentRecordDocument> {
    const r = await this.records
      .findOne({ _id: new Types.ObjectId(id), tenantId: this.tenantId(), deletedAt: null })
      .exec();
    if (!r) throw new NotFoundException('treatment record not found');
    return r;
  }

  create(dto: CreateTreatmentRecord): Promise<TreatmentRecordDocument> {
    return this.records.create({
      tenantId: this.tenantId(),
      customerId: new Types.ObjectId(dto.customerId),
      appointmentId: dto.appointmentId ? new Types.ObjectId(dto.appointmentId) : null,
      staffId: dto.staffId ? new Types.ObjectId(dto.staffId) : null,
      colorFormula: dto.colorFormula ?? null,
      notes: dto.notes ?? null,
      allergies: dto.allergies,
    } as never);
  }

  // A photo is always created 'pending' — addTreatmentPhotoSchema has no consent
  // field, so the API structurally cannot create an already-granted photo.
  async addPhoto(id: string, dto: AddTreatmentPhoto): Promise<TreatmentRecordDocument> {
    const record = await this.get(id);
    record.photos.push({
      url: dto.url,
      type: dto.type,
      capturedBy: this.userId() ?? new Types.ObjectId(),
      consent: { status: 'pending', scope: [] },
    } as never);
    await record.save();
    return record;
  }

  // The one endpoint that may ever change a photo's consent — validated as a
  // state-machine transition (canTransitionConsent), never a free-form PATCH.
  async setPhotoConsent(
    id: string,
    photoId: string,
    dto: TreatmentPhotoConsentAction,
  ): Promise<TreatmentRecordDocument> {
    const record = await this.get(id);
    const photo = record.photos.find((p) => String(p._id) === photoId);
    if (!photo) throw new NotFoundException('photo not found');

    const to = dto.action === 'grant' ? 'granted' : dto.action === 'decline' ? 'declined' : 'revoked';
    if (!canTransitionConsent(photo.consent.status, to)) {
      throw new BadRequestException(`cannot ${dto.action} consent from '${photo.consent.status}'`);
    }

    const actorId = this.userId();
    if (to === 'granted') {
      photo.consent.scope = dto.scope ?? [];
      photo.consent.method = dto.method ?? null;
      photo.consent.recordedBy = actorId;
      photo.consent.grantedAt = new Date();
      // Revoking never erases the original grant's audit trail; re-granting
      // after a decline starts that trail fresh (there was nothing to preserve).
      photo.consent.revokedAt = null;
      photo.consent.revokedBy = null;
    } else if (to === 'declined') {
      photo.consent.recordedBy = actorId;
    } else {
      photo.consent.revokedAt = new Date();
      photo.consent.revokedBy = actorId;
    }
    photo.consent.status = to;
    await record.save();
    return record;
  }

  async removePhoto(id: string, photoId: string): Promise<TreatmentRecordDocument> {
    const record = await this.get(id);
    const photo = record.photos.find((p) => String(p._id) === photoId);
    if (!photo) throw new NotFoundException('photo not found');
    photo.deletedAt = new Date();
    await record.save();
    return record;
  }
}
