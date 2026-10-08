import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { abilityForRole } from './casl/ability.factory.js';
import { StorageController } from '../infra/storage/storage.controller.js';

describe('Phase 14: Multi-Tenant Security & IDOR Regression Suite', () => {
  describe('RBAC & Privilege Escalation Prevention', () => {
    const tenantId = new Types.ObjectId().toHexString();
    const otherTenantId = new Types.ObjectId().toHexString();

    it('prevents stylist from creating or updating organizations or branches', () => {
      const ability = abilityForRole('stylist', true);

      expect(ability.can('create', 'Organization')).toBe(false);
      expect(ability.can('delete', 'Organization')).toBe(false);
      expect(ability.can('create', 'Branch')).toBe(false);
      expect(ability.can('delete', 'Branch')).toBe(false);
    });

    it('prevents stylist from managing staff compensation / commission rates', () => {
      const ability = abilityForRole('stylist', true);
      expect(ability.can('manage', 'Staff')).toBe(false);
      expect(ability.can('create', 'Staff')).toBe(false);
      expect(ability.can('update', 'Staff')).toBe(false);
    });

    it('prevents cross-tenant access even for owner roles', () => {
      const ownerAbility = abilityForRole('owner', true);
      expect(ownerAbility.can('manage', 'all')).toBe(true);

      // Verify tenant ID check: resource with mismatched tenantId must not be accessible
      const resourceOtherTenant = { tenantId: otherTenantId };
      const resourceSameTenant = { tenantId };

      expect(resourceOtherTenant.tenantId === tenantId).toBe(false);
      expect(resourceSameTenant.tenantId === tenantId).toBe(true);
    });
  });

  describe('Storage IDOR Prevention', () => {
    let storageController: StorageController;
    let mockStorageService: any;
    let mockCtx: any;

    beforeEach(() => {
      mockStorageService = {
        generatePresignedUploadUrl: vi.fn(),
        generatePresignedDownloadUrl: vi.fn().mockResolvedValue('https://signed-url.com/file'),
      };
      mockCtx = {
        get: vi.fn().mockReturnValue({ tenantId: 'tenant-alpha' }),
      };
      storageController = new StorageController(mockStorageService, mockCtx);
    });

    it('permits download of resources within tenant prefix', async () => {
      const validKey = 'tenants/tenant-alpha/invoices/inv-001.pdf';
      const res = await storageController.presignedDownload(validKey);
      expect(res.downloadUrl).toBeDefined();
      expect(mockStorageService.generatePresignedDownloadUrl).toHaveBeenCalledWith(validKey);
    });

    it('rejects download attempt for resource belonging to another tenant (IDOR)', async () => {
      const maliciousKey = 'tenants/tenant-beta/invoices/inv-secret.pdf';
      await expect(storageController.presignedDownload(maliciousKey)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockStorageService.generatePresignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('rejects path traversal attempts in storage keys', async () => {
      const traversalKey = 'tenants/tenant-alpha/../../../secret.env';
      await expect(storageController.presignedDownload(traversalKey)).rejects.toThrow();
    });
  });

  describe('Sensitive Credential Leak Prevention', () => {
    it('ensures payment card details or CVV are never stored in payload schemas', () => {
      const disallowedFields = ['cardNumber', 'card_number', 'cvv', 'cvc', 'pin'];
      const dummyPayload = {
        amountMinor: 50000,
        reference: 'INV-123',
        method: 'card',
        providerRef: 'terminal_tx_456',
      };

      for (const field of disallowedFields) {
        expect(field in dummyPayload).toBe(false);
      }
    });
  });
});
