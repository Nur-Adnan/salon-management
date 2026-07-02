import { Injectable } from '@nestjs/common';
import type { PaymentMethod } from '@salon/shared';
import { randomUUID } from 'node:crypto';

export interface ChargeInput {
  amountMinor: number;
  reference: string; // invoice number, passed to the provider
  providerRef?: string; // e.g. a pre-authorized terminal/txn id
}

export interface ChargeResult {
  status: 'captured' | 'pending' | 'failed';
  providerRef: string | null;
}

// Every payment rail implements this. Cash/card settle at the counter; the mobile
// wallets (bKash/Nagad/SSLCommerz) settle via redirect/callback in production —
// here they are SANDBOX adapters that auto-approve so the whole POS flow is
// exercisable end-to-end. Real SDK/HTTP calls + webhook capture are Phase 14.
// ponytail: sandbox auto-approve; swap the body for the provider SDK when live.
export interface PaymentProvider {
  readonly method: PaymentMethod;
  charge(input: ChargeInput): Promise<ChargeResult>;
}

class InstantProvider implements PaymentProvider {
  constructor(
    readonly method: PaymentMethod,
    private readonly refPrefix: string | null,
  ) {}

  charge(input: ChargeInput): Promise<ChargeResult> {
    const providerRef =
      input.providerRef ?? (this.refPrefix ? `${this.refPrefix}_${randomUUID()}` : null);
    return Promise.resolve({ status: 'captured', providerRef });
  }
}

// gift_card (redemption is Phase 5) and due (accounts receivable) are recorded but
// NOT captured — they never move a sale to 'paid' on their own.
class DeferredProvider implements PaymentProvider {
  constructor(readonly method: PaymentMethod) {}

  charge(input: ChargeInput): Promise<ChargeResult> {
    return Promise.resolve({ status: 'pending', providerRef: input.providerRef ?? null });
  }
}

@Injectable()
export class PaymentGateway {
  private readonly providers = new Map<PaymentMethod, PaymentProvider>();

  constructor() {
    for (const p of [
      new InstantProvider('cash', null),
      new InstantProvider('card', 'card'),
      new InstantProvider('bkash', 'bkash'),
      new InstantProvider('nagad', 'nagad'),
      new InstantProvider('sslcommerz', 'ssl'),
      new DeferredProvider('gift_card'),
      new DeferredProvider('due'),
    ]) {
      this.providers.set(p.method, p);
    }
  }

  charge(method: PaymentMethod, input: ChargeInput): Promise<ChargeResult> {
    const provider = this.providers.get(method);
    if (!provider) return Promise.resolve({ status: 'failed', providerRef: null });
    return provider.charge(input);
  }
}
