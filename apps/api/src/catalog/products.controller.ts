import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  type CreateProduct,
  type CreateProductCategory,
  type UpdateProduct,
  type UpdateProductCategory,
  createProductCategorySchema,
  createProductSchema,
  objectIdSchema,
  updateProductCategorySchema,
  updateProductSchema,
} from '@salon/shared';
import { Types } from 'mongoose';
import { isDuplicateKeyError } from '../common/mongo.util.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { serializeProduct, serializeProductCategory } from './mappers.js';
import { ProductCategoryRepository, ProductRepository } from './repositories.js';
import type { ProductDocument } from './schemas/product.schema.js';

function toProductDoc(dto: CreateProduct | UpdateProduct): Partial<ProductDocument> {
  const { categoryId, ...rest } = dto;
  return {
    ...rest,
    ...(categoryId ? { categoryId: new Types.ObjectId(categoryId) } : {}),
  } as unknown as Partial<ProductDocument>;
}

@Controller('catalog')
export class ProductsController {
  constructor(
    private readonly categories: ProductCategoryRepository,
    private readonly products: ProductRepository,
  ) {}

  // ---- product categories ----
  @Get('product-categories')
  @CheckAbility('read', 'Catalog')
  async listCategories() {
    return (await this.categories.find()).map(serializeProductCategory);
  }

  @Post('product-categories')
  @CheckAbility('create', 'Catalog')
  async createCategory(
    @Body(new ZodValidationPipe(createProductCategorySchema)) dto: CreateProductCategory,
  ) {
    return serializeProductCategory(await this.categories.create(dto));
  }

  @Patch('product-categories/:id')
  @CheckAbility('update', 'Catalog')
  async updateCategory(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateProductCategorySchema)) dto: UpdateProductCategory,
  ) {
    const u = await this.categories.updateById(id, dto);
    if (!u) throw new NotFoundException('product category not found');
    return serializeProductCategory(u);
  }

  @Delete('product-categories/:id')
  @CheckAbility('delete', 'Catalog')
  async removeCategory(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    const d = await this.categories.softDeleteById(id);
    if (!d) throw new NotFoundException('product category not found');
    return { id: String(d._id), deleted: true };
  }

  // ---- products ----
  @Get('products')
  @CheckAbility('read', 'Catalog')
  async list() {
    return (await this.products.find()).map(serializeProduct);
  }

  // Barcode/QR scan-to-add: POS scans a code, this resolves it to a product.
  @Get('products/barcode/:code')
  @CheckAbility('read', 'Catalog')
  async byBarcode(@Param('code') code: string) {
    const p = await this.products.findOne({ barcode: code });
    if (!p) throw new NotFoundException('no product with that barcode');
    return serializeProduct(p);
  }

  @Post('products')
  @CheckAbility('create', 'Catalog')
  async create(@Body(new ZodValidationPipe(createProductSchema)) dto: CreateProduct) {
    try {
      return serializeProduct(await this.products.create(toProductDoc(dto)));
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictException('sku or barcode already exists in this tenant');
      }
      throw err;
    }
  }

  @Patch('products/:id')
  @CheckAbility('update', 'Catalog')
  async update(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) dto: UpdateProduct,
  ) {
    try {
      const u = await this.products.updateById(id, toProductDoc(dto));
      if (!u) throw new NotFoundException('product not found');
      return serializeProduct(u);
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictException('sku or barcode already exists in this tenant');
      }
      throw err;
    }
  }

  @Delete('products/:id')
  @CheckAbility('delete', 'Catalog')
  async remove(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    const d = await this.products.softDeleteById(id);
    if (!d) throw new NotFoundException('product not found');
    return { id: String(d._id), deleted: true };
  }
}
