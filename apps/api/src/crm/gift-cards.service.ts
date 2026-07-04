import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { type Connection, type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { isDuplicateKeyError } from '../common/mongo.util.js';
import { CustomerRepository } from '../customers/customer.repository.js';
import { GiftCard, type GiftCardDocument } from './schemas/gift-card.schema.js';
import { GiftCardLedgerEntry, type GiftCardLedgerEntryDocument } from './schemas/gift-card-ledger-entry.schema.js';

@Injectable()
export class GiftCardsService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(GiftCard.name) private readonly cards: Model<GiftCardDocument>,
    @InjectModel(GiftCardLedgerEntry.name) private readonly ledger: Model<GiftCardLedgerEntryDocument>,
    private readonly customers: CustomerRepository,
    private readonly ctx: RequestContextService,
  ) {}

  private tenantId(): Types.ObjectId {
    const t = this.ctx.get()?.tenantId;
    if (!t) throw new ForbiddenException('no active tenant');
    return new Types.ObjectId(t);
  }

  async issue(params: { amount: number; customerId?: string; expiresAt?: string }): Promise<GiftCardDocument> {
    const tenantId = this.tenantId();
    if (params.customerId && !(await this.customers.findById(params.customerId))) {
      throw new BadRequestException('unknown customer');
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = `GC-${randomBytes(4).toString('hex').toUpperCase()}`;
      const session = await this.conn.startSession();
      try {
        let card: GiftCardDocument | undefined;
        await session.withTransaction(async () => {
          const createdDocs = await this.cards.create(
            [
              {
                tenantId,
                code,
                initialAmount: { amount: params.amount, currency: 'BDT' },
                balance: { amount: params.amount, currency: 'BDT' },
                status: 'active',
                issuedToCustomerId: params.customerId ? new Types.ObjectId(params.customerId) : null,
                expiresAt: params.expiresAt ? new Date(params.expiresAt) : null,
              },
            ] as never,
            { session },
          );
          const created = createdDocs[0];
          if (!created) throw new Error('gift card create returned no document');
          card = created;
          await this.ledger.create(
            [{ tenantId, giftCardId: created._id, type: 'issue', amount: { amount: params.amount, currency: 'BDT' } }] as never,
            { session },
          );
        });
        return card as GiftCardDocument;
      } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;
      } finally {
        await session.endSession();
      }
    }
    throw new Error('failed to generate a unique gift card code after 5 attempts');
  }

  async findByCode(code: string): Promise<GiftCardDocument> {
    const card = await this.cards.findOne({ tenantId: this.tenantId(), code }).exec();
    if (!card) throw new NotFoundException('no gift card with that code');
    return card;
  }

  list(): Promise<GiftCardDocument[]> {
    return this.cards.find({ tenantId: this.tenantId() }).sort({ createdAt: -1 }).limit(500).exec();
  }

  ledgerFor(giftCardId: string): Promise<GiftCardLedgerEntryDocument[]> {
    return this.ledger
      .find({ tenantId: this.tenantId(), giftCardId: new Types.ObjectId(giftCardId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async cancel(giftCardId: string): Promise<GiftCardDocument> {
    const card = await this.cards
      .findOneAndUpdate(
        { _id: new Types.ObjectId(giftCardId), tenantId: this.tenantId() },
        { $set: { status: 'cancelled' } },
        { new: true },
      )
      .exec();
    if (!card) throw new NotFoundException('gift card not found');
    return card;
  }
}

// Not stored — depleted is self-evident from balance, matching the "derive,
// don't drift" philosophy used across Phase 5 (see ledger.util.ts).
export function giftCardDisplayStatus(card: Pick<GiftCardDocument, 'status' | 'balance' | 'expiresAt'>): string {
  if (card.status !== 'active') return card.status;
  if (card.expiresAt && card.expiresAt.getTime() < Date.now()) return 'expired';
  if (card.balance.amount <= 0) return 'depleted';
  return 'active';
}
