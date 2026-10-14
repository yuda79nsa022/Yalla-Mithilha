import { PaymentProviderError } from './errors';
import type {
  CreateCheckoutInput,
  PaymentLookupKey,
  PaymentProvider,
  ProviderPaymentStatus,
} from './provider';

/**
 * MyFatoorah (v2 REST API), the KNET/card gateway for Kuwait.
 *
 * Checkout: `SendPayment` with NotificationOption "LNK" creates an invoice
 * and returns its hosted payment page (`InvoiceURL`), which the player is
 * sent to. Our own payment id travels as `CustomerReference`, and the
 * invoice's `InvoiceId` is stored as the payment's provider_ref.
 *
 * Result: MyFatoorah sends the player back to our CallBackUrl/ErrorUrl with
 * `?paymentId=…`, and can also call our webhook. Neither is trusted as-is —
 * both only trigger `lookupPayment`, a `GetPaymentStatus` call made with our
 * secret API key, whose answer is the only thing that ever marks a payment
 * paid (see settle.ts).
 *
 * Base URLs: https://apitest.myfatoorah.com (sandbox, the default) and
 * https://api.myfatoorah.com (live, Kuwait).
 */
export class MyFatoorahProvider implements PaymentProvider {
  readonly name = 'myfatoorah';
  readonly redirects = true;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly returnUrl: string;

  constructor(config: { apiKey: string; baseUrl: string; publicBaseUrl: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.returnUrl = `${config.publicBaseUrl.replace(/\/+$/, '')}/charades/checkout/myfatoorah/return`;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<{ redirectUrl: string; providerRef: string }> {
    const data = await this.call<{ InvoiceId?: number | string; InvoiceURL?: string }>('/v2/SendPayment', {
      NotificationOption: 'LNK',
      CustomerName: input.customerName,
      InvoiceValue: input.amountFils / 1000,
      DisplayCurrencyIso: input.currency,
      CustomerReference: input.paymentId,
      CallBackUrl: this.returnUrl,
      ErrorUrl: this.returnUrl,
      Language: input.language,
    });
    if (data.InvoiceId === undefined || !data.InvoiceURL) {
      throw new PaymentProviderError('MyFatoorah did not return an invoice');
    }
    return { redirectUrl: data.InvoiceURL, providerRef: String(data.InvoiceId) };
  }

  async lookupPayment(key: PaymentLookupKey): Promise<ProviderPaymentStatus> {
    const body = 'invoiceId' in key ? { Key: key.invoiceId, KeyType: 'InvoiceId' } : { Key: key.paymentId, KeyType: 'PaymentId' };
    const data = await this.call<{
      InvoiceId?: number | string;
      InvoiceStatus?: string;
      InvoiceValue?: number;
      CustomerReference?: string | null;
    }>('/v2/GetPaymentStatus', body);
    if (data.InvoiceId === undefined) throw new PaymentProviderError('MyFatoorah did not return an invoice');

    const invoiceStatus = (data.InvoiceStatus ?? '').toLowerCase();
    return {
      status: invoiceStatus === 'paid' ? 'paid' : invoiceStatus === 'canceled' || invoiceStatus === 'expired' ? 'failed' : 'pending',
      providerRef: String(data.InvoiceId),
      reference: data.CustomerReference ?? null,
      amountFils: typeof data.InvoiceValue === 'number' ? Math.round(data.InvoiceValue * 1000) : null,
    };
  }

  private async call<T>(path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new PaymentProviderError(`MyFatoorah request failed: ${(err as Error).message}`);
    }
    const json = (await res.json().catch(() => null)) as {
      IsSuccess?: boolean;
      Message?: string;
      ValidationErrors?: { Name?: string; Error?: string }[] | null;
      Data?: T;
    } | null;
    if (!res.ok || !json?.IsSuccess || !json.Data) {
      const details = (json?.ValidationErrors ?? []).map((e) => `${e.Name}: ${e.Error}`).join('; ');
      throw new PaymentProviderError(
        `MyFatoorah ${path} failed (HTTP ${res.status}): ${json?.Message ?? 'no message'}${details ? ` — ${details}` : ''}`
      );
    }
    return json.Data;
  }
}
