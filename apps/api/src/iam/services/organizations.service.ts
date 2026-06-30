import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { CreateOrganization } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { Membership, type MembershipDocument } from '../schemas/membership.schema.js';
import { Organization, type OrganizationDocument } from '../schemas/organization.schema.js';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name) private readonly orgs: Model<OrganizationDocument>,
    @InjectModel(Membership.name) private readonly memberships: Model<MembershipDocument>,
  ) {}

  // Bootstrap: any authenticated user can create an org and becomes its owner.
  // (No active tenant exists yet, so this does not go through the scoped repo.)
  async createForUser(userId: string, dto: CreateOrganization): Promise<OrganizationDocument> {
    let org: OrganizationDocument;
    try {
      org = await this.orgs.create({ name: dto.name, slug: dto.slug, timezone: dto.timezone });
    } catch (err) {
      if (isDuplicateKey(err)) throw new ConflictException('slug already taken');
      throw err;
    }
    await this.memberships.create({
      tenantId: org._id,
      userId: new Types.ObjectId(userId),
      branchId: null,
      role: 'owner',
      status: 'active',
    });
    return org;
  }

  findById(id: string): Promise<OrganizationDocument | null> {
    return this.orgs.findOne({ _id: new Types.ObjectId(id), deletedAt: null }).exec();
  }
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}
