import { CATALOGUE_API_URL } from '../config';
import type { CharadesTitle } from '../engine/charades';
import type { Lang } from '../engine/types';

export class WalletError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type PaymentStatus = 'initiated' | 'paid' | 'failed' | 'cancelled';

export interface CheckoutPayment {
  id: string;
  credits: number;
  amountFils: number;
  currency: string;
  status: PaymentStatus;
  redirectUrl?: string;
}

async function request<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${CATALOGUE_API_URL}${path}`, { ...init, signal: controller.signal });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        data && typeof data === 'object' && typeof (data as Record<string, unknown>).error === 'string'
          ? ((data as Record<string, unknown>).error as string)
          : `request failed with status ${res.status}`;
      throw new WalletError(message, res.status);
    }
    return data as T;
  } catch (err) {
    if (err instanceof WalletError) throw err;
    throw new WalletError('could not reach the server', 0);
  } finally {
    clearTimeout(timer);
  }
}

function authedPost<T>(path: string, token: string, body: unknown, timeoutMs = 8000): Promise<T> {
  return request<T>(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    },
    timeoutMs
  );
}

/** Current price of one game, in fils (1000 fils = 1 KD). Public, so a guest can see it before signing up. */
export function getGamePrice(timeoutMs = 8000): Promise<{ fils: number; currency: string }> {
  return request('/charades/price', { method: 'GET' }, timeoutMs);
}

export interface HomeContent {
  taglineAr: string;
  taglineEn: string;
  writeupAr: string;
  writeupEn: string;
}

/** The admin-editable home-screen tagline and write-up, in both languages. Public, so a guest sees it before signing up. */
export function getHomeContent(timeoutMs = 8000): Promise<HomeContent> {
  return request('/charades/home-content', { method: 'GET' }, timeoutMs);
}

export interface PlayableDeck {
  id: string;
  nameAr: string;
  nameEn: string;
  language: Lang;
  /** A path relative to CATALOGUE_API_URL — absent when this deck has no icon/cover picture. */
  imageUrl?: string;
  titleCount: number;
}

/** Every deck a player can choose from when drafting a game. Public, so drafting never requires being signed in. */
export function getPlayableDecks(timeoutMs = 8000): Promise<PlayableDeck[]> {
  return request('/charades/decks', { method: 'GET' }, timeoutMs);
}

/** Current server-held wallet balance for the signed-in player, in whole games. */
export function getWalletBalance(token: string, timeoutMs = 8000): Promise<number> {
  return request<{ balance: number }>(
    '/charades/wallet',
    { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
    timeoutMs
  ).then((r) => r.balance);
}

/** Starts a top-up for exactly one game's worth of credit, at the current price. No credit exists until confirmed. */
export function startCheckout(token: string, timeoutMs = 8000): Promise<CheckoutPayment> {
  return authedPost<CheckoutPayment>('/charades/checkout', token, {}, timeoutMs);
}

/** Stands in for a real payment provider's success callback until KNET is wired up. */
export function confirmCheckout(token: string, paymentId: string, timeoutMs = 8000): Promise<{ balance: number }> {
  return authedPost(`/charades/checkout/${encodeURIComponent(paymentId)}/confirm`, token, {}, timeoutMs);
}

/** Stands in for a real payment provider's failure/cancellation callback. */
export function failCheckout(token: string, paymentId: string, timeoutMs = 8000): Promise<void> {
  return authedPost(`/charades/checkout/${encodeURIComponent(paymentId)}/fail`, token, {}, timeoutMs);
}

/**
 * Spends one wallet credit and deals `sessionId`'s 20 titles in one call —
 * at random across `deckIds` combined, never a title the player chose
 * directly. `deckIds` is the player's own explicit choice made alongside
 * the team names when drafting. Idempotent server-side — calling this again
 * with the same sessionId (e.g. after an app restart) never spends a second
 * credit, and returns the same dealt titles instead, regardless of
 * `deckIds`. Throws `WalletError` with `status: 402` when the balance is
 * empty.
 */
export function startGameSession(
  token: string,
  sessionId: string,
  deckIds: string[],
  timeoutMs = 8000
): Promise<{ titles: CharadesTitle[]; balance: number }> {
  return authedPost<{ session: { titles: CharadesTitle[] }; balance: number }>(
    '/charades/sessions',
    token,
    { sessionId, deckIds },
    timeoutMs
  ).then((r) => ({ titles: r.session.titles, balance: r.balance }));
}
