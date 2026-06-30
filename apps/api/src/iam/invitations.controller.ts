import { Body, Controller, Get, Post } from '@nestjs/common';
import { type InviteMember, inviteMemberSchema } from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CheckAbility } from './casl/check-ability.decorator';
import { serializeMembership } from './mappers';
import { MembershipsService } from './services/memberships.service';

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
