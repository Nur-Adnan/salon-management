import { serializeMoney, serializeName } from '../common/embeds.js';
import type { SaleDocument, SaleLine, Payment } from './schemas/sale.schema.js';
import type { StockLevelDocument } from './schemas/stock-level.schema.js';

const serializeLine = (l: SaleLine) => ({
  kind: l.kind,
  refId: String(l.refId),
  name: serializeName(l.name),
  unitPrice: serializeMoney(l.unitPrice),
  quantity: l.quantity,
  discount: serializeMoney(l.discount),
  taxable: l.taxable,
  taxRateBps: l.taxRateBps,
  tax: serializeMoney(l.tax),
  lineTotal: serializeMoney(l.lineTotal),
  staffId: l.staffId ? String(l.staffId) : null,
});

const serializePayment = (p: Payment) => ({
  method: p.method,
  amount: serializeMoney(p.amount),
  status: p.status,
  providerRef: p.providerRef ?? null,
  capturedAt: p.capturedAt ? p.capturedAt.toISOString() : null,
});

export const serializeSale = (s: SaleDocument) => ({
  id: String(s._id),
  branchId: String(s.branchId),
  customerId: s.customerId ? String(s.customerId) : null,
  appointmentId: s.appointmentId ? String(s.appointmentId) : null,
  invoiceNumber: s.invoiceNumber,
  lines: s.lines.map(serializeLine),
  subtotal: serializeMoney(s.subtotal),
  discountTotal: serializeMoney(s.discountTotal),
  taxTotal: serializeMoney(s.taxTotal),
  tip: serializeMoney(s.tip),
  total: serializeMoney(s.total),
  payments: s.payments.map(serializePayment),
  paymentStatus: s.paymentStatus,
  status: s.status,
  note: s.note ?? null,
  voidReason: s.voidReason ?? null,
  createdAt: (s as unknown as { createdAt?: Date }).createdAt?.toISOString() ?? null,
});

export const serializeStockLevel = (s: StockLevelDocument) => ({
  productId: String(s.productId),
  qtyOnHand: s.qtyOnHand,
});
