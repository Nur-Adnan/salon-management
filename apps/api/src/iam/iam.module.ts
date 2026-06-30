import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AbilityFactory } from './casl/ability.factory.js';
import { ProvisioningService } from './auth/provisioning.service.js';
import { SupabaseJwtStrategy } from './auth/supabase-jwt.strategy.js';
import { BranchesController } from './branches.controller.js';
import { IamController } from './iam.controller.js';
import { InvitationsController } from './invitations.controller.js';
import { OrganizationsController } from './organizations.controller.js';
import { Branch, BranchSchema } from './schemas/branch.schema.js';
import { Membership, MembershipSchema } from './schemas/membership.schema.js';
import { Organization, OrganizationSchema } from './schemas/organization.schema.js';
import { User, UserSchema } from './schemas/user.schema.js';
import { BranchRepository } from './services/branch.repository.js';
import { MembershipsService } from './services/memberships.service.js';
import { OrganizationsService } from './services/organizations.service.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: User.name, schema: UserSchema },
      { name: Membership.name, schema: MembershipSchema },
    ]),
  ],
  controllers: [IamController, OrganizationsController, BranchesController, InvitationsController],
  providers: [
    SupabaseJwtStrategy,
    ProvisioningService,
    AbilityFactory,
    OrganizationsService,
    MembershipsService,
    BranchRepository,
  ],
  // Exported so the global JwtAuthGuard / AbilitiesGuard (in AppModule) can inject them.
  exports: [ProvisioningService, AbilityFactory, PassportModule],
})
export class IamModule {}
