import { CATALOGUE_API_URL } from '../config';
import type { CharadesTitle, ClassicDifficulty } from '../engine/charades';
import type { CharadesStacks } from '../engine/modifiedCharades';
import type { GameMode } from '../engine/game';
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
  /** Set when a real payment gateway is configured: the player pays on this page. Absent for the development mock. */
  redirectUrl?: string;
}

/** A price in fils (1000 fils = 1 KD), as the app shows it. */
export function formatKwd(fils: number): string {
  return `${(fils / 1000).toFixed(3)} KD`;
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

/** Current price of one game in `mode`, in fils (1000 fils = 1 KD). Public, so a guest can see it before signing up. */
export function getGamePrice(mode: GameMode, timeoutMs = 8000): Promise<{ fils: number; currency: string }> {
  return request(`/charades/price?mode=${mode}`, { method: 'GET' }, timeoutMs);
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

export interface WalletBalance {
  /** Paid, pooled credits — spendable on either game mode. */
  balance: number;
  /** The signup bonus's remainder, if any — spendable on either game mode, and spent before `balance`. */
  freeGameCredits: number;
}

/** Current server-held wallet balance for the signed-in player, in whole games. */
export function getWalletBalance(token: string, timeoutMs = 8000): Promise<WalletBalance> {
  return request<WalletBalance>(
    '/charades/wallet',
    { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
    timeoutMs
  );
}

export interface UsageReport {
  totals: {
    gamesPlayed: number;
    liteGames: number;
    proGames: number;
    gamesBought: number;
    spentFils: number;
    currency: string;
  };
  games: { id: string; mode: GameMode; createdAt: number }[];
  payments: { id: string; credits: number; amountFils: number; currency: string; status: PaymentStatus; createdAt: number }[];
}

/** The signed-in player's games started and top-ups made, with totals. */
export function getUsageReport(token: string, timeoutMs = 8000): Promise<UsageReport> {
  return request<UsageReport>('/charades/usage', { method: 'GET', headers: { Authorization: `Bearer ${token}` } }, timeoutMs);
}

/**
 * Starts a top-up for exactly one game's worth of credit, at `mode`'s current
 * price. No credit exists until the payment gateway confirms it. `language`
 * picks the gateway's payment page language.
 */
export function startCheckout(token: string, mode: GameMode, language: 'ar' | 'en', timeoutMs = 15000): Promise<CheckoutPayment> {
  return authedPost<CheckoutPayment>('/charades/checkout', token, { mode, language }, timeoutMs);
}

/** Asks the server to check a payment with the gateway again — after the player comes back from the gateway's page. */
export function refreshCheckout(
  token: string,
  paymentId: string,
  timeoutMs = 20000
): Promise<{ payment: CheckoutPayment; balance: number }> {
  return authedPost(`/charades/checkout/${encodeURIComponent(paymentId)}/refresh`, token, {}, timeoutMs);
}

/** Development mock only: stands in for the gateway's success callback. The server refuses it when a real gateway is configured. */
export function confirmCheckout(token: string, paymentId: string, timeoutMs = 8000): Promise<{ balance: number }> {
  return authedPost(`/charades/checkout/${encodeURIComponent(paymentId)}/confirm`, token, {}, timeoutMs);
}

/** Development mock only: stands in for the gateway's failure callback. */
export function failCheckout(token: string, paymentId: string, timeoutMs = 8000): Promise<void> {
  return authedPost(`/charades/checkout/${encodeURIComponent(paymentId)}/fail`, token, {}, timeoutMs);
}

/**
 * Spends one wallet credit and deals `sessionId`'s titles in one call — at
 * random across `deckIds` combined, never a title the player chose
 * directly. `deckIds` is the player's own explicit choice made alongside
 * the team names when drafting. `mode` decides both the shape of the deal
 * (classic: a flat `titles` list; modified: `rounds` + three difficulty
 * `stacks`) and which wallet pays for it — the two free signup games only
 * ever cover `'classic'`; a purchased credit covers either. Idempotent
 * server-side — calling this again with the same sessionId (e.g. after an
 * app restart) never spends a second credit, and returns the same dealt
 * session instead, regardless of `deckIds`/`mode`. Throws `WalletError`
 * with `status: 402` when the balance is empty. `difficulty` only matters
 * for a classic game — which level of titles to deal.
 */
export function startGameSession(
  token: string,
  sessionId: string,
  deckIds: string[],
  mode: GameMode,
  difficulty: ClassicDifficulty = 'mixed',
  timeoutMs = 8000
): Promise<{ titles: CharadesTitle[]; rounds?: number; stacks?: CharadesStacks; balance: number }> {
  return authedPost<{
    session: { titles: CharadesTitle[]; rounds?: number; stacks?: CharadesStacks };
    balance: number;
  }>('/charades/sessions', token, { sessionId, deckIds, mode, difficulty }, timeoutMs).then((r) => ({
    titles: r.session.titles,
    rounds: r.session.rounds,
    stacks: r.session.stacks,
    balance: r.balance,
  }));
}

/**
 * Mints the single-use token the handoff screen's QR code links to — the
 * server stores the payload server-side and hands back only an opaque id,
 * so the `/reveal` page (opened by a bare camera scan, no session of its
 * own) can claim it exactly once. See server/src/routes/reveal.ts.
 */
export function createRevealToken(
  token: string,
  sessionId: string,
  title: string,
  categoryAr: string,
  categoryEn: string,
  imageUrl?: string,
  timeoutMs = 8000
): Promise<{ id: string }> {
  return authedPost<{ id: string }>(
    '/charades/reveal-tokens',
    token,
    { sessionId, title, categoryAr, categoryEn, imageUrl },
    timeoutMs
  );
}
