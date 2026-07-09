import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import {
  type CreateSale,
  type PaymentInputDto,
  type SaleLineInput,
  type SaleLineKind,
  amountCaptured,
  applyCoupon,
  lineTotals,
  loyaltyPointsForRedemption,
  money,
  salePaymentStatus,
  saleTotals,
} from '@salon/shared';
import { type ClientSession, type Connection, type Model, Types } from 'mongoose';
import { Product, type ProductDocument } from '../catalog/schemas/product.schema.js';
import { Service, type ServiceDocument } from '../catalog/schemas/service.schema.js';
import { Package, type PackageDocument } from '../catalog/schemas/package.schema.js';
import { RequestContextService } from '../common/context/request-context.service.js';
import { isDuplicateKeyError } from '../common/mongo.util.js';
import {
  claimCouponRedemption,
  debitGiftCard,
  debitLoyalty,
  reverseLoyaltyEarnForSale,
  reverseReferralRewardForSale,
} from '../crm/ledger.util.js';
import { Coupon, type CouponDocument } from '../crm/schemas/coupon.schema.js';
import { Referral, type ReferralDocument } from '../crm/schemas/referral.schema.js';
import { GiftCard, type GiftCardDocument } from '../crm/schemas/gift-card.schema.js';
import { GiftCardLedgerEntry, type GiftCardLedgerEntryDocument } from '../crm/schemas/gift-card-ledger-entry.schema.js';
import { LoyaltyAccount, type LoyaltyAccountDocument } from '../crm/schemas/loyalty-account.schema.js';
import { LoyaltyLedgerEntry, type LoyaltyLedgerEntryDocument } from '../crm/schemas/loyalty-ledger-entry.schema.js';
import { SubscriptionPlan, type SubscriptionPlanDocument } from '../crm/schemas/subscription-plan.schema.js';
import { reverseStaffEarningsForSale } from '../hr/ledger.util.js';
import { StaffEarningEntry, type StaffEarningEntryDocument } from '../hr/schemas/staff-earning-entry.schema.js';
import { Branch, type BranchDocument } from '../iam/schemas/branch.schema.js';
import { Membership, type MembershipDocument } from '../iam/schemas/membership.schema.js';
import { Customer, type CustomerDocument } from '../customers/customer.schema.js';
import { Appointment, type AppointmentDocument } from '../scheduling/schemas/appointment.schema.js';
import { dayRangeUtc } from '../scheduling/time.util.js';
import { SaleCompleted, SaleVoided } from './events.js';
import { PaymentGateway } from './payment/providers.js';
import { Counter, type CounterDocument } from './schemas/counter.schema.js';
import { type Payment, type SaleLine, Sale, type SaleDocument } from './schemas/sale.schema.js';
import { StockLevel, type StockLevelDocument } from './schemas/stock-level.schema.js';

const BDT = 'BDT';
const embed = (amount: number) => ({ amount, currency: BDT });

interface ResolvedLine {
  kind: SaleLine['kind'];
  refId: Types.ObjectId;
  name: { en: string; bn?: string | null };
  staffId: Types.ObjectId | null;
  pricing: SaleLineInput;
}

export interface CheckoutResult {
  sale: SaleDocument;
  // True when this call returned a PRE-EXISTING sale (idempotency-key replay or
  // a concurrent duplicate that lost the race) rather than freshly creating
  // one. Callers that do something ELSE alongside checkout (e.g. advancing a
  // subscription's billing period) must skip that side effect on a replay —
  // otherwise a retried request grants it twice for one payment.
  wasReplayed: boolean;
}

@Injectable()
export class SalesService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(Sale.name) private readonly sales: Model<SaleDocument>,
    @InjectModel(StockLevel.name) private readonly stock: Model<StockLevelDocument>,
    @InjectModel(Counter.name) private readonly counters: Model<CounterDocument>,
    @InjectModel(Service.name) private readonly services: Model<ServiceDocument>,
    @InjectModel(Product.name) private readonly products: Model<ProductDocument>,
    @InjectModel(Package.name) private readonly packages: Model<PackageDocument>,
    @InjectModel(SubscriptionPlan.name) private readonly subscriptionPlans: Model<SubscriptionPlanDocument>,
    @InjectModel(Branch.name) private readonly branches: Model<BranchDocument>,
    @InjectModel(Membership.name) private readonly memberships: Model<MembershipDocument>,
    @InjectModel(Customer.name) private readonly customers: Model<CustomerDocument>,
    @InjectModel(Appointment.name) private readonly appts: Model<AppointmentDocument>,
    @InjectModel(Coupon.name) private readonly coupons: Model<CouponDocument>,
    @InjectModel(GiftCard.name) private readonly giftCards: Model<GiftCardDocument>,
    @InjectModel(GiftCardLedgerEntry.name) private readonly giftCardLedger: Model<GiftCardLedgerEntryDocument>,
    @InjectModel(LoyaltyAccount.name) private readonly loyaltyAccounts: Model<LoyaltyAccountDocument>,
    @InjectModel(LoyaltyLedgerEntry.name) private readonly loyaltyLedger: Model<LoyaltyLedgerEntryDocument>,
    @InjectModel(Referral.name) private readonly referrals: Model<ReferralDocument>,
    @InjectModel(StaffEarningEntry.name) private readonly staffEarnings: Model<StaffEarningEntryDocument>,
    private readonly ctx: RequestContextService,
    private readonly gateway: PaymentGateway,
    private readonly eventBus: EventBus,
  ) {}

  private scope(): { tenantId: Types.ObjectId; branchId: Types.ObjectId; userId: string | null } {
    const c = this.ctx.get();
    if (!c?.tenantId || !c?.branchId) throw new ForbiddenException('active tenant + branch required');
    return {
      tenantId: new Types.ObjectId(c.tenantId),
      branchId: new Types.ObjectId(c.branchId),
      userId: c.userId ?? null,
    };
  }

  // `opts.allowSubscriptionLines` is set ONLY by SubscriptionsService.renew() —
  // the public POST /sales DTO can never request kind:'subscription' (see
  // saleLineInputSchema), so a bare checkout can't take money for a plan
  // without going through the renew flow that actually advances the
  // subscription's billing period alongside it.
  async checkout(
    dto: CreateSale,
    idempotencyKey: string | null,
    opts?: { allowSubscriptionLines?: boolean },
  ): Promise<CheckoutResult> {
    const { tenantId, branchId, userId } = this.scope();

    // Idempotency fast-path: a replayed key returns the original sale unchanged —
    // no second capture, no second stock decrement. The DB unique index below is
    // the hard guarantee if two identical requests race past this check.
    if (idempotencyKey) {
      const prior = await this.sales.findOne({ tenantId, idempotencyKey }).exec();
      if (prior) return { sale: prior, wasReplayed: true };
    }

    const branch = await this.getBranch(tenantId, branchId);
    const vatRateBps = branch.vatRateBps ?? 0;
    const customerId = await this.resolveCustomer(tenantId, dto.customerId);
    const appointmentId = await this.resolveAppointment(tenantId, branchId, dto.appointmentId);

    const { lines: resolved, productQtys } = await this.buildLines(
      tenantId,
      dto.lines,
      vatRateBps,
      opts?.allowSubscriptionLines ?? false,
    );
    let pricingLines = resolved.map((r) => r.pricing);

    let coupon: CouponDocument | null = null;
    let couponChangedDiscount = false;
    if (dto.couponCode) {
      coupon = await this.validateCoupon(tenantId, dto.couponCode, pricingLines);
      const beforeCoupon = pricingLines;
      pricingLines = applyCoupon(pricingLines, {
        type: coupon.type,
        value: coupon.value,
        maxDiscount: coupon.maxDiscount ?? undefined,
      });
      couponChangedDiscount = pricingLines !== beforeCoupon;
    }

    const totals = saleTotals(pricingLines, money(dto.tip));
    const lines: SaleLine[] = resolved.map((r, i) => {
      const p = pricingLines[i]!;
      const t = lineTotals(p);
      return {
        kind: r.kind,
        refId: r.refId,
        name: { en: r.name.en, bn: r.name.bn ?? undefined },
        unitPrice: embed(p.unitPrice.amount),
        quantity: p.quantity,
        discount: embed(t.discount.amount),
        taxable: p.taxable,
        taxRateBps: p.taxable ? p.taxRateBps : 0,
        tax: embed(t.tax.amount),
        lineTotal: embed(t.total.amount),
        staffId: r.staffId,
      } as SaleLine;
    });

    const saleId = new Types.ObjectId();

    const session = await this.conn.startSession();
    try {
      await session.withTransaction(async () => {
        // The invoice counter increment lives INSIDE the transaction: if the
        // transaction aborts for any reason, the number is rolled back with it
        // instead of being permanently burned (a gap in the invoice sequence).
        const invoiceNumber = await this.nextInvoiceNumber(tenantId, session);

        // Payment capture (incl. gift-card/loyalty ledger debits) happens INSIDE
        // the transaction: if the sale never commits, a customer's balance must
        // never have been touched either.
        const payments = await this.capturePayments(
          dto.payments,
          invoiceNumber,
          tenantId,
          customerId,
          saleId,
          session,
        );
        const captured = amountCaptured(
          payments.map((p) => ({ amount: money(p.amount.amount), captured: p.status === 'captured' })),
        );

        await this.sales.create(
          [
            {
              _id: saleId,
              tenantId,
              branchId,
              customerId,
              appointmentId,
              invoiceNumber,
              lines,
              subtotal: embed(totals.subtotal.amount),
              discountTotal: embed(totals.discountTotal.amount),
              taxTotal: embed(totals.taxTotal.amount),
              tip: embed(totals.tip.amount),
              total: embed(totals.total.amount),
              payments,
              paymentStatus: salePaymentStatus(totals.total, captured),
              status: 'completed',
              soldByUserId: userId ? new Types.ObjectId(userId) : null,
              idempotencyKey,
              couponCode: coupon?.code ?? null,
              note: dto.note ?? null,
            },
          ] as never,
          { session },
        );

        for (const [productId, qty] of productQtys) {
          const pid = new Types.ObjectId(productId);
          // Guard the decrement in the FILTER (invariant #2: stock is never
          // allowed to go negative), exactly like the loyalty/gift-card debits.
          // A no-match means one of two things, disambiguated below.
          const res = await this.stock
            .updateOne(
              { tenantId, branchId, productId: pid, qtyOnHand: { $gte: qty } },
              { $inc: { qtyOnHand: -qty } },
              { session },
            )
            .exec();
          if (res.matchedCount === 0) {
            const tracked = await this.stock
              .findOne({ tenantId, branchId, productId: pid })
              .session(session)
              .exec();
            // A tracked product with insufficient on-hand must block the sale;
            // an untracked product (no stock row at all) is not inventory-managed
            // and stays sellable — preserving prior behavior for un-stocked items.
            // ponytail: block oversell on tracked rows; Phase 7 can add a
            // per-branch "allow backorder" toggle if a business ever needs it.
            if (tracked) throw new ConflictException(`insufficient stock for product ${productId}`);
          }
        }

        // Only claim a redemption slot if the coupon actually changed anything —
        // a coupon applied to an already-fully-discounted (zero-net) cart is a
        // no-op and must not burn a limited-use code for zero benefit.
        if (coupon && couponChangedDiscount) {
          const claimed = await claimCouponRedemption(this.coupons, { tenantId, couponId: coupon._id }, session);
          if (!claimed) throw new ConflictException('this coupon just reached its redemption limit');
        }
      });
    } catch (err) {
      // A concurrent replay of the same idempotency key lost the race — return
      // the sale the winner created rather than surfacing the duplicate error.
      if (isDuplicateKeyError(err) && idempotencyKey) {
        const winner = await this.sales.findOne({ tenantId, idempotencyKey }).exec();
        if (winner) return { sale: winner, wasReplayed: true };
        throw new ConflictException('duplicate checkout');
      }
      throw err;
    } finally {
      await session.endSession();
    }

    this.eventBus.publish(new SaleCompleted(String(tenantId), String(branchId), String(saleId)));
    const created = await this.sales.findById(saleId).exec();
    if (!created) throw new NotFoundException('sale');
    return { sale: created, wasReplayed: false };
  }

  async addPayments(id: string, paymentsIn: PaymentInputDto[], idempotencyKey: string | null): Promise<SaleDocument> {
    const { tenantId, branchId } = this.scope();

    // A gift-card/loyalty debit and the sale update that records it commit
    // together — the same all-or-nothing guarantee checkout() gives. `sale` is
    // fetched FRESH inside the callback (not reused across a possible driver
    // retry of this transaction) so a retried attempt never re-pushes payments
    // onto an array that already reflects a rolled-back prior attempt.
    const session = await this.conn.startSession();
    try {
      await session.withTransaction(async () => {
        const sale = await this.sales
          .findOne({ _id: new Types.ObjectId(id), tenantId, branchId, deletedAt: null })
          .session(session)
          .exec();
        if (!sale) throw new NotFoundException('sale not found');
        if (sale.status === 'voided') throw new BadRequestException('cannot pay a voided sale');

        // Durable (DB-persisted, not just Redis) idempotency: a replayed request
        // with the same key is a no-op once its payment is already recorded.
        if (idempotencyKey && sale.payments.some((p) => p.idempotencyKey === idempotencyKey)) {
          return;
        }

        const captured = await this.capturePayments(
          paymentsIn,
          sale.invoiceNumber,
          tenantId,
          sale.customerId,
          sale._id as Types.ObjectId,
          session,
        );
        const stamped = captured.map((p) => ({ ...p, idempotencyKey: idempotencyKey ?? null }));
        sale.payments.push(...(stamped as Payment[]));
        sale.paymentStatus = salePaymentStatus(
          money(sale.total.amount),
          amountCaptured(
            sale.payments.map((p) => ({ amount: money(p.amount.amount), captured: p.status === 'captured' })),
          ),
        );
        await sale.save({ session });
      });
    } finally {
      await session.endSession();
    }
    return this.get(id);
  }

  async voidSale(id: string, reason?: string): Promise<SaleDocument> {
    const { tenantId, branchId } = this.scope();

    const session = await this.conn.startSession();
    try {
      await session.withTransaction(async () => {
        // Atomic status-transition guard: only ONE void attempt can ever match
        // status:'completed' and win this update. A concurrent or duplicated
        // void request (or a driver retry of THIS attempt) finds nothing to
        // match and falls into the branch below instead of reversing balances
        // or stock a second time. `new: false` returns the PRE-update snapshot,
        // so "which payments were captured" is read once, from the database,
        // inside this exact attempt — never from a JS object mutated by an
        // earlier (possibly since-rolled-back) invocation of this callback.
        const before = await this.sales
          .findOneAndUpdate(
            { _id: new Types.ObjectId(id), tenantId, branchId, status: 'completed', deletedAt: null },
            { $set: { status: 'voided', voidReason: reason ?? null, paymentStatus: 'unpaid' } },
            { session, new: false },
          )
          .exec();
        if (!before) {
          const exists = await this.sales
            .findOne({ _id: new Types.ObjectId(id), tenantId, branchId, deletedAt: null })
            .session(session)
            .exec();
          if (!exists) throw new NotFoundException('sale not found');
          throw new BadRequestException('sale is already voided');
        }

        for (const l of before.lines) {
          if (l.kind !== 'product') continue;
          await this.stock
            .updateOne(
              { tenantId, branchId, productId: l.refId },
              { $inc: { qtyOnHand: l.quantity } },
              { session },
            )
            .exec();
        }

        // Gift cards: one reversal per captured gift_card payment (a sale can
        // reference more than one distinct card). Loyalty: aggregated into ONE
        // reversal — a sale can have multiple captured loyalty payments (one at
        // checkout, another later via addPayments), and loyaltyPointsForRedemption
        // only accepts whole-taka amounts, so summing first (rather than
        // converting each payment individually) avoids rejecting a legitimately
        // captured combination whose individual amounts aren't each a multiple
        // of 100 poisha even though their sum is.
        const capturedPayments = before.payments.filter((p) => p.status === 'captured');

        for (const p of capturedPayments) {
          if (p.method !== 'gift_card' || !p.providerRef) continue;
          const card = await this.giftCards
            .findOneAndUpdate(
              { tenantId, code: p.providerRef },
              { $inc: { 'balance.amount': p.amount.amount } },
              { new: true, session },
            )
            .exec();
          if (card) {
            await this.giftCardLedger.create(
              [
                {
                  tenantId,
                  giftCardId: card._id,
                  type: 'adjust',
                  amount: { amount: p.amount.amount, currency: 'BDT' },
                  saleId: before._id,
                  note: 'void reversal',
                },
              ] as never,
              { session },
            );
          }
        }

        const loyaltyReversalAmount = capturedPayments
          .filter((p) => p.method === 'loyalty')
          .reduce((n, p) => n + p.amount.amount, 0);
        if (loyaltyReversalAmount > 0 && before.customerId) {
          const points = loyaltyPointsForRedemption(loyaltyReversalAmount);
          const acct = await this.loyaltyAccounts
            .findOneAndUpdate(
              { tenantId, customerId: before.customerId },
              { $inc: { balance: points } },
              { new: true, upsert: true, session },
            )
            .exec();
          await this.loyaltyLedger.create(
            [
              {
                tenantId,
                accountId: acct._id,
                customerId: before.customerId,
                type: 'adjust',
                points,
                saleId: before._id,
                note: 'void reversal',
              },
            ] as never,
            { session },
          );
        }

        // Loyalty EARN + referral-reward clawback: synchronous, same asymmetry
        // as the commission/tip reversal below. The customer's points earned FOR
        // this sale (and any referral reward its completion triggered) are
        // credited post-commit by the async SaleCompletedHandler, so — like
        // commission — they can only be reversed here, inside the void
        // transaction. A void that beats the earn handler reverses nothing here,
        // but the handler's sale.status guard then prevents the earn ever landing.
        await reverseLoyaltyEarnForSale(
          { accounts: this.loyaltyAccounts, ledger: this.loyaltyLedger },
          { tenantId, saleId: before._id },
          session,
        );
        await reverseReferralRewardForSale(
          { referrals: this.referrals, accounts: this.loyaltyAccounts, ledger: this.loyaltyLedger },
          { tenantId, saleId: before._id },
          session,
        );

        // Commission/tip clawback: synchronous, not via the async SaleVoided
        // event — see hr/ledger.util.ts for why a dropped clawback (unlike a
        // delayed earn) isn't self-correcting.
        await reverseStaffEarningsForSale(this.staffEarnings, { tenantId, saleId: before._id }, session);

        // Flip every captured payment to 'reversed' in one atomic array update —
        // no in-memory reconstruction of the payments array to save.
        await this.sales
          .updateOne(
            { _id: before._id },
            { $set: { 'payments.$[elem].status': 'reversed' } },
            { session, arrayFilters: [{ 'elem.status': 'captured' }] },
          )
          .exec();
      });
    } finally {
      await session.endSession();
    }

    this.eventBus.publish(new SaleVoided(String(tenantId), String(branchId), id));
    const result = await this.sales.findById(id).exec();
    if (!result) throw new NotFoundException('sale');
    return result;
  }

  async list(filter: { date?: string; status?: string }): Promise<SaleDocument[]> {
    const { tenantId, branchId } = this.scope();
    const q: Record<string, unknown> = { tenantId, branchId, deletedAt: null };
    if (filter.status) q.status = filter.status;
    if (filter.date) {
      const branch = await this.branches.findOne({ _id: branchId, tenantId, deletedAt: null }).exec();
      const { start, end } = dayRangeUtc(filter.date, branch?.timezone ?? 'Asia/Dhaka');
      q.createdAt = { $gte: start, $lte: end };
    }
    return this.sales.find(q).sort({ createdAt: -1 }).limit(500).exec();
  }

  async get(id: string): Promise<SaleDocument> {
    const { tenantId, branchId } = this.scope();
    const sale = await this.sales
      .findOne({ _id: new Types.ObjectId(id), tenantId, branchId, deletedAt: null })
      .exec();
    if (!sale) throw new NotFoundException('sale not found');
    return sale;
  }

  /** Read-only lookup for callers (e.g. SubscriptionsService) that need to know
   * whether a sale already exists for a given idempotency key. */
  async findByIdempotencyKey(idempotencyKey: string): Promise<SaleDocument | null> {
    const { tenantId } = this.scope();
    return this.sales.findOne({ tenantId, idempotencyKey }).exec();
  }

  // Daily totals for the sales view (completed sales only; voided excluded).
  async summary(date?: string): Promise<{
    date: string | null;
    count: number;
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    tip: number;
    total: number;
    byMethod: Record<string, number>;
  }> {
    const sales = await this.list({ date, status: 'completed' });
    const byMethod: Record<string, number> = {};
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let tip = 0;
    let total = 0;
    for (const s of sales) {
      subtotal += s.subtotal.amount;
      discountTotal += s.discountTotal.amount;
      taxTotal += s.taxTotal.amount;
      tip += s.tip.amount;
      total += s.total.amount;
      for (const p of s.payments) {
        if (p.status === 'captured') byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount.amount;
      }
    }
    return { date: date ?? null, count: sales.length, subtotal, discountTotal, taxTotal, tip, total, byMethod };
  }

  // ---- helpers ----

  private async getBranch(tenantId: Types.ObjectId, branchId: Types.ObjectId): Promise<BranchDocument> {
    const b = await this.branches.findOne({ _id: branchId, tenantId, deletedAt: null }).exec();
    if (!b) throw new NotFoundException('branch not found');
    return b;
  }

  private async resolveCustomer(
    tenantId: Types.ObjectId,
    customerId?: string,
  ): Promise<Types.ObjectId | null> {
    if (!customerId) return null;
    const c = await this.customers
      .findOne({ _id: new Types.ObjectId(customerId), tenantId, deletedAt: null })
      .exec();
    if (!c) throw new BadRequestException('unknown customer');
    return new Types.ObjectId(String(c._id));
  }

  private async resolveAppointment(
    tenantId: Types.ObjectId,
    branchId: Types.ObjectId,
    appointmentId?: string,
  ): Promise<Types.ObjectId | null> {
    if (!appointmentId) return null;
    const a = await this.appts
      .findOne({ _id: new Types.ObjectId(appointmentId), tenantId, branchId, deletedAt: null })
      .exec();
    if (!a) throw new BadRequestException('unknown appointment');
    return new Types.ObjectId(String(a._id));
  }

  private async validateCoupon(
    tenantId: Types.ObjectId,
    codeIn: string,
    pricingLines: SaleLineInput[],
  ): Promise<CouponDocument> {
    const code = codeIn.trim().toUpperCase();
    const coupon = await this.coupons.findOne({ tenantId, code, active: true, deletedAt: null }).exec();
    if (!coupon) throw new BadRequestException('unknown or inactive coupon code');
    const now = new Date();
    if (coupon.activeFrom && now < coupon.activeFrom) throw new BadRequestException('coupon is not active yet');
    if (coupon.activeUntil && now > coupon.activeUntil) throw new BadRequestException('coupon has expired');
    const pre = saleTotals(pricingLines);
    const preCouponNet = pre.subtotal.amount - pre.discountTotal.amount;
    if (preCouponNet < coupon.minSpend) {
      throw new BadRequestException(`this coupon requires a minimum spend of ${coupon.minSpend} poisha`);
    }
    return coupon;
  }

  private async buildLines(
    tenantId: Types.ObjectId,
    linesIn: CreateSale['lines'],
    vatRateBps: number,
    allowSubscriptionLines: boolean,
  ): Promise<{ lines: ResolvedLine[]; productQtys: Map<string, number> }> {
    const lines: ResolvedLine[] = [];
    const productQtys = new Map<string, number>();

    for (const li of linesIn) {
      const refId = new Types.ObjectId(li.refId);
      const kind = li.kind as SaleLineKind;
      let name: { en: string; bn?: string | null };
      let unitAmount: number;
      let taxable: boolean;

      if (kind === 'service') {
        const s = await this.services.findOne({ _id: refId, tenantId, deletedAt: null }).exec();
        if (!s) throw new BadRequestException('unknown service');
        name = s.name;
        unitAmount = s.price.amount;
        taxable = s.taxable;
      } else if (kind === 'product') {
        const p = await this.products.findOne({ _id: refId, tenantId, deletedAt: null }).exec();
        if (!p) throw new BadRequestException('unknown product');
        name = p.name;
        unitAmount = p.retailPrice.amount;
        taxable = p.taxable;
        productQtys.set(li.refId, (productQtys.get(li.refId) ?? 0) + li.quantity);
      } else if (kind === 'package') {
        const pk = await this.packages.findOne({ _id: refId, tenantId, deletedAt: null }).exec();
        if (!pk) throw new BadRequestException('unknown package');
        name = pk.name;
        unitAmount = pk.price.amount;
        taxable = true; // a bundle is taxed as a whole at the branch rate
      } else {
        // A subscription-plan renewal fee. Only reachable via
        // SubscriptionsService.renew() (opts.allowSubscriptionLines) — the
        // public checkout DTO's Zod schema never accepts this kind, so a plain
        // POST /sales can't take a subscription payment without also going
        // through the flow that advances the subscription's billing period.
        if (!allowSubscriptionLines) {
          throw new BadRequestException('subscription lines cannot be created directly');
        }
        const plan = await this.subscriptionPlans.findOne({ _id: refId, tenantId, deletedAt: null }).exec();
        if (!plan) throw new BadRequestException('unknown subscription plan');
        name = plan.name;
        unitAmount = plan.price.amount;
        taxable = true;
      }

      if (li.staffId) await this.assertStaffMember(tenantId, li.staffId);

      lines.push({
        kind,
        refId,
        name,
        staffId: li.staffId ? new Types.ObjectId(li.staffId) : null,
        pricing: {
          unitPrice: money(unitAmount),
          quantity: li.quantity,
          discount: money(li.discount),
          taxable,
          taxRateBps: vatRateBps,
        },
      });
    }
    return { lines, productQtys };
  }

  private async assertStaffMember(tenantId: Types.ObjectId, staffId: string): Promise<void> {
    const m = await this.memberships
      .findOne({ tenantId, userId: new Types.ObjectId(staffId), status: 'active' })
      .exec();
    if (!m) throw new BadRequestException('attributed staff is not an active member');
  }

  // Captures every requested payment. Gift-card and loyalty payments debit a
  // real ledger balance (never negative — see ledger.util.ts); everything else
  // goes through the sandbox PaymentGateway. All loyalty-method entries in one
  // request are aggregated into a SINGLE debit (one customer has one account,
  // so there is nothing to gain from N separate debits).
  private async capturePayments(
    paymentsIn: PaymentInputDto[],
    invoiceNumber: string,
    tenantId: Types.ObjectId,
    customerId: Types.ObjectId | null,
    saleId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<Payment[]> {
    const loyaltyTotal = paymentsIn.filter((p) => p.method === 'loyalty').reduce((n, p) => n + p.amount, 0);
    let loyaltyCaptured = false;
    if (loyaltyTotal > 0) {
      if (!customerId) throw new BadRequestException('loyalty redemption requires a customer on the sale');
      let points: number;
      try {
        points = loyaltyPointsForRedemption(loyaltyTotal);
      } catch {
        throw new BadRequestException('loyalty redemption must be a whole-taka amount (multiples of 100 poisha)');
      }
      const result = await debitLoyalty(
        { accounts: this.loyaltyAccounts, ledger: this.loyaltyLedger },
        { tenantId, customerId, points, type: 'redeem', saleId },
        session,
      );
      if (!result) throw new BadRequestException('insufficient loyalty balance');
      loyaltyCaptured = true;
    }

    const out: Payment[] = [];
    for (const p of paymentsIn) {
      if (p.method === 'loyalty') {
        out.push({
          method: 'loyalty',
          amount: embed(p.amount),
          status: loyaltyCaptured ? 'captured' : 'failed',
          providerRef: null,
          capturedAt: loyaltyCaptured ? new Date() : null,
        } as Payment);
        continue;
      }
      if (p.method === 'gift_card') {
        if (!p.providerRef) {
          throw new BadRequestException('a gift_card payment requires the card code in providerRef');
        }
        const card = await debitGiftCard(
          { cards: this.giftCards, ledger: this.giftCardLedger },
          { tenantId, code: p.providerRef, amountMinor: p.amount, saleId },
          session,
        );
        if (!card) {
          throw new BadRequestException(
            `gift card ${p.providerRef} is unknown, inactive, expired, or has insufficient balance`,
          );
        }
        out.push({
          method: 'gift_card',
          amount: embed(p.amount),
          status: 'captured',
          providerRef: p.providerRef,
          capturedAt: new Date(),
        } as Payment);
        continue;
      }
      // NOTE for Phase 14 (real bKash/card/SSLCommerz SDKs replacing this
      // sandbox): this call runs inside a retryable session.withTransaction
      // callback. MongoDB may re-invoke the whole callback on a transient
      // write conflict (e.g. from the coupon/stock/ledger writes elsewhere in
      // this same transaction), which would re-issue a real charge. A future
      // real provider must be called with a provider-side idempotency key
      // (most gateway SDKs support one) so a driver-level retry can't double-charge.
      const res = await this.gateway.charge(p.method, {
        amountMinor: p.amount,
        reference: invoiceNumber,
        providerRef: p.providerRef,
      });
      out.push({
        method: p.method,
        amount: embed(p.amount),
        status: res.status,
        providerRef: res.providerRef,
        capturedAt: res.status === 'captured' ? new Date() : null,
      } as Payment);
    }
    return out;
  }

  private async nextInvoiceNumber(tenantId: Types.ObjectId, session: ClientSession): Promise<string> {
    const c = await this.counters
      .findOneAndUpdate(
        { key: `${String(tenantId)}:invoice` },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, session },
      )
      .exec();
    return `INV-${String(c.seq).padStart(6, '0')}`;
  }
}
