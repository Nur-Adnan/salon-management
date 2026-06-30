import { BadRequestException, Injectable } from '@nestjs/common';
import {
  type Money,
  type PackageItemKind,
  componentsTotal,
  money,
  packageSavings,
} from '@salon/shared';
import type { PackageDocument } from './schemas/package.schema.js';
import type { ProductDocument } from './schemas/product.schema.js';
import type { ServiceDocument } from './schemas/service.schema.js';
import { ProductRepository, ServiceRepository } from './repositories.js';

export interface PackagePricing {
  componentTotal: Money;
  savings: Money;
}

interface ItemRef {
  kind: PackageItemKind;
  refId: string;
  quantity: number;
}

@Injectable()
export class PackagesService {
  constructor(
    private readonly services: ServiceRepository,
    private readonly products: ProductRepository,
  ) {}

  // Validate that every referenced service/product exists in THIS tenant's catalog
  // (the repos are tenant-scoped, so cross-tenant refs simply won't be found).
  async assertItemsExist(items: ItemRef[]): Promise<void> {
    const serviceIds = unique(items.filter((i) => i.kind === 'service').map((i) => i.refId));
    const productIds = unique(items.filter((i) => i.kind === 'product').map((i) => i.refId));
    const [svcs, prods] = await this.resolve(serviceIds, productIds);
    if (svcs.length !== serviceIds.length || prods.length !== productIds.length) {
      throw new BadRequestException('package references an unknown service or product');
    }
  }

  // Resolve component unit prices and compute the package's component total + savings.
  async pricing(pkg: PackageDocument): Promise<PackagePricing> {
    const serviceIds = unique(
      pkg.items.filter((i) => i.kind === 'service').map((i) => String(i.refId)),
    );
    const productIds = unique(
      pkg.items.filter((i) => i.kind === 'product').map((i) => String(i.refId)),
    );
    const [svcs, prods] = await this.resolve(serviceIds, productIds);

    const priceOf = new Map<string, Money>();
    for (const s of svcs) priceOf.set(String(s._id), money(s.price.amount));
    for (const p of prods) priceOf.set(String(p._id), money(p.retailPrice.amount));

    const components = pkg.items.flatMap((i) => {
      const price = priceOf.get(String(i.refId));
      return price ? [{ price, quantity: i.quantity }] : [];
    });
    const total = componentsTotal(components);
    return { componentTotal: total, savings: packageSavings(total, money(pkg.price.amount)) };
  }

  private resolve(
    serviceIds: string[],
    productIds: string[],
  ): Promise<[ServiceDocument[], ProductDocument[]]> {
    return Promise.all([
      serviceIds.length
        ? this.services.find({ _id: { $in: serviceIds } })
        : Promise.resolve([] as ServiceDocument[]),
      productIds.length
        ? this.products.find({ _id: { $in: productIds } })
        : Promise.resolve([] as ProductDocument[]),
    ]);
  }
}

function unique(xs: string[]): string[] {
  return [...new Set(xs)];
}
