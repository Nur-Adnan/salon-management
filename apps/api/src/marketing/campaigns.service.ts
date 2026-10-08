import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  renderCampaignMessage,
  type CampaignChannel,
  type CustomerSegmentFilter,
} from '@salon/shared';
import type { Queue } from 'bullmq';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { Customer, type CustomerDocument } from '../customers/customer.schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CAMPAIGN_QUEUE } from '../queue/queue.constants.js';
import { Campaign, type CampaignDocument } from './schemas/campaign.schema.js';
import { SegmentationService } from './segmentation.service.js';

export interface CreateCampaignDto {
  name: string;
  channel: CampaignChannel;
  type?: 'broadcast' | 'coupon' | 'gift_card' | 'seasonal';
  filter?: CustomerSegmentFilter;
  messageTemplate: string;
  couponCode?: string;
  scheduledAt?: string;
  idempotencyKey?: string;
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectModel(Campaign.name) private readonly campaigns: Model<CampaignDocument>,
    @InjectModel(Customer.name) private readonly customers: Model<CustomerDocument>,
    @InjectQueue(CAMPAIGN_QUEUE) private readonly campaignQueue: Queue,
    private readonly segmentationService: SegmentationService,
    private readonly notificationsService: NotificationsService,
    private readonly ctx: RequestContextService,
  ) {}

  private scope(): { tenantId: Types.ObjectId; branchId: Types.ObjectId | null } {
    const c = this.ctx.get();
    if (!c?.tenantId) throw new ForbiddenException('tenant context required');
    return {
      tenantId: new Types.ObjectId(c.tenantId),
      branchId: c.branchId ? new Types.ObjectId(c.branchId) : null,
    };
  }

  async create(dto: CreateCampaignDto): Promise<CampaignDocument> {
    const { tenantId, branchId } = this.scope();
    const idempotencyKey = dto.idempotencyKey || `camp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const existing = await this.campaigns.findOne({ tenantId, idempotencyKey }).exec();
    if (existing) return existing;

    return this.campaigns.create({
      tenantId,
      branchId,
      name: dto.name,
      channel: dto.channel,
      type: dto.type ?? 'broadcast',
      status: dto.scheduledAt ? 'scheduled' : 'draft',
      filter: dto.filter ?? {},
      messageTemplate: dto.messageTemplate,
      couponCode: dto.couponCode ?? null,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      idempotencyKey,
    });
  }

  async previewSegment(filter: CustomerSegmentFilter): Promise<{ count: number; sample: string[] }> {
    const { tenantId } = this.scope();
    const audience = await this.segmentationService.resolveAudience(tenantId, filter);
    return {
      count: audience.length,
      sample: audience.slice(0, 5).map((c) => `${c.name} (${c.phone || c.email})`),
    };
  }

  async list(): Promise<CampaignDocument[]> {
    const { tenantId } = this.scope();
    return this.campaigns.find({ tenantId }).sort({ createdAt: -1 }).limit(100).exec();
  }

  async get(id: string): Promise<CampaignDocument> {
    const { tenantId } = this.scope();
    const camp = await this.campaigns.findOne({ _id: new Types.ObjectId(id), tenantId }).exec();
    if (!camp) throw new NotFoundException('Campaign not found');
    return camp;
  }

  async launch(id: string): Promise<CampaignDocument> {
    const { tenantId } = this.scope();
    const _id = new Types.ObjectId(id);

    const camp = await this.campaigns.findOne({ _id, tenantId }).exec();
    if (!camp) throw new NotFoundException('Campaign not found');

    if (camp.status === 'running' || camp.status === 'completed') {
      throw new ConflictException(`Campaign is already ${camp.status}`);
    }

    // 1. Resolve and freeze audience snapshot
    const audience = await this.segmentationService.resolveAudience(tenantId, camp.filter);
    const audienceIds = audience.map((c) => c._id);

    // 2. Atomically transition to 'running'
    const locked = await this.campaigns
      .findOneAndUpdate(
        { _id, tenantId, status: { $in: ['draft', 'scheduled'] } },
        {
          $set: {
            status: 'running',
            executedAt: new Date(),
            audienceSnapshot: audienceIds,
            'stats.totalTargeted': audienceIds.length,
          },
        },
        { new: true },
      )
      .exec();

    if (!locked) {
      throw new ConflictException('Campaign was launched concurrently');
    }

    // 3. Enqueue execution job
    await this.campaignQueue.add(
      'execute_campaign',
      { campaignId: String(_id), tenantId: String(tenantId) },
      {
        jobId: `camp-exec-${_id}`,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      },
    );

    return locked;
  }

  async execute(campaignId: string, tenantId: string): Promise<void> {
    const camp = await this.campaigns
      .findOne({ _id: new Types.ObjectId(campaignId), tenantId: new Types.ObjectId(tenantId) })
      .exec();

    if (!camp || !camp.audienceSnapshot.length) {
      if (camp) {
        camp.status = 'completed';
        camp.completedAt = new Date();
        await camp.save();
      }
      return;
    }

    const customers = await this.customers
      .find({ _id: { $in: camp.audienceSnapshot }, tenantId: new Types.ObjectId(tenantId) })
      .exec();

    let sent = 0;
    let failed = 0;
    let optedOut = 0;

    for (const customer of customers) {
      if (customer.marketingOptOut) {
        optedOut++;
        continue;
      }

      const recipient = camp.channel === 'email' ? customer.email : customer.phone;
      if (!recipient) {
        failed++;
        continue;
      }

      const body = renderCampaignMessage(camp.messageTemplate, {
        campaignName: camp.name,
        customerName: customer.name,
        template: camp.messageTemplate,
        couponCode: camp.couponCode ?? undefined,
        unsubscribeUrl: `https://salon.test/unsubscribe?c=${customer._id}`,
      });

      try {
        await this.notificationsService.queueNotification({
          tenantId,
          branchId: camp.branchId ? String(camp.branchId) : null,
          channel: camp.channel,
          recipient,
          template: 'campaign_broadcast',
          data: {
            subject: camp.name,
            body,
            customerName: customer.name,
          },
          idempotencyKey: `campaign:${camp._id}:cust:${customer._id}`,
          metadata: {
            campaignId: String(camp._id),
            customerId: String(customer._id),
          },
        });
        sent++;
      } catch (err: any) {
        this.logger.warn(`Failed to queue campaign message to ${customer._id}: ${err.message}`);
        failed++;
      }

      // Micro rate-limiting delay (10ms) to prevent flood
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    camp.status = 'completed';
    camp.completedAt = new Date();
    camp.stats = {
      totalTargeted: camp.audienceSnapshot.length,
      sent,
      failed,
      optedOut,
    };
    await camp.save();
    this.logger.log(`Campaign ${camp._id} completed: ${sent} sent, ${failed} failed, ${optedOut} opted out.`);
  }

  async optOut(identifier: string, tenantId?: string): Promise<{ success: boolean }> {
    const q: Record<string, unknown> = {
      $or: [{ phone: identifier }, { email: identifier.toLowerCase() }],
    };
    if (tenantId) {
      q.tenantId = new Types.ObjectId(tenantId);
    }

    const res = await this.customers
      .updateMany(q, {
        $set: { marketingOptOut: true, optOutAt: new Date() },
      })
      .exec();

    return { success: res.matchedCount > 0 };
  }
}
