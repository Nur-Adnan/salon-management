import { describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { InventoryService } from './inventory.service.js';

describe('InventoryService (Stage B Refinements)', () => {
  const tenantId = new Types.ObjectId();
  const fromBranchId = new Types.ObjectId();
  const toBranchId = new Types.ObjectId();
  const productId = new Types.ObjectId();

  const mockContext = {
    get: () => ({
      tenantId: tenantId.toHexString(),
      branchId: fromBranchId.toHexString(),
      userId: new Types.ObjectId().toHexString(),
    }),
  };

  const mockSession = {
    withTransaction: async (fn: () => Promise<unknown>) => fn(),
    endSession: vi.fn(),
  };

  const mockConnection = {
    startSession: () => Promise.resolve(mockSession),
  };

  it('rejects transfer where source and destination branches are the same', async () => {
    const service = new InventoryService(
      mockConnection as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      mockContext as never,
    );

    await expect(
      service.createTransfer({
        fromBranchId: fromBranchId.toHexString(),
        toBranchId: fromBranchId.toHexString(),
        lines: [{ productId: productId.toHexString(), quantity: 5 }],
      }),
    ).rejects.toThrow('cannot transfer stock to the same branch');
  });

  it('consumes batches in FEFO order and decrements batch quantities', async () => {
    const b1 = {
      _id: new Types.ObjectId(),
      batchNumber: 'LOT-MAY',
      qtyOnHand: 10,
      expiryDate: new Date('2026-05-01'),
    };
    const b2 = {
      _id: new Types.ObjectId(),
      batchNumber: 'LOT-JAN',
      qtyOnHand: 5,
      expiryDate: new Date('2026-01-01'),
    };

    const updatedBatches: { id: string; decr: number }[] = [];
    const batchesModel = {
      find: () => ({
        sort: () => ({
          exec: () => Promise.resolve([b1, b2]),
        }),
      }),
      updateOne: vi.fn().mockImplementation((filter, update) => {
        updatedBatches.push({ id: filter._id.toHexString(), decr: update.$inc.qtyOnHand });
        return Promise.resolve({ matchedCount: 1 });
      }),
    };

    const service = new InventoryService(
      mockConnection as never,
      {} as never,
      {} as never,
      {} as never,
      batchesModel as never,
      {} as never,
      {} as never,
      mockContext as never,
    );

    // Request 8: should consume 5 from b2 (Jan) and 3 from b1 (May)
    await service.consumeBatchesFEFO(productId.toHexString(), 8);

    expect(updatedBatches).toEqual([
      { id: b2._id.toHexString(), decr: -5 },
      { id: b1._id.toHexString(), decr: -3 },
    ]);
  });
});
