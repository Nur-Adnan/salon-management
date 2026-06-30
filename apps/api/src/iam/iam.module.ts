import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AbilityFactory } from './casl/ability.factory';
import { ProvisioningService } from './auth/provisioning.service';
import { SupabaseJwtStrategy } from './auth/supabase-jwt.strategy';
import { BranchesController } from './branches.controller';
import { IamController } from './iam.controller';
import { InvitationsController } from './invitations.controller';
import { OrganizationsController } from './organizations.controller';
import { Branch, BranchSchema } from './schemas/branch.schema';
import { Membership, MembershipSchema } from './schemas/membership.schema';
import { Organization, OrganizationSchema } from './schemas/organization.schema';
import { User, UserSchema } from './schemas/user.schema';
import { BranchRepository } from './services/branch.repository';
import { MembershipsService } from './services/memberships.service';
import { OrganizationsService } from './services/organizations.service';

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
