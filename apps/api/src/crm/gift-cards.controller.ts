import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post } from '@nestjs/common';
import { type IssueGiftCard, issueGiftCardSchema, objectIdSchema } from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { GiftCardsService } from './gift-cards.service.js';
import { serializeGiftCard, serializeGiftCardLedgerEntry } from './mappers.js';

@Controller('gift-cards')
export class GiftCardsController {
  constructor(private readonly giftCards: GiftCardsService) {}

  @Get()
  @CheckAbility('read', 'GiftCard')
  async list() {
    return (await this.giftCards.list()).map(serializeGiftCard);
  }

  @Post()
  @CheckAbility('manage', 'GiftCard')
  async issue(@Body(new ZodValidationPipe(issueGiftCardSchema)) dto: IssueGiftCard) {
    return serializeGiftCard(await this.giftCards.issue(dto));
  }

  @Get(':code')
  @CheckAbility('read', 'GiftCard')
  async get(@Param('code') code: string) {
    const card = await this.giftCards.findByCode(code);
    const ledger = await this.giftCards.ledgerFor(String(card._id));
    return { ...serializeGiftCard(card), ledger: ledger.map(serializeGiftCardLedgerEntry) };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @CheckAbility('manage', 'GiftCard')
  async cancel(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    const card = await this.giftCards.cancel(id);
    if (!card) throw new NotFoundException('gift card not found');
    return serializeGiftCard(card);
  }
}
