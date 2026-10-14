import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-myfatoorah-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import { creditBalance, db, getPayment, resetDbForTests, setGamePriceFils } from '../src/db';
import { PaymentProviderError } from '../src/payments/errors';
import { MyFatoorahProvider } from '../src/payments/myfatoorah';
import {
  providerFromEnv,
  setPaymentProviderForTests,
  type CreateCheckoutInput,
  type PaymentLookupKey,
  type PaymentProvider,
  type ProviderPaymentStatus,
} from '../src/payments/provider';
import { makePlayerSession } from './helpers/testAuth';

/* ------------------------------------------------ MyFatoorah API client */

describe('MyFatoorahProvider (HTTP client)', () => {
  const provider = new MyFatoorahProvider({
    apiKey: 'secret-key',
    baseUrl: 'https://apitest.myfatoorah.com/',
    publicBaseUrl: 'https://game.example.com/',
  });
  let fetchMock: jest.SpyInstance;

  function reply(status: number, json: unknown) {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(json), { status }));
  }

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());

  it('creates an invoice with SendPayment and returns its payment page', async () => {
    reply(200, { IsSuccess: true, Data: { InvoiceId: 4242, InvoiceURL: 'https://demo.myfatoorah.com/pay/4242' } });
    const out = await provider.createCheckout({
      paymentId: 'our-payment-1',
      amountFils: 1500,
      currency: 'KWD',
      customerName: 'player1',
      language: 'ar',
    });
    expect(out).toEqual({ redirectUrl: 'https://demo.myfatoorah.com/pay/4242', providerRef: '4242' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://apitest.myfatoorah.com/v2/SendPayment');
    expect(init.headers).toEqual({ Authorization: 'Bearer secret-key', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({
      NotificationOption: 'LNK',
      CustomerName: 'player1',
      InvoiceValue: 1.5,
      DisplayCurrencyIso: 'KWD',
      CustomerReference: 'our-payment-1',
      CallBackUrl: 'https://game.example.com/charades/checkout/myfatoorah/return',
      ErrorUrl: 'https://game.example.com/charades/checkout/myfatoorah/return',
      Language: 'ar',
    });
  });

  it.each([
    ['Paid', 'paid'],
    ['Pending', 'pending'],
    ['Canceled', 'failed'],
    ['Expired', 'failed'],
  ])('maps InvoiceStatus %s to %s', async (invoiceStatus, expected) => {
    reply(200, {
      IsSuccess: true,
      Data: { InvoiceId: 4242, InvoiceStatus: invoiceStatus, InvoiceValue: 1.5, CustomerReference: 'our-payment-1' },
    });
    const out = await provider.lookupPayment({ paymentId: '0707' });
    expect(out).toEqual({ status: expected, providerRef: '4242', reference: 'our-payment-1', amountFils: 1500 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ Key: '0707', KeyType: 'PaymentId' });
  });

  it('looks up by InvoiceId too', async () => {
    reply(200, { IsSuccess: true, Data: { InvoiceId: 9, InvoiceStatus: 'Pending', InvoiceValue: 2.25, CustomerReference: 'x' } });
    const out = await provider.lookupPayment({ invoiceId: '9' });
    expect(out.amountFils).toBe(2250);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ Key: '9', KeyType: 'InvoiceId' });
  });

  it('turns an API error, a bad envelope or a network failure into PaymentProviderError', async () => {
    reply(400, { IsSuccess: false, Message: 'Invalid data', ValidationErrors: [{ Name: 'InvoiceValue', Error: 'too low' }] });
    await expect(provider.lookupPayment({ invoiceId: '1' })).rejects.toThrow(/InvoiceValue: too low/);

    reply(200, { IsSuccess: true, Data: null });
    await expect(provider.lookupPayment({ invoiceId: '1' })).rejects.toBeInstanceOf(PaymentProviderError);

    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(provider.lookupPayment({ invoiceId: '1' })).rejects.toBeInstanceOf(PaymentProviderError);
  });
});

describe('providerFromEnv', () => {
  it('refuses a half-configured MyFatoorah setup instead of falling back to the mock', () => {
    expect(() => providerFromEnv({ PAYMENT_PROVIDER: 'myfatoorah', MYFATOORAH_API_KEY: 'k' } as NodeJS.ProcessEnv)).toThrow(
      /PUBLIC_BASE_URL/
    );
    const ok = providerFromEnv({
      PAYMENT_PROVIDER: 'myfatoorah',
      MYFATOORAH_API_KEY: 'k',
      PUBLIC_BASE_URL: 'https://x.example',
    } as NodeJS.ProcessEnv);
    expect(ok.name).toBe('myfatoorah');
    expect(providerFromEnv({} as NodeJS.ProcessEnv).name).toBe('mock');
  });
});

/* ------------------------------------------- checkout through the routes */

/** A stand-in gateway: invoices live in memory, and the test decides what each one's status is. */
class FakeGateway implements PaymentProvider {
  readonly name = 'myfatoorah';
  readonly redirects = true;
  invoices = new Map<string, { reference: string; gatewayPaymentId: string; status: ProviderPaymentStatus['status']; amountFils: number }>();
  lookups = 0;
  failCreate = false;
  private next = 1000;

  async createCheckout(input: CreateCheckoutInput) {
    if (this.failCreate) throw new PaymentProviderError('gateway down');
    const invoiceId = String(this.next++);
    this.invoices.set(invoiceId, {
      reference: input.paymentId,
      gatewayPaymentId: `0${invoiceId}`,
      status: 'pending',
      amountFils: input.amountFils,
    });
    return { redirectUrl: `https://pay.example/${invoiceId}`, providerRef: invoiceId };
  }

  async lookupPayment(key: PaymentLookupKey): Promise<ProviderPaymentStatus> {
    this.lookups++;
    const entry = [...this.invoices.entries()].find(([invoiceId, inv]) =>
      'invoiceId' in key ? invoiceId === key.invoiceId : inv.gatewayPaymentId === key.paymentId
    );
    if (!entry) throw new PaymentProviderError('no such invoice');
    const [invoiceId, inv] = entry;
    return { status: inv.status, providerRef: invoiceId, reference: inv.reference, amountFils: inv.amountFils };
  }
}

describe('checkout with a real gateway', () => {
  const app = createApp();
  let gateway: FakeGateway;

  beforeEach(() => {
    resetDbForTests();
    setGamePriceFils(1500);
    gateway = new FakeGateway();
    setPaymentProviderForTests(gateway);
  });
  afterAll(() => setPaymentProviderForTests(null));

  async function startCheckout() {
    const { auth, player } = await makePlayerSession();
    const res = await request(app).post('/charades/checkout').set(auth).send({ mode: 'classic', language: 'en' });
    expect(res.status).toBe(201);
    const invoiceId = res.body.providerRef as string;
    return { auth, player, paymentId: res.body.id as string, invoiceId, invoice: gateway.invoices.get(invoiceId)!, res };
  }

  it('checkout creates a gateway invoice and returns its payment page', async () => {
    const { res, invoiceId } = await startCheckout();
    expect(res.body.redirectUrl).toBe(`https://pay.example/${invoiceId}`);
    expect(res.body.status).toBe('initiated');
    expect(getPayment(res.body.id)?.providerRef).toBe(invoiceId);
  });

  it('the player can no longer confirm or fail their own payment', async () => {
    const { auth, player, paymentId } = await startCheckout();
    expect((await request(app).post(`/charades/checkout/${paymentId}/confirm`).set(auth)).status).toBe(403);
    expect((await request(app).post(`/charades/checkout/${paymentId}/fail`).set(auth)).status).toBe(403);
    expect(creditBalance(player.id)).toBe(0);
    expect(getPayment(paymentId)?.status).toBe('initiated');
  });

  it('a paid return credits exactly once, however many times the redirect and webhook arrive', async () => {
    const { player, paymentId, invoiceId, invoice } = await startCheckout();
    invoice.status = 'paid';

    const ret = await request(app).get(`/charades/checkout/myfatoorah/return?paymentId=${invoice.gatewayPaymentId}&Id=x`);
    expect(ret.status).toBe(303);
    expect(ret.headers.location).toBe(`/charades/checkout?payment=${paymentId}&result=paid`);

    await request(app).get(`/charades/checkout/myfatoorah/return?paymentId=${invoice.gatewayPaymentId}`);
    const hook = await request(app).post('/charades/checkout/myfatoorah/webhook').send({ EventType: 1, Data: { InvoiceId: Number(invoiceId) } });
    expect(hook.status).toBe(200);
    // Webhook v2's shape works too.
    await request(app).post('/charades/checkout/myfatoorah/webhook').send({ Data: { Invoice: { Id: invoiceId } } });

    expect(creditBalance(player.id)).toBe(1);
    expect(getPayment(paymentId)?.status).toBe('paid');
  });

  it('an unpaid return credits nothing and leaves the payment open', async () => {
    const { player, paymentId, invoice } = await startCheckout();
    const ret = await request(app).get(`/charades/checkout/myfatoorah/return?paymentId=${invoice.gatewayPaymentId}`);
    expect(ret.headers.location).toBe(`/charades/checkout?payment=${paymentId}&result=pending`);
    expect(creditBalance(player.id)).toBe(0);
    expect(getPayment(paymentId)?.status).toBe('initiated');
  });

  it('a cancelled or expired invoice marks the payment failed', async () => {
    const { paymentId, invoice } = await startCheckout();
    invoice.status = 'failed';
    const ret = await request(app).get(`/charades/checkout/myfatoorah/return?paymentId=${invoice.gatewayPaymentId}`);
    expect(ret.headers.location).toBe(`/charades/checkout?payment=${paymentId}&result=failed`);
    expect(getPayment(paymentId)?.status).toBe('failed');
  });

  it('never credits a payment for a different amount than the gateway charged', async () => {
    const { player, paymentId, invoice } = await startCheckout();
    invoice.status = 'paid';
    invoice.amountFils = 100;
    const ret = await request(app).get(`/charades/checkout/myfatoorah/return?paymentId=${invoice.gatewayPaymentId}`);
    expect(ret.headers.location).toBe(`/charades/checkout?payment=${paymentId}&result=pending`);
    expect(creditBalance(player.id)).toBe(0);
  });

  it("a gateway invoice that doesn't match the payment's stored invoice id is ignored", async () => {
    const victim = await startCheckout();
    // A second, paid invoice claiming to be the victim's payment.
    gateway.invoices.set('6666', { reference: victim.paymentId, gatewayPaymentId: '06666', status: 'paid', amountFils: 1500 });
    const ret = await request(app).get('/charades/checkout/myfatoorah/return?paymentId=06666');
    expect(ret.headers.location).toBe('/charades/checkout?result=error');
    expect(creditBalance(victim.player.id)).toBe(0);
  });

  it('a forged webhook credits nothing — only the gateway itself is believed', async () => {
    const { player, invoiceId } = await startCheckout(); // still unpaid at the gateway
    const forged = await request(app)
      .post('/charades/checkout/myfatoorah/webhook')
      .send({ Data: { InvoiceId: invoiceId, TransactionStatus: 'SUCCESS', InvoiceValueInBaseCurrency: 1.5 } });
    expect(forged.status).toBe(200);
    expect(creditBalance(player.id)).toBe(0);

    const unknown = await request(app).post('/charades/checkout/myfatoorah/webhook').send({ Data: { InvoiceId: 999999 } });
    expect(unknown.status).toBe(500); // the gateway knows no such invoice; MyFatoorah would retry
    expect((await request(app).post('/charades/checkout/myfatoorah/webhook').send({ nope: true })).status).toBe(400);
  });

  it('junk in the public return URL is rejected before the gateway is ever called', async () => {
    const ret = await request(app).get('/charades/checkout/myfatoorah/return?paymentId=../../etc');
    expect(ret.headers.location).toBe('/charades/checkout?result=error');
    expect(gateway.lookups).toBe(0);
  });

  it('"check again" from the app credits a payment whose redirect and webhook were both lost', async () => {
    const { auth, player, paymentId, invoice } = await startCheckout();
    invoice.status = 'paid';
    const res = await request(app).post(`/charades/checkout/${paymentId}/refresh`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('paid');
    expect(res.body.balance).toBe(1);
    expect(creditBalance(player.id)).toBe(1);

    // Another player can't poke at it.
    const other = await makePlayerSession();
    expect((await request(app).post(`/charades/checkout/${paymentId}/refresh`).set(other.auth)).status).toBe(404);
  });

  it("a gateway outage at checkout answers 502 and leaves no payment that could later succeed", async () => {
    gateway.failCreate = true;
    const { auth } = await makePlayerSession();
    const res = await request(app).post('/charades/checkout').set(auth).send({ mode: 'classic' });
    expect(res.status).toBe(502);
    const row = db.prepare('SELECT status FROM payments').get() as { status: string };
    expect(row.status).toBe('failed');
  });
});
