import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash, randomUUID } from 'node:crypto';
import type { Env } from '../../config/env.js';

export interface PresignedUploadOptions {
  tenantId: string;
  category: 'treatment-photos' | 'invoices' | 'attachments';
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  expiresInSeconds: number;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class ObjectStorageService {
  private readonly logger = new Logger(ObjectStorageService.name);
  private readonly memoryStore = new Map<string, { buffer: Buffer; contentType: string }>();

  constructor(private readonly config: ConfigService<Env, true>) {}

  private get endpoint(): string {
    return this.config.get('STORAGE_ENDPOINT', { infer: true }) || 'https://r2.cloudflarestorage.com';
  }

  private get bucket(): string {
    return this.config.get('STORAGE_BUCKET', { infer: true }) || 'salon-uploads';
  }

  private get accessKeyId(): string {
    return this.config.get('STORAGE_ACCESS_KEY_ID', { infer: true }) || 'mock-access-key';
  }

  private get secretAccessKey(): string {
    return this.config.get('STORAGE_SECRET_ACCESS_KEY', { infer: true }) || 'mock-secret-key';
  }

  private get region(): string {
    return this.config.get('STORAGE_REGION', { infer: true }) || 'auto';
  }

  private isConfigured(): boolean {
    const key = this.config.get('STORAGE_ACCESS_KEY_ID', { infer: true });
    const secret = this.config.get('STORAGE_SECRET_ACCESS_KEY', { infer: true });
    return Boolean(key && secret && key.length > 0 && secret.length > 0);
  }

  async generatePresignedUploadUrl(options: PresignedUploadOptions): Promise<PresignedUploadResult> {
    const { tenantId, category, filename, contentType, sizeBytes } = options;

    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      throw new BadRequestException(
        `Unsupported media type: ${contentType}. Allowed types: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`,
      );
    }

    const maxSize = contentType === 'application/pdf' ? MAX_DOC_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
    if (sizeBytes > maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed limit of ${maxSize / (1024 * 1024)}MB`,
      );
    }

    // Sanitize filename to avoid path traversal
    const safeBase = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `tenants/${tenantId}/${category}/${randomUUID()}-${safeBase}`;
    const expiresInSeconds = 900; // 15 minutes

    const uploadUrl = this.generateSigV4Url('PUT', key, expiresInSeconds, contentType);

    return {
      uploadUrl,
      key,
      expiresInSeconds,
    };
  }

  async generatePresignedDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
    if (!key || key.includes('..')) {
      throw new BadRequestException('Invalid storage key');
    }
    return this.generateSigV4Url('GET', key, expiresInSeconds);
  }

  // Server-side upload / put object (e.g. for rendered PDF invoices)
  async putObject(key: string, data: Buffer, contentType: string): Promise<void> {
    if (this.isConfigured()) {
      try {
        const url = this.generateSigV4Url('PUT', key, 300, contentType);
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: data as never,
        });
        if (!res.ok) {
          throw new Error(`Failed to upload to S3/R2: ${res.statusText}`);
        }
      } catch (err: unknown) {
        this.logger.warn(`Storage putObject error, falling back to memory: ${(err as Error).message}`);
        this.memoryStore.set(key, { buffer: data, contentType });
      }
    } else {
      this.memoryStore.set(key, { buffer: data, contentType });
    }
  }

  async getObject(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    return this.memoryStore.get(key) ?? null;
  }

  async deleteObject(key: string): Promise<void> {
    this.memoryStore.delete(key);
  }

  // AWS Signature Version 4 URL generation with zero external dependencies
  private generateSigV4Url(
    method: 'GET' | 'PUT',
    key: string,
    expiresInSeconds: number,
    contentType?: string,
  ): string {
    const endpointUrl = new URL(this.endpoint);
    const host = endpointUrl.host;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const service = 's3';
    const region = this.region;

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

    const signedHeaders = contentType ? 'content-type;host' : 'host';
    const queryParams: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresInSeconds),
      'X-Amz-SignedHeaders': signedHeaders,
    };

    const canonicalUri = `/${this.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
    const sortedQuery = Object.keys(queryParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k]!)}`)
      .join('&');

    const canonicalHeaders = contentType
      ? `content-type:${contentType}\nhost:${host}\n`
      : `host:${host}\n`;

    const canonicalRequest = [
      method,
      canonicalUri,
      sortedQuery,
      canonicalHeaders,
      signedHeaders,
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = this.getSignatureKey(this.secretAccessKey, dateStamp, region, service);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    return `${this.endpoint}${canonicalUri}?${sortedQuery}&X-Amz-Signature=${signature}`;
  }

  private getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
    const kDate = createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
    const kRegion = createHmac('sha256', kDate).update(regionName).digest();
    const kService = createHmac('sha256', kRegion).update(serviceName).digest();
    return createHmac('sha256', kService).update('aws4_request').digest();
  }
}
