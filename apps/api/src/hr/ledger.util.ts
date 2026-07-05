// Void-time reversal of commission/tip entries. Called SYNCHRONOUSLY inside
// sales.service.ts's voidSale() transaction — NOT via the async SaleVoided
// event — because a clawback that silently fails to happen is an overpayment
// that's hard to recover, unlike the forward creation path (best-effort via
// the SaleCompleted handler, matching the loyalty-earn precedent): a delayed
// or dropped EARN just means commission shows up a little late, which the
// next payroll run's no-lower-bound claim still picks up correctly. A
// dropped REVERSAL has no equivalent self-correction. Mirrors exactly how
// Phase 5 reverses loyalty/gift-card balances inside this same transaction
// (see sales.service.ts's voidSale()).
import type { ClientSession, Model, Types } from 'mongoose';
import { isDuplicateKeyError } from '../common/mongo.util.js';
import type { StaffEarningEntryDocument } from './schemas/staff-earning-entry.schema.js';

export async function reverseStaffEarningsForSale(
  earnings: Model<StaffEarningEntryDocument>,
  params: { tenantId: Types.ObjectId; saleId: Types.ObjectId },
  session: ClientSession,
): Promise<void> {
  const entries = await earnings
    .find({ tenantId: params.tenantId, saleId: params.saleId, reversalOfEntryId: null })
    .session(session)
    .exec();

  for (const e of entries) {
    try {
      await earnings.create(
        [
          {
            tenantId: e.tenantId,
            branchId: e.branchId,
            staffId: e.staffId,
            saleId: e.saleId,
            kind: e.kind,
            amountMinor: -e.amountMinor,
            rateBps: e.rateBps,
            reversalOfEntryId: e._id,
            note: 'reversal: sale voided',
          },
        ] as never,
        { session },
      );
    } catch (err) {
      // Idempotent against a transaction retry re-running this same pass —
      // the {tenantId, reversalOfEntryId} unique index makes a second
      // attempt's create a caught no-op rather than a duplicate.
      if (!isDuplicateKeyError(err)) throw err;
    }
  }
}
