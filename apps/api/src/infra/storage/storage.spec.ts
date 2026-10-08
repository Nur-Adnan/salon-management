import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ObjectStorageService } from './object-storage.service.js';

describe('ObjectStorageService', () => {
  const config = new ConfigService({
    STORAGE_ENDPOINT: 'https://r2.cloudflarestorage.com',
    STORAGE_BUCKET: 'salon-uploads',
    STORAGE_ACCESS_KEY_ID: 'test-key',
    STORAGE_SECRET_ACCESS_KEY: 'test-secret',
    STORAGE_REGION: 'auto',
  });

  const storage = new ObjectStorageService(config as never);

  it('generates a valid SigV4 presigned upload URL for supported image types', async () => {
    const result = await storage.generatePresignedUploadUrl({
      tenantId: 'tenant-123',
      category: 'treatment-photos',
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024 * 500, // 500 KB
    });

    expect(result.uploadUrl).toContain('https://r2.cloudflarestorage.com/salon-uploads/tenants/tenant-123/treatment-photos/');
    expect(result.uploadUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(result.uploadUrl).toContain('X-Amz-Signature=');
    expect(result.key).toMatch(/^tenants\/tenant-123\/treatment-photos\/[a-f0-9-]+-photo\.jpg$/);
    expect(result.expiresInSeconds).toBe(900);
  });

  it('rejects unsupported MIME types', async () => {
    await expect(
      storage.generatePresignedUploadUrl({
        tenantId: 'tenant-123',
        category: 'treatment-photos',
        filename: 'malicious.exe',
        contentType: 'application/x-msdownload',
        sizeBytes: 1024,
      }),
    ).rejects.toThrow(/Unsupported media type/);
  });

  it('rejects files exceeding size limits', async () => {
    await expect(
      storage.generatePresignedUploadUrl({
        tenantId: 'tenant-123',
        category: 'treatment-photos',
        filename: 'huge.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 6 * 1024 * 1024, // 6 MB > 5 MB limit
      }),
    ).rejects.toThrow(/File size exceeds maximum allowed limit/);
  });

  it('generates a presigned download URL', async () => {
    const downloadUrl = await storage.generatePresignedDownloadUrl('tenants/tenant-123/invoices/inv-001.pdf');
    expect(downloadUrl).toContain('https://r2.cloudflarestorage.com/salon-uploads/tenants/tenant-123/invoices/inv-001.pdf');
    expect(downloadUrl).toContain('X-Amz-Signature=');
  });

  it('stores and retrieves server-side buffer in memory fallback', async () => {
    const key = 'tenants/tenant-123/invoices/direct-inv.pdf';
    const data = Buffer.from('PDF invoice content');
    await storage.putObject(key, data, 'application/pdf');

    const retrieved = await storage.getObject(key);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.contentType).toBe('application/pdf');
    expect(retrieved?.buffer.toString()).toBe('PDF invoice content');

    await storage.deleteObject(key);
    expect(await storage.getObject(key)).toBeNull();
  });
});
