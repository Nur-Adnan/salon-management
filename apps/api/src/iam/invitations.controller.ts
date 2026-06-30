import { Body, Controller, Get, Post } from '@nestjs/common';
import { type InviteMember, inviteMemberSchema } from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from './casl/check-ability.decorator.js';
import { serializeMembership } from './mappers.js';
import { MembershipsService } from './services/memberships.service.js';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get()
  @CheckAbility('read', 'Membership')
  async list() {
    return (await this.memberships.list()).map(serializeMembership);
  }

  @Post()
  @CheckAbility('create', 'Membership')
  async invite(@Body(new ZodValidationPipe(inviteMemberSchema)) dto: InviteMember) {
    return serializeMembership(await this.memberships.invite(dto));
  }
}
