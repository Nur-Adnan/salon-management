import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { TenantScopedRepository } from '../common/tenant-scoped.repository.js';
import { Package, type PackageDocument } from './schemas/package.schema.js';
import { ProductCategory, type ProductCategoryDocument } from './schemas/product-category.schema.js';
import { Product, type ProductDocument } from './schemas/product.schema.js';
import { ServiceCategory, type ServiceCategoryDocument } from './schemas/service-category.schema.js';
import { Service, type ServiceDocument } from './schemas/service.schema.js';

@Injectable()
export class ServiceCategoryRepository extends TenantScopedRepository<ServiceCategoryDocument> {
  constructor(
    @InjectModel(ServiceCategory.name) m: Model<ServiceCategoryDocument>,
    ctx: RequestContextService,
  ) {
    super(m, ctx);
  }
}

@Injectable()
export class ServiceRepository extends TenantScopedRepository<ServiceDocument> {
  constructor(@InjectModel(Service.name) m: Model<ServiceDocument>, ctx: RequestContextService) {
    super(m, ctx);
  }
}

@Injectable()
export class ProductCategoryRepository extends TenantScopedRepository<ProductCategoryDocument> {
  constructor(
    @InjectModel(ProductCategory.name) m: Model<ProductCategoryDocument>,
    ctx: RequestContextService,
  ) {
    super(m, ctx);
  }
}

@Injectable()
export class ProductRepository extends TenantScopedRepository<ProductDocument> {
  constructor(@InjectModel(Product.name) m: Model<ProductDocument>, ctx: RequestContextService) {
    super(m, ctx);
  }
}

@Injectable()
export class PackageRepository extends TenantScopedRepository<PackageDocument> {
  constructor(@InjectModel(Package.name) m: Model<PackageDocument>, ctx: RequestContextService) {
    super(m, ctx);
  }
}
