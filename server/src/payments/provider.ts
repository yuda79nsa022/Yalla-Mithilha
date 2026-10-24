import { MyFatoorahProvider } from './myfatoorah';

/**
 * What the rest of the app knows about a payment provider. Wallet checkout
 * logic (routes, credit issuance) is written against this interface only —
 * never against a specific provider's SDK.
 *
 * A real gateway (`redirects: true`) never trusts the player's own device or
 * an inbound callback to say a payment succeeded: every confirmation goes
 * through `lookupPayment`, an authenticated server-to-server call to the
 * gateway itself (see payments/settle.ts).
 */
export interface PaymentProvider {
  readonly name: string;
  /**
   * true for a real gateway: the player pays on the gateway's own page and
   * the result arrives via `lookupPayment`. false for the mock, whose
   * checkout screen confirms/fails the payment directly.
   */
  readonly redirects: boolean;
  createCheckout(input: CreateCheckoutInput): Promise<{ redirectUrl?: string; providerRef?: string }>;
  /** Asks the gateway itself for a payment's current state. Only real gateways implement this. */
  lookupPayment?(key: PaymentLookupKey): Promise<ProviderPaymentStatus>;
}

export interface CreateCheckoutInput {
  /** Our own payments.id — handed to the gateway so its answer can be matched back to exactly this payment. */
  paymentId: string;
  amountFils: number;
  currency: string;
  customerName: string;
  language: 'ar' | 'en';
}

/** Which of the gateway's own ids to look a payment up by. */
export type PaymentLookupKey = { invoiceId: string } | { paymentId: string };

export interface ProviderPaymentStatus {
  /** 'paid' only once the gateway says the money was actually taken. */
  status: 'paid' | 'pending' | 'failed';
  /** The gateway's invoice id — must match the payment's stored provider_ref. */
  providerRef: string;
  /** Our own payments.id, as we handed it to the gateway at checkout; `null` if absent. */
  reference: string | null;
  /** What the gateway says was charged, in fils; `null` if it didn't say. */
  amountFils: number | null;
}

export { PaymentProviderError } from './errors';

/**
 * Stands in for a real payment gateway in development. There is no redirect
 * and no webhook — the checkout screen calls `confirm`/`fail` directly to
 * simulate what a real callback would do, which is enough to exercise every
 * code path against the same routes. Those routes are switched off whenever
 * a real gateway is configured.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  readonly redirects = false;

  async createCheckout(): Promise<{ redirectUrl?: string; providerRef?: string }> {
    return {};
  }
}

/**
 * Picks the provider from the environment:
 *   PAYMENT_PROVIDER=myfatoorah  needs MYFATOORAH_API_KEY and PUBLIC_BASE_URL
 *   anything else (or unset)     the mock — development only
 * A half-configured MyFatoorah setup fails loudly at startup rather than
 * quietly falling back to the mock, which would hand out free credits.
 */
export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): PaymentProvider {
  if (env.PAYMENT_PROVIDER === 'myfatoorah') {
    const apiKey = env.MYFATOORAH_API_KEY;
    const publicBaseUrl = env.PUBLIC_BASE_URL;
    if (!apiKey || !publicBaseUrl) {
      throw new Error('PAYMENT_PROVIDER=myfatoorah needs both MYFATOORAH_API_KEY and PUBLIC_BASE_URL to be set');
    }
    return new MyFatoorahProvider({
      apiKey,
      baseUrl: env.MYFATOORAH_BASE_URL || 'https://apitest.myfatoorah.com',
      publicBaseUrl,
    });
  }
  if (env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      'WARNING: using the MOCK payment provider in production — any player can confirm their own payment for free. Set PAYMENT_PROVIDER=myfatoorah.'
    );
  }
  return new MockPaymentProvider();
}

/**
 * Whether the mock may take "payments" here. A game is only ever playable
 * after a real gateway confirms the money, so a production server
 * (NODE_ENV=production) on the mock refuses checkout outright — unless
 * ALLOW_MOCK_PAYMENTS=true says, on purpose, that it's a test server.
 */
export function mockPaymentsAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.ALLOW_MOCK_PAYMENTS === 'true';
}

let current: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!current) current = providerFromEnv();
  return current;
}

/** Tests swap in a fake gateway; `null` goes back to reading the environment. */
export function setPaymentProviderForTests(provider: PaymentProvider | null): void {
  current = provider;
}
