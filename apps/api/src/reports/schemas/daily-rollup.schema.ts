import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ _id: false })
export class RollupRevenue {
  @Prop({ type: Number, default: 0 })
  gross!: number;

  @Prop({ type: Number, default: 0 })
  discounts!: number;

  @Prop({ type: Number, default: 0 })
  net!: number;

  @Prop({ type: Number, default: 0 })
  tax!: number;

  @Prop({ type: Number, default: 0 })
  tips!: number;

  @Prop({ type: Number, default: 0 })
  salesCount!: number;

  @Prop({ type: Number, default: 0 })
  averageOrderValue!: number;
}
const RollupRevenueSchema = SchemaFactory.createForClass(RollupRevenue);

@Schema({ _id: false })
export class RollupAppointments {
  @Prop({ type: Number, default: 0 })
  total!: number;

  @Prop({ type: Number, default: 0 })
  completed!: number;

  @Prop({ type: Number, default: 0 })
  cancelled!: number;

  @Prop({ type: Number, default: 0 })
  noShows!: number;
}
const RollupAppointmentsSchema = SchemaFactory.createForClass(RollupAppointments);

@Schema({ _id: false })
export class RollupCustomers {
  @Prop({ type: Number, default: 0 })
  newCustomers!: number;

  @Prop({ type: Number, default: 0 })
  returningCustomers!: number;

  @Prop({ type: Number, default: 0 })
  retentionRate!: number;
}
const RollupCustomersSchema = SchemaFactory.createForClass(RollupCustomers);

@Schema({ timestamps: true, collection: 'daily_rollups' })
export class DailyRollup {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  // null branchId indicates organization-level rollup aggregating across all branches
  @Prop({ type: Types.ObjectId, default: null, index: true })
  branchId!: Types.ObjectId | null;

  @Prop({ type: String, required: true, index: true })
  date!: string; // YYYY-MM-DD

  @Prop({ type: RollupRevenueSchema, default: () => ({}) })
  revenue!: RollupRevenue;

  @Prop({ type: RollupAppointmentsSchema, default: () => ({}) })
  appointments!: RollupAppointments;

  @Prop({ type: RollupCustomersSchema, default: () => ({}) })
  customers!: RollupCustomers;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  servicePerformance!: Array<{ serviceId: string; name: string; count: number; revenue: number }>;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  staffPerformance!: Array<{ staffId: string; salesCount: number; netRevenue: number; commission: number }>;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  inventoryMetrics!: { totalCostValue: number; lowStockCount: number };
}

export type DailyRollupDocument = HydratedDocument<DailyRollup>;
export const DailyRollupSchema = SchemaFactory.createForClass(DailyRollup);

DailyRollupSchema.index({ tenantId: 1, branchId: 1, date: 1 }, { unique: true });
DailyRollupSchema.index({ tenantId: 1, date: -1 });
