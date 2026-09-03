import { CATALOGUE_API_URL } from '../config';

export class BoardPaymentError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type ProductId = 'single' | 'bundle2';
export type PaymentStatus = 'initiated' | 'paid' | 'failed' | 'cancelled';

export interface CheckoutPayment {
  id: string;
  product: ProductId;
  credits: number;
  amountFils: number;
  currency: string;
  status: PaymentStatus;
  redirectUrl?: string;
}

async function authedRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  baseUrl: string,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        data && typeof data === 'object' && typeof (data as Record<string, unknown>).error === 'string'
          ? ((data as Record<string, unknown>).error as string)
          : `request failed with status ${res.status}`;
      throw new BoardPaymentError(message, res.status);
    }
    return data as T;
  } catch (err) {
    if (err instanceof BoardPaymentError) throw err;
    throw new BoardPaymentError('could not reach the server', 0);
  } finally {
    clearTimeout(timer);
  }
}

function postJson<T>(path: string, token: string, body: unknown, baseUrl: string, timeoutMs: number): Promise<T> {
  return authedRequest<T>(
    path,
    token,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    baseUrl,
    timeoutMs
  );
}

/** Current server-held credit balance for the signed-in player. */
export function getBoardCredits(token: string, baseUrl: string = CATALOGUE_API_URL, timeoutMs = 8000): Promise<number> {
  return authedRequest<{ balance: number }>('/board-games/credits', token, { method: 'GET' }, baseUrl, timeoutMs).then(
    (r) => r.balance
  );
}

/** Starts a checkout. No credits exist yet — only a confirmed payment grants them. */
export function startBoardCheckout(
  token: string,
  product: ProductId,
  baseUrl: string = CATALOGUE_API_URL,
  timeoutMs = 8000
): Promise<CheckoutPayment> {
  return postJson<CheckoutPayment>('/board-games/checkout', token, { product }, baseUrl, timeoutMs);
}

/** Stands in for a real payment provider's success callback until KNET is wired up. */
export function confirmBoardCheckout(
  token: string,
  paymentId: string,
  baseUrl: string = CATALOGUE_API_URL,
  timeoutMs = 8000
): Promise<{ balance: number }> {
  return postJson(`/board-games/checkout/${encodeURIComponent(paymentId)}/confirm`, token, {}, baseUrl, timeoutMs);
}

/** Stands in for a real payment provider's failure/cancellation callback. */
export function failBoardCheckout(
  token: string,
  paymentId: string,
  baseUrl: string = CATALOGUE_API_URL,
  timeoutMs = 8000
): Promise<void> {
  return postJson(`/board-games/checkout/${encodeURIComponent(paymentId)}/fail`, token, {}, baseUrl, timeoutMs);
}

/**
 * Spends one credit to activate `boardGameId` (the locally drafted board's
 * own id). Idempotent server-side — calling this again with the same id
 * (e.g. after an app restart) never spends a second credit. Throws
 * `BoardPaymentError` with `status: 402` when the balance is empty.
 */
export function consumeBoardCredit(
  token: string,
  boardGameId: string,
  baseUrl: string = CATALOGUE_API_URL,
  timeoutMs = 8000
): Promise<{ balance: number }> {
  return postJson('/board-games/consume', token, { boardGameId }, baseUrl, timeoutMs);
}
