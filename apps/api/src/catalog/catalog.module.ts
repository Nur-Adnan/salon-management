import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PackagesController } from './packages.controller.js';
import { PackagesService } from './packages.service.js';
import { ProductsController } from './products.controller.js';
import {
  PackageRepository,
  ProductCategoryRepository,
  ProductRepository,
  ServiceCategoryRepository,
  ServiceRepository,
} from './repositories.js';
import { Package, PackageSchema } from './schemas/package.schema.js';
import { ProductCategory, ProductCategorySchema } from './schemas/product-category.schema.js';
import { Product, ProductSchema } from './schemas/product.schema.js';
import { ServiceCategory, ServiceCategorySchema } from './schemas/service-category.schema.js';
import { Service, ServiceSchema } from './schemas/service.schema.js';
import { ServicesController } from './services.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ServiceCategory.name, schema: ServiceCategorySchema },
      { name: Service.name, schema: ServiceSchema },
      { name: ProductCategory.name, schema: ProductCategorySchema },
      { name: Product.name, schema: ProductSchema },
      { name: Package.name, schema: PackageSchema },
    ]),
  ],
  controllers: [ServicesController, ProductsController, PackagesController],
  providers: [
    ServiceCategoryRepository,
    ServiceRepository,
    ProductCategoryRepository,
    ProductRepository,
    PackageRepository,
    PackagesService,
  ],
})
export class CatalogModule {}
