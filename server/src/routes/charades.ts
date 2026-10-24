import { Router, type Response } from 'express';
import { GameSessionNotFoundError, PaymentNotFoundError, confirmPayment, createPayment, createRevealToken, creditBalance, failPayment, getGamePriceFilsForMode, getGameSession, getHomeContent, getPayment, getPlayerById, listGameSessionsForPlayer, listPaymentsForPlayer, listPublicDecks, setPaymentProviderRef, startGameSession, getBranding } from '../db';
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

/** The admin-set app name, logo and timezone — public, since every page (a guest's included) shows them. */
charadesRouter.get('/branding', (_req, res) => {
  res.json(getBranding());
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

/**
 * The player's usage report: every game they started and every top-up they
 * made (newest first), plus totals. Games paid for with signup-bonus credits
 * show up as games like any other; only top-ups that actually settled count
 * as bought.
 */
charadesRouter.get('/usage', requirePlayerSession, (req, res) => {
  const playerId = req.player!.sub;
  const games = listGameSessionsForPlayer(playerId);
  const payments = listPaymentsForPlayer(playerId).slice(0, 100);
  const paid = payments.filter((p) => p.status === 'paid');
  res.json({
    totals: {
      gamesPlayed: games.length,
      liteGames: games.filter((g) => g.mode === 'classic').length,
      proGames: games.filter((g) => g.mode === 'modified').length,
      gamesBought: paid.reduce((sum, p) => sum + p.credits, 0),
      spentFils: paid.reduce((sum, p) => sum + p.amountFils, 0),
      currency: 'KWD',
    },
    games,
    payments: payments.map((p) => ({
      id: p.id,
      credits: p.credits,
      amountFils: p.amountFils,
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt,
    })),
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
  let target = `${PAYMENT_DONE_PATH}?result=error`;
  if (GATEWAY_ID.test(gatewayPaymentId)) {
    try {
      const { payment, outcome } = await settleFromProvider({ paymentId: gatewayPaymentId });
      if (payment) target = `${PAYMENT_DONE_PATH}?payment=${encodeURIComponent(payment.id)}&result=${outcome}`;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('payment return: gateway lookup failed', err);
    }
  }
  res.redirect(303, target);
});

const PAYMENT_DONE_PATH = '/charades/checkout/myfatoorah/done';
const PAYMENT_ID = /^[0-9a-f-]{1,64}$/i;
const PAYMENT_RESULTS = new Set(['paid', 'pending', 'failed', 'error']);

/**
 * Where the return route lands. The app opens MyFatoorah in a popup, so this
 * normally runs inside that popup: it hands the result to the game window
 * (postMessage to its opener, plus a BroadcastChannel for browsers that cut
 * the opener link on the way through the gateway) and closes itself. Opened
 * any other way — popups blocked, so the whole tab went to the gateway — it
 * just continues to the checkout screen. The result is only a hint either
 * way: the app re-checks the payment with the server before believing it.
 */
charadesRouter.get('/checkout/myfatoorah/done', (req, res) => {
  const payment = typeof req.query.payment === 'string' && PAYMENT_ID.test(req.query.payment) ? req.query.payment : null;
  const result = typeof req.query.result === 'string' && PAYMENT_RESULTS.has(req.query.result) ? req.query.result : 'error';
  const target = `/charades/checkout?${payment ? `payment=${encodeURIComponent(payment)}&` : ''}result=${result}`;
  // Both values were checked against fixed patterns above; escaping `<` as
  // well keeps the inline JSON inert whatever changes later.
  const data = JSON.stringify({ type: 'myfatoorah-result', payment, result, target }).replace(/</g, '\\u003c');
  const { appNameAr, appNameEn } = getBranding();
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(appNameEn)}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F3F2F2;color:#201E1D;font-family:system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
.card{background:#fff;border:2px solid #201E1D;box-shadow:6px 6px 0 #201E1D;padding:24px;max-width:420px}
a{display:inline-block;margin-top:16px;background:#8038D1;color:#fff;border:2px solid #201E1D;padding:10px 20px;font-weight:700;text-decoration:none}</style></head>
<body><div class="card"><p id="msg">${escapeHtml(appNameAr)} — ${escapeHtml(appNameEn)}</p><p><a id="back" href="${target}">متابعة · Continue</a></p></div>
<script>
(function () {
  var data = ${data};
  var signalled = false;
  try { if (window.opener && window.opener !== window) { window.opener.postMessage(data, location.origin); signalled = true; } } catch (e) {}
  try { var bc = new BroadcastChannel('myfatoorah'); bc.postMessage(data); bc.close(); } catch (e) {}
  var popup = signalled;
  try { var since = Number(localStorage.getItem('myfatoorahPopup')); popup = popup || (since > 0 && Date.now() - since < 30 * 60 * 1000); } catch (e) {}
  if (!popup) { location.replace(data.target); return; }
  window.close();
  document.getElementById('msg').textContent = 'تم — ارجع إلى نافذة اللعبة · Done — return to the game window';
})();
</script></body></html>`);
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

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
