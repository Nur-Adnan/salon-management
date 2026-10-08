import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import type { CustomerSegmentFilter } from '@salon/shared';
import { Public } from '../iam/auth/public.decorator.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { CampaignsService, type CreateCampaignDto } from './campaigns.service.js';
import type { CampaignDocument } from './schemas/campaign.schema.js';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  @CheckAbility('create', 'Campaign')
  async create(@Body() body: CreateCampaignDto): Promise<CampaignDocument> {
    return this.campaigns.create(body);
  }

  @Get()
  @CheckAbility('read', 'Campaign')
  async list(): Promise<CampaignDocument[]> {
    return this.campaigns.list();
  }

  @Post('preview-segment')
  @CheckAbility('read', 'Campaign')
  async previewSegment(@Body() filter: CustomerSegmentFilter): Promise<{ count: number; sample: string[] }> {
    return this.campaigns.previewSegment(filter);
  }

  @Get(':id')
  @CheckAbility('read', 'Campaign')
  async get(@Param('id') id: string): Promise<CampaignDocument> {
    return this.campaigns.get(id);
  }

  @Post(':id/launch')
  @CheckAbility('update', 'Campaign')
  async launch(@Param('id') id: string): Promise<CampaignDocument> {
    return this.campaigns.launch(id);
  }

  @Public()
  @Post('opt-out')
  async optOut(@Body() body: { identifier: string; tenantId?: string }): Promise<{ success: boolean }> {
    return this.campaigns.optOut(body.identifier, body.tenantId);
  }
}
