import { Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { type CreateOrganization, createOrganizationSchema } from '@salon/shared';
import type { RequestContext } from '../common/context/request-context.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from './auth/current-user.decorator';
import { OrganizationsService } from './services/organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  // Bootstrap a tenant. Any authenticated user; they become the owner.
  @Post()
  async create(
    @Body(new ZodValidationPipe(createOrganizationSchema)) dto: CreateOrganization,
    @CurrentUser() ctx?: RequestContext,
  ) {
    if (!ctx?.userId) throw new ForbiddenException('No authenticated user');
    const org = await this.orgs.createForUser(ctx.userId, dto);
    return { id: String(org._id), name: org.name, slug: org.slug, timezone: org.timezone };
  }
}
