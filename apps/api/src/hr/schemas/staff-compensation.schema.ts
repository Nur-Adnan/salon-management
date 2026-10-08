import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class CommissionTierEmbed {
  @Prop({ type: Number, required: true })
  upToMinor!: number;

  @Prop({ type: Number, required: true })
  rateBps!: number;
}
export const CommissionTierEmbedSchema = SchemaFactory.createForClass(CommissionTierEmbed);

@Schema({ _id: false })
export class ServiceCommissionOverrideEmbed {
  @Prop({ type: Types.ObjectId, required: true })
  serviceId!: Types.ObjectId;

  @Prop({ type: Number, default: null })
  rateBps!: number | null;

  @Prop({ type: Number, default: null })
  fixedAmountMinor!: number | null;
}
export const ServiceCommissionOverrideEmbedSchema = SchemaFactory.createForClass(
  ServiceCommissionOverrideEmbed,
);

// One profile per (tenant, user) — deliberately NOT a field on Membership,
// because a user can hold multiple Membership rows in the same tenant (one
// per branch); compensation needs single-row-per-user cardinality, so it's a
// small dedicated collection instead of an ambiguous "which row wins" field.
// All rates default to 0 = "not configured yet", so a staff member with no
// profile simply earns nothing rather than erroring anywhere that reads it.
@Schema({ timestamps: true, collection: 'staff_compensation' })
export class StaffCompensation {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  userId!: Types.ObjectId;

  // Default basis points of a sale line's net (post-discount, pre-tax) revenue.
  @Prop({ type: Number, required: true, default: 0 })
  commissionRateBps!: number;

  // Tiered commission brackets
  @Prop({ type: [CommissionTierEmbedSchema], default: [] })
  commissionTiers!: CommissionTierEmbed[];

  // Service-specific commission overrides (fixed or percentage)
  @Prop({ type: [ServiceCommissionOverrideEmbedSchema], default: [] })
  serviceOverrides!: ServiceCommissionOverrideEmbed[];

  // Added in full each payroll run — no proration for partial periods.
  @Prop({ type: Number, required: true, default: 0 })
  baseSalaryMinor!: number;

  @Prop({ type: Number, required: true, default: 0 })
  hourlyRateMinor!: number;

  @Prop({ type: Number, default: 8 })
  dailyOvertimeThresholdHours!: number;

  @Prop({ type: Types.ObjectId, default: null })
  updatedByUserId!: Types.ObjectId | null;

  @Prop({ type: String, trim: true, default: null })
  note!: string | null;
}

export type StaffCompensationDocument = HydratedDocument<StaffCompensation>;
export const StaffCompensationSchema = SchemaFactory.createForClass(StaffCompensation);
StaffCompensationSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
