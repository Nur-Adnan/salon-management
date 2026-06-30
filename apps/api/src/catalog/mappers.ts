import { serializeMoney, serializeName } from '../common/embeds.js';
import type { PackagePricing } from './packages.service.js';
import type { PackageDocument } from './schemas/package.schema.js';
import type { ProductCategoryDocument } from './schemas/product-category.schema.js';
import type { ProductDocument } from './schemas/product.schema.js';
import type { ServiceCategoryDocument } from './schemas/service-category.schema.js';
import type { ServiceDocument } from './schemas/service.schema.js';

export const serializeServiceCategory = (c: ServiceCategoryDocument) => ({
  id: String(c._id),
  name: serializeName(c.name),
  sortOrder: c.sortOrder,
});

export const serializeService = (s: ServiceDocument) => ({
  id: String(s._id),
  categoryId: s.categoryId ? String(s.categoryId) : null,
  name: serializeName(s.name),
  durationMin: s.durationMin,
  bufferBeforeMin: s.bufferBeforeMin,
  bufferAfterMin: s.bufferAfterMin,
  price: serializeMoney(s.price),
  taxable: s.taxable,
  eligibleResourceTypes: s.eligibleResourceTypes,
  active: s.active,
});

export const serializeProductCategory = (c: ProductCategoryDocument) => ({
  id: String(c._id),
  name: serializeName(c.name),
});

export const serializeProduct = (p: ProductDocument) => ({
  id: String(p._id),
  categoryId: p.categoryId ? String(p.categoryId) : null,
  name: serializeName(p.name),
  sku: p.sku,
  barcode: p.barcode ?? null,
  retailPrice: serializeMoney(p.retailPrice),
  cost: serializeMoney(p.cost),
  taxable: p.taxable,
  expiryTracked: p.expiryTracked,
  active: p.active,
});

export const serializePackage = (p: PackageDocument, pricing?: PackagePricing) => ({
  id: String(p._id),
  name: serializeName(p.name),
  items: p.items.map((i) => ({ kind: i.kind, refId: String(i.refId), quantity: i.quantity })),
  price: serializeMoney(p.price),
  validityDays: p.validityDays,
  active: p.active,
  componentTotal: pricing ? { ...pricing.componentTotal } : null,
  savings: pricing ? { ...pricing.savings } : null,
});
