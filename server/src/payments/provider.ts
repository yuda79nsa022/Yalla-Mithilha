import type { ProductId } from '../types';

/**
 * What the rest of the app knows about a payment provider. Board-game
 * checkout logic (routes, credit issuance) is written against this
 * interface only — never against a specific provider's SDK — so swapping
 * `MockPaymentProvider` for a real `KnetPaymentProvider` later is an
 * isolated change, not a rearchitecture.
 *
 * A real provider (KNET direct, or an aggregator like MyFatoorah/Tap) would
 * additionally need to:
 *   - return a real `redirectUrl` from `createCheckout` for the client to
 *     open, instead of nothing;
 *   - expose a way to verify an inbound webhook's signature before this
 *     app ever calls `confirmPayment`/`failPayment` in db.ts — an
 *     unauthenticated route must never be trusted to mark a payment paid.
 */
export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: {
    paymentId: string;
    product: ProductId;
    amountFils: number;
    currency: string;
  }): Promise<{ redirectUrl?: string }>;
}

/**
 * Stands in for a real payment gateway until one is wired up. There is no
 * redirect and no webhook — the checkout screen calls `confirm`/`fail`
 * directly to simulate what a real callback would do, which is enough to
 * exercise every code path (success, failure, double-callback idempotency)
 * against the same routes a real provider will use.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async createCheckout(): Promise<{ redirectUrl?: string }> {
    return {};
  }
}

export const paymentProvider: PaymentProvider = new MockPaymentProvider();
