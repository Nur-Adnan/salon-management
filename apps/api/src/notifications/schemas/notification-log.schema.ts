import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUS,
  NOTIFICATION_TEMPLATES,
  type NotificationChannel,
  type NotificationStatus,
  type NotificationTemplate,
} from '@salon/shared';
import { type HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'notification_logs' })
export class NotificationLog {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  branchId!: Types.ObjectId | null;

  @Prop({ type: String, required: true, enum: [...NOTIFICATION_CHANNELS] })
  channel!: NotificationChannel;

  @Prop({ type: String, required: true, trim: true, index: true })
  recipient!: string;

  @Prop({ type: String, trim: true, default: null })
  subject!: string | null;

  @Prop({ type: String, required: true })
  body!: string;

  @Prop({ type: String, required: true, enum: [...NOTIFICATION_TEMPLATES] })
  template!: NotificationTemplate;

  @Prop({ type: String, required: true, default: 'queued', enum: [...NOTIFICATION_STATUS], index: true })
  status!: NotificationStatus;

  @Prop({ type: Number, required: true, default: 0 })
  attempts!: number;

  @Prop({ type: String, required: true, trim: true })
  idempotencyKey!: string;

  @Prop({ type: String, default: null })
  error!: string | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata!: Record<string, unknown>;
}

export type NotificationLogDocument = HydratedDocument<NotificationLog>;
export const NotificationLogSchema = SchemaFactory.createForClass(NotificationLog);

NotificationLogSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
NotificationLogSchema.index({ tenantId: 1, createdAt: -1 });
