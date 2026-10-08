import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { RequestContextService } from '../../common/context/request-context.service.js';
import { ObjectStorageService } from './object-storage.service.js';

interface PresignedUploadBody {
  category: 'treatment-photos' | 'invoices' | 'attachments';
  filename: string;
  contentType: string;
  sizeBytes: number;
}

@Controller('storage')
export class StorageController {
  constructor(
    private readonly storage: ObjectStorageService,
    private readonly ctx: RequestContextService,
  ) {}

  private tenantId(): string {
    const t = this.ctx.get()?.tenantId;
    if (!t) throw new ForbiddenException('no active tenant');
    return t;
  }

  @Post('presigned-upload')
  async presignedUpload(@Body() body: PresignedUploadBody) {
    if (!body.category || !body.filename || !body.contentType || typeof body.sizeBytes !== 'number') {
      throw new BadRequestException('category, filename, contentType, and sizeBytes are required');
    }

    return this.storage.generatePresignedUploadUrl({
      tenantId: this.tenantId(),
      category: body.category,
      filename: body.filename,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
    });
  }

  @Get('presigned-download')
  async presignedDownload(@Query('key') key: string) {
    if (!key || key.includes('..') || key.includes('//')) {
      throw new BadRequestException('Invalid or dangerous storage key');
    }

    // Strict tenant isolation: key must belong to current tenant's directory
    const expectedPrefix = `tenants/${this.tenantId()}/`;
    if (!key.startsWith(expectedPrefix)) {
      throw new ForbiddenException('Access denied to storage resource outside your tenant');
    }

    const downloadUrl = await this.storage.generatePresignedDownloadUrl(key);
    return { downloadUrl };
  }
}
