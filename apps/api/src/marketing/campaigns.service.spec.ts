import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { CampaignsService } from './campaigns.service.js';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let mockCampaigns: any;
  let mockCustomers: any;
  let mockQueue: any;
  let mockSegmentation: any;
  let mockNotifications: any;
  let mockCtx: any;

  beforeEach(() => {
    mockCampaigns = {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      findOneAndUpdate: vi.fn(),
    };

    mockCustomers = {
      find: vi.fn(),
      updateMany: vi.fn(),
    };

    mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-camp-1' }),
    };

    mockSegmentation = {
      resolveAudience: vi.fn(),
    };

    mockNotifications = {
      queueNotification: vi.fn().mockResolvedValue({}),
    };

    mockCtx = {
      get: vi.fn().mockReturnValue({
        tenantId: new Types.ObjectId().toHexString(),
        branchId: new Types.ObjectId().toHexString(),
      }),
    };

    service = new CampaignsService(
      mockCampaigns,
      mockCustomers,
      mockQueue,
      mockSegmentation,
      mockNotifications,
      mockCtx,
    );
  });

  it('creates a new draft campaign with segment filter', async () => {
    mockCampaigns.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(null) });
    const createdCamp = {
      _id: new Types.ObjectId(),
      name: 'Eid Special 20%',
      channel: 'sms',
      status: 'draft',
      filter: { minTotalSpendMinor: 100000 },
    };
    mockCampaigns.create.mockResolvedValue(createdCamp);

    const res = await service.create({
      name: 'Eid Special 20%',
      channel: 'sms',
      messageTemplate: 'Hi {{customerName}}! Get 20% off.',
      filter: { minTotalSpendMinor: 100000 },
      idempotencyKey: 'camp-eid-2026',
    });

    expect(res).toBe(createdCamp);
    expect(mockCampaigns.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Eid Special 20%',
        channel: 'sms',
        status: 'draft',
        idempotencyKey: 'camp-eid-2026',
      }),
    );
  });

  it('launches campaign: freezes audience snapshot, atomically marks running, and queues job', async () => {
    const campId = new Types.ObjectId();
    const custId1 = new Types.ObjectId();
    const custId2 = new Types.ObjectId();

    const camp = {
      _id: campId,
      status: 'draft',
      filter: {},
    };
    mockCampaigns.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(camp) });
    mockSegmentation.resolveAudience.mockResolvedValue([
      { _id: custId1, name: 'Customer 1' },
      { _id: custId2, name: 'Customer 2' },
    ]);

    const lockedCamp = {
      _id: campId,
      status: 'running',
      audienceSnapshot: [custId1, custId2],
      stats: { totalTargeted: 2 },
    };
    mockCampaigns.findOneAndUpdate.mockReturnValue({ exec: vi.fn().mockResolvedValue(lockedCamp) });

    const launched = await service.launch(campId.toHexString());

    expect(launched.status).toBe('running');
    expect(mockSegmentation.resolveAudience).toHaveBeenCalled();
    expect(mockCampaigns.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: campId, status: { $in: ['draft', 'scheduled'] } }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'running', audienceSnapshot: [custId1, custId2] }),
      }),
      { new: true },
    );
    expect(mockQueue.add).toHaveBeenCalledWith(
      'execute_campaign',
      expect.objectContaining({ campaignId: campId.toHexString() }),
      expect.objectContaining({ jobId: `camp-exec-${campId}` }),
    );
  });

  it('prevents accidental duplicate launches on already running/completed campaigns', async () => {
    const campId = new Types.ObjectId();
    const runningCamp = { _id: campId, status: 'running' };
    mockCampaigns.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(runningCamp) });

    await expect(service.launch(campId.toHexString())).rejects.toThrow('already running');
  });

  it('executes campaign, skips opted-out customers, and delivers notifications', async () => {
    const campId = new Types.ObjectId();
    const tenantId = new Types.ObjectId();
    const cust1 = { _id: new Types.ObjectId(), name: 'Active User', phone: '+8801700000001', marketingOptOut: false };
    const cust2 = { _id: new Types.ObjectId(), name: 'Opted Out User', phone: '+8801700000002', marketingOptOut: true };

    const camp: any = {
      _id: campId,
      tenantId,
      name: 'Spring Promo',
      channel: 'sms',
      messageTemplate: 'Hi {{customerName}}!',
      audienceSnapshot: [cust1._id, cust2._id],
      stats: { totalTargeted: 2, sent: 0, failed: 0, optedOut: 0 },
      save: vi.fn().mockResolvedValue(this),
    };

    mockCampaigns.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(camp) });
    mockCustomers.find.mockReturnValue({ exec: vi.fn().mockResolvedValue([cust1, cust2]) });

    await service.execute(campId.toHexString(), tenantId.toHexString());

    expect(mockNotifications.queueNotification).toHaveBeenCalledTimes(1);
    expect(mockNotifications.queueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: '+8801700000001',
        data: expect.objectContaining({ body: 'Hi Active User!' }),
        idempotencyKey: `campaign:${campId}:cust:${cust1._id}`,
      }),
    );

    expect(camp.status).toBe('completed');
    expect(camp.stats.sent).toBe(1);
    expect(camp.stats.optedOut).toBe(1);
    expect(camp.save).toHaveBeenCalled();
  });

  it('handles customer opt-out requests', async () => {
    mockCustomers.updateMany.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
    });

    const res = await service.optOut('01712345678');
    expect(res.success).toBe(true);
    expect(mockCustomers.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [{ phone: '01712345678' }, { email: '01712345678' }],
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ marketingOptOut: true }),
      }),
    );
  });
});
