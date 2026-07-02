import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  PHOTO_CONSENT_METHODS,
  PHOTO_CONSENT_SCOPES,
  PHOTO_CONSENT_STATUS,
  PHOTO_TYPES,
  type PhotoConsentMethod,
  type PhotoConsentScope,
  type PhotoConsentStatus,
  type PhotoType,
} from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';

// A photo is born 'pending' and can never be created already-granted (the API's
// addTreatmentPhotoSchema has no consent field at all). Revoking never deletes
// grantedAt/method/recordedBy — the audit trail that consent WAS once given is
// preserved; only revokedAt/revokedBy are set. See canTransitionConsent (shared)
// for the legal state machine and isPhotoMarketable for the one predicate every
// "can this be used outside the chart" check must call.
@Schema({ _id: false })
export class PhotoConsent {
  @Prop({ type: String, required: true, default: 'pending', enum: [...PHOTO_CONSENT_STATUS] })
  status!: PhotoConsentStatus;

  @Prop({ type: [String], default: [], enum: [...PHOTO_CONSENT_SCOPES] })
  scope!: PhotoConsentScope[];

  @Prop({ type: String, default: null, enum: [...PHOTO_CONSENT_METHODS, null] })
  method!: PhotoConsentMethod | null;

  @Prop({ type: Types.ObjectId, default: null })
  recordedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  grantedAt!: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: Types.ObjectId, default: null })
  revokedBy!: Types.ObjectId | null;
}
const PhotoConsentSchema = SchemaFactory.createForClass(PhotoConsent);

@Schema({ _id: true, timestamps: { createdAt: 'takenAt', updatedAt: false } })
export class TreatmentPhoto {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true })
  url!: string; // no object storage integration yet — a URL string only

  @Prop({ type: String, required: true, enum: [...PHOTO_TYPES] })
  type!: PhotoType;

  @Prop({ type: Types.ObjectId, required: true })
  capturedBy!: Types.ObjectId; // staff accountable for adding it

  @Prop({ type: PhotoConsentSchema, required: true, default: () => ({ status: 'pending', scope: [] }) })
  consent!: PhotoConsent;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null; // client-requested erasure of the photo itself
}
const TreatmentPhotoSchema = SchemaFactory.createForClass(TreatmentPhoto);

@Schema({ timestamps: true, collection: 'treatment_records' })
export class TreatmentRecord {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  customerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  appointmentId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  staffId!: Types.ObjectId | null;

  @Prop({ type: String, trim: true, default: null })
  colorFormula!: string | null;

  @Prop({ type: String, trim: true, default: null })
  notes!: string | null;

  @Prop({ type: [String], default: [] })
  allergies!: string[];

  @Prop({ type: [TreatmentPhotoSchema], default: [] })
  photos!: TreatmentPhoto[];

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type TreatmentRecordDocument = HydratedDocument<TreatmentRecord>;
export const TreatmentRecordSchema = SchemaFactory.createForClass(TreatmentRecord);
TreatmentRecordSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });
