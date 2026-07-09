import type { PurchaseOrderDocument } from './schemas/purchase-order.schema.js';
import type { SupplierDocument } from './schemas/supplier.schema.js';

const iso = (d: unknown): string | null =>
  d instanceof Date ? d.toISOString() : ((d as { toISOString?: () => string })?.toISOString?.() ?? null);

export const serializeSupplier = (s: SupplierDocument) => ({
  id: String(s._id),
  name: s.name,
  contact: { phone: s.contact?.phone ?? null, email: s.contact?.email ?? null },
  address: s.address ?? null,
  note: s.note ?? null,
  active: s.active,
});

export const serializePurchaseOrder = (p: PurchaseOrderDocument) => ({
  id: String(p._id),
  poNumber: p.poNumber,
  supplierId: String(p.supplierId),
  branchId: String(p.branchId),
  status: p.status,
  lines: p.lines.map((l) => ({
    productId: String(l.productId),
    quantity: l.quantity,
    unitCost: { amount: l.unitCost.amount, currency: l.unitCost.currency },
  })),
  totalCost: { amount: p.totalCost.amount, currency: p.totalCost.currency },
  note: p.note ?? null,
  receivedAt: iso(p.receivedAt),
  createdAt: iso((p as unknown as { createdAt?: Date }).createdAt),
});
