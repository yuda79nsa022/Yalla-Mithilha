import { Router, type Response } from 'express';
import { GameSessionNotFoundError, PaymentNotFoundError, confirmPayment, createPayment, createRevealToken, creditBalance, failPayment, getGamePriceFilsForMode, getGameSession, getHomeContent, getPayment, getPlayerById, listPublicDecks, setPaymentProviderRef, startGameSession } from '../db';
import { isGameMode, type GameMode } from '../types';
import { requirePlayerSession } from '../auth';
import { handleError } from '../errors';
import { getPaymentProvider } from '../payments/provider';
import { settleFromProvider } from '../payments/settle';
import { notifyLowBalance } from '../notifications/lowBalance';
import { paymentGatewayLimiter } from '../rateLimit';
import { parseCreateRevealTokenBody, parseStartSessionBody } from '../validate';

export const charadesRouter = Router();

/** `?mode=modified` opts into the modified game's price/session; anything else (including omitted) means classic. */
function modeFromQuery(value: unknown): GameMode {
  return isGameMode(value) ? value : 'classic';
}

// Public in the CORS sense (called cross-origin from the app running as a
// web page, same as /players), even though most routes below still require
// a player session. A bearer Authorization header — unlike an
// unauthenticated GET — also triggers a preflight, not just POST, so both
// need declaring here.
charadesRouter.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

/** The price needs to be visible before signing in, so a guest can see what they'd be paying for. `?mode=modified` for the modified game's price; omitted (or any other value) means classic. */
charadesRouter.get('/price', (req, res) => {
  const mode = modeFromQuery(req.query.mode);
  res.json({ fils: getGamePriceFilsForMode(mode), currency: 'KWD' });
});

/** Every deck a player can choose from when drafting a game — public, since drafting never requires being signed in. */
charadesRouter.get('/decks', (_req, res) => {
  res.json(listPublicDecks());
});

/** The home screen's admin-editable tagline and write-up — public, since a guest sees the home screen before signing in. */
charadesRouter.get('/home-content', (_req, res) => {
  res.json(getHomeContent());
});

// Every route below is a real player, never a guest — only spending real
// money requires an account. Guarded per-route rather than with a blanket
// `.use(requirePlayerSession)` on the whole router: a deployment that serves
// the player web app from this same origin also has real pages living under
// this same `/charades` path (draft, checkout, play) for its own
// client-side router — a blanket check would 401 a plain page refresh on
// one of those before Express ever got to notice no API route matched,
// instead of falling through to that app's SPA shell.
/** `freeGameCredits` (the signup bonus) and `balance` (paid credits) both work for either mode; free ones are spent first. */
charadesRouter.get('/wallet', requirePlayerSession, (req, res) => {
  res.json({
    balance: creditBalance(req.player!.sub),
    freeGameCredits: getPlayerById(req.player!.sub)?.freeGameCredits ?? 0,
  });
});

charadesRouter.post('/checkout', requirePlayerSession, async (req, res) => {
  try {
    const body = (req.body as Record<string, unknown> | undefined) ?? {};
    const mode = modeFromQuery(body.mode);
    const provider = getPaymentProvider();
    const payment = createPayment({ playerId: req.player!.sub, provider: provider.name, mode });
    let checkout: { redirectUrl?: string; providerRef?: string };
    try {
      checkout = await provider.createCheckout({
        paymentId: payment.id,
        amountFils: payment.amountFils,
        currency: payment.currency,
        customerName: req.player!.username,
        language: body.language === 'en' ? 'en' : 'ar',
      });
    } catch (err) {
      // The gateway never created anything to pay, so this payment can't succeed.
      failPayment(payment.id);
      throw err;
    }
    if (checkout.providerRef) setPaymentProviderRef(payment.id, checkout.providerRef);
    res.status(201).json({ ...getPayment(payment.id)!, redirectUrl: checkout.redirectUrl });
  } catch (err) {
    handleError(err, res);
  }
});

/** The player's own payment, or a 404 — never someone else's. */
function ownPayment(paymentId: string, playerId: string) {
  const payment = getPayment(paymentId);
  if (!payment || payment.playerId !== playerId) throw new PaymentNotFoundError(`payment "${paymentId}" not found`);
  return payment;
}

/**
 * The mock provider's stand-ins for a gateway's success/failure callback,
 * called by the checkout screen itself. Switched off with a real gateway:
 * there, only the gateway's own answer (see payments/settle.ts) may ever
 * mark a payment paid — or failed, which would stop a real, later-arriving
 * success from crediting it.
 */
function requireMockProvider(res: Response): boolean {
  if (getPaymentProvider().redirects) {
    res.status(403).json({ error: 'payments are confirmed by the payment gateway' });
    return false;
  }
  return true;
}

charadesRouter.post('/checkout/:paymentId/confirm', requirePlayerSession, (req, res) => {
  try {
    if (!requireMockProvider(res)) return;
    ownPayment(req.params.paymentId, req.player!.sub);
    const { payment, balance } = confirmPayment(req.params.paymentId);
    res.json({ payment, balance });
  } catch (err) {
    handleError(err, res);
  }
});

charadesRouter.post('/checkout/:paymentId/fail', requirePlayerSession, (req, res) => {
  try {
    if (!requireMockProvider(res)) return;
    ownPayment(req.params.paymentId, req.player!.sub);
    res.json(failPayment(req.params.paymentId));
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * "Check again": asks the gateway for one of the player's own payments and
 * applies its answer. The app calls this when the player comes back from the
 * gateway's page, so a credit lands even if the return redirect or the
 * webhook got lost. Harmless to call any number of times.
 */
charadesRouter.post('/checkout/:paymentId/refresh', requirePlayerSession, async (req, res) => {
  try {
    const payment = ownPayment(req.params.paymentId, req.player!.sub);
    let current = payment;
    if (payment.status === 'initiated' && payment.providerRef) {
      current = (await settleFromProvider({ invoiceId: payment.providerRef })).payment ?? payment;
    }
    res.json({ payment: current, balance: creditBalance(req.player!.sub) });
  } catch (err) {
    handleError(err, res);
  }
});

/** MyFatoorah's ids are numeric; anything else in these public routes is rejected before any outbound call. */
const GATEWAY_ID = /^[0-9]{1,30}$/;

/**
 * Where MyFatoorah sends the player's browser back to, success or failure,
 * with `?paymentId=…`. Public — the browser carries no session here — and
 * nothing in the URL is trusted: the id is only used to ask MyFatoorah.
 * Ends with a redirect into the app's checkout screen, which shows the
 * result.
 */
charadesRouter.get('/checkout/myfatoorah/return', paymentGatewayLimiter, async (req, res) => {
  const gatewayPaymentId = typeof req.query.paymentId === 'string' ? req.query.paymentId : '';
  let target = '/charades/checkout?result=error';
  if (GATEWAY_ID.test(gatewayPaymentId)) {
    try {
      const { payment, outcome } = await settleFromProvider({ paymentId: gatewayPaymentId });
      if (payment) target = `/charades/checkout?payment=${encodeURIComponent(payment.id)}&result=${outcome}`;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('payment return: gateway lookup failed', err);
    }
  }
  res.redirect(303, target);
});

/**
 * MyFatoorah's server-to-server notification — a backup for a player who
 * closes the tab before the return redirect. Only the invoice id is read
 * from it (from either webhook version's shape), and only to ask MyFatoorah;
 * the payload itself is never trusted, so a forged one can't credit anything.
 * A failed lookup answers 500 so MyFatoorah retries later.
 */
charadesRouter.post('/checkout/myfatoorah/webhook', paymentGatewayLimiter, async (req, res) => {
  const data = (req.body as { Data?: { InvoiceId?: unknown; Invoice?: { Id?: unknown } } } | undefined)?.Data;
  const invoiceId = String(data?.InvoiceId ?? data?.Invoice?.Id ?? '');
  if (!GATEWAY_ID.test(invoiceId)) {
    res.status(400).json({ error: 'no invoice id' });
    return;
  }
  try {
    await settleFromProvider({ invoiceId });
    res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('payment webhook: gateway lookup failed', err);
    res.status(500).json({ error: 'could not verify the payment yet' });
  }
});

/**
 * Spends one wallet credit and deals the session's 20 titles in one call —
 * at random across whichever decks the player chose (`deckIds`) when
 * drafting the game, without repeats. Idempotent — see startGameSession.
 * Resuming an interrupted app replays the same client-generated sessionId
 * and spends nothing further, returning the same dealt titles instead.
 */
charadesRouter.post('/sessions', requirePlayerSession, (req, res) => {
  try {
    const { sessionId, deckIds, mode, difficulty } = parseStartSessionBody(req.body);
    const { session, balance } = startGameSession(req.player!.sub, sessionId, deckIds, mode, difficulty);
    res.status(201).json({ session, balance });
    // After the response: spending this game may have taken them under the
    // low-balance threshold. Fire-and-forget — never fails or delays the game.
    void notifyLowBalance(req.player!.sub);
  } catch (err) {
    handleError(err, res);
  }
});

charadesRouter.get('/sessions/:id', requirePlayerSession, (req, res) => {
  try {
    const session = getGameSession(req.params.id);
    if (!session || session.playerId !== req.player!.sub) {
      throw new GameSessionNotFoundError(`session "${req.params.id}" not found`);
    }
    res.json(session);
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * Mints the single-use token the handoff screen's QR code links to (see
 * ../routes/reveal.ts for where a bare camera scan actually redeems it).
 * Requires a player session like every other route here, unlike the public
 * redemption endpoint itself — minting is part of the authenticated app's
 * own flow, while redeeming has to work for a phone camera carrying no
 * session or app at all.
 */
charadesRouter.post('/reveal-tokens', requirePlayerSession, (req, res) => {
  try {
    const { sessionId, title, categoryAr, categoryEn, imageUrl } = parseCreateRevealTokenBody(req.body);
    const session = getGameSession(sessionId);
    if (!session || session.playerId !== req.player!.sub) {
      throw new GameSessionNotFoundError(`session "${sessionId}" not found`);
    }
    const token = createRevealToken(sessionId, { t: title, ca: categoryAr, ce: categoryEn, img: imageUrl });
    res.status(201).json(token);
  } catch (err) {
    handleError(err, res);
  }
});
