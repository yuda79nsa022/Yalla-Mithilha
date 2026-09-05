import { Router } from 'express';
import { GameSessionNotFoundError, PaymentNotFoundError, confirmPayment, createPayment, creditBalance, failPayment, getGamePriceFils, getGameSession, getPayment, listPlayableDecks, startGameSession } from '../db';
import { requirePlayerSession } from '../auth';
import { handleError } from '../errors';
import { paymentProvider } from '../payments/provider';
import { parseStartSessionBody } from '../validate';

export const charadesRouter = Router();

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

/** Deck picker and the price both need to be visible before signing in, so a guest can see what they'd be paying for. */
charadesRouter.get('/decks', (_req, res) => {
  res.json(listPlayableDecks().map((d) => ({ id: d.id, nameAr: d.nameAr, nameEn: d.nameEn, titleCount: d.titles.length })));
});

charadesRouter.get('/price', (_req, res) => {
  res.json({ fils: getGamePriceFils(), currency: 'KWD' });
});

// Every route below is a real player, never a guest — only spending real
// money requires an account.
charadesRouter.use(requirePlayerSession);

charadesRouter.get('/wallet', (req, res) => {
  res.json({ balance: creditBalance(req.player!.sub) });
});

charadesRouter.post('/checkout', async (req, res) => {
  try {
    const payment = createPayment({ playerId: req.player!.sub, provider: paymentProvider.name });
    const { redirectUrl } = await paymentProvider.createCheckout({
      paymentId: payment.id,
      amountFils: payment.amountFils,
      currency: payment.currency,
    });
    res.status(201).json({ ...payment, redirectUrl });
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * Simulates a payment provider's success callback. A real integration
 * replaces this with a signature-verified webhook the provider calls
 * server-to-server — see the note on PaymentProvider — but the ownership
 * check and the idempotent grant inside `confirmPayment` are the same
 * either way.
 */
charadesRouter.post('/checkout/:paymentId/confirm', (req, res) => {
  try {
    const existing = getPayment(req.params.paymentId);
    if (!existing || existing.playerId !== req.player!.sub) {
      throw new PaymentNotFoundError(`payment "${req.params.paymentId}" not found`);
    }
    const { payment, balance } = confirmPayment(req.params.paymentId);
    res.json({ payment, balance });
  } catch (err) {
    handleError(err, res);
  }
});

charadesRouter.post('/checkout/:paymentId/fail', (req, res) => {
  try {
    const existing = getPayment(req.params.paymentId);
    if (!existing || existing.playerId !== req.player!.sub) {
      throw new PaymentNotFoundError(`payment "${req.params.paymentId}" not found`);
    }
    res.json(failPayment(req.params.paymentId));
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * Spends one wallet credit and deals the session's 20 titles in one call.
 * Idempotent — see startGameSession. Resuming an interrupted app replays the
 * same client-generated sessionId and spends nothing further, returning the
 * same dealt titles instead.
 */
charadesRouter.post('/sessions', (req, res) => {
  try {
    const { sessionId, deckId } = parseStartSessionBody(req.body);
    const { session, balance } = startGameSession(req.player!.sub, sessionId, deckId);
    res.status(201).json({ session, balance });
  } catch (err) {
    handleError(err, res);
  }
});

charadesRouter.get('/sessions/:id', (req, res) => {
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
