import { confirmPayment, failPayment, getPayment } from '../db';
import type { PaymentRow } from '../types';
import { getPaymentProvider, type PaymentLookupKey } from './provider';

export type SettleOutcome = 'paid' | 'pending' | 'failed';

export interface SettleResult {
  /** Our payment, or `null` when the gateway's answer matched none of ours. */
  payment: PaymentRow | null;
  outcome: SettleOutcome;
}

/**
 * The one place a real gateway's payment gets marked paid or failed. Called
 * from the player's return redirect, the gateway's webhook and the app's own
 * "check again" — none of which is trusted by itself: whatever key they
 * carry is only used to ask the gateway (authenticated with our secret API
 * key), and only its answer counts. The answer must also:
 *   - name one of our payments (its CustomerReference) …
 *   - … whose stored provider_ref is this exact invoice, and
 *   - charge exactly that payment's amount,
 * before any credit is granted. `confirmPayment` is idempotent, so the
 * redirect and the webhook both arriving for one payment grant it once.
 */
export async function settleFromProvider(key: PaymentLookupKey): Promise<SettleResult> {
  const provider = getPaymentProvider();
  if (!provider.lookupPayment) return { payment: null, outcome: 'pending' };

  const status = await provider.lookupPayment(key);
  const payment = status.reference ? getPayment(status.reference) : null;
  if (!payment || payment.provider !== provider.name || payment.providerRef !== status.providerRef) {
    // eslint-disable-next-line no-console
    console.error(`payment gateway invoice ${status.providerRef} matches none of our payments — ignored`);
    return { payment: null, outcome: 'pending' };
  }

  if (status.status === 'paid') {
    if (status.amountFils !== payment.amountFils) {
      // Never credit a payment for a different amount than was charged —
      // that needs a person to look at it.
      // eslint-disable-next-line no-console
      console.error(
        `payment ${payment.id}: gateway reports ${status.amountFils} fils paid, expected ${payment.amountFils} — NOT credited`
      );
      return { payment, outcome: 'pending' };
    }
    return outcomeOf(confirmPayment(payment.id).payment);
  }
  if (status.status === 'failed') return outcomeOf(failPayment(payment.id));
  return outcomeOf(payment);
}

/** Reported from the row as it now stands — e.g. a late "failed" never un-pays a payment already confirmed. */
function outcomeOf(payment: PaymentRow): SettleResult {
  const outcome: SettleOutcome = payment.status === 'paid' ? 'paid' : payment.status === 'initiated' ? 'pending' : 'failed';
  return { payment, outcome };
}
