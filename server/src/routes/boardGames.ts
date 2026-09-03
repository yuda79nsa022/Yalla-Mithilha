import { Router } from 'express';
import {
  PaymentNotFoundError,
  completeBoardGame,
  confirmPayment,
  consumeCreditForBoardGame,
  creditBalance,
  createPayment,
  failPayment,
  getPayment,
} from '../db';
import { requirePlayerSession } from '../auth';
import { handleError } from '../errors';
import { paymentProvider } from '../payments/provider';
import { parseConsumeCreditBody, parseCreateCheckoutBody } from '../validate';

export const boardGamesRouter = Router();

// Public in the CORS sense (called cross-origin from the app running as a
// web page, same as /catalogue and /players), even though every route below
// still requires a player session. A bearer Authorization header — unlike
// the unauthenticated /players routes — also triggers a preflight on GET,
// not just POST, so both need declaring here.
boardGamesRouter.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Every route here is a real player, never a guest — Party Game and drafting
// a board both stay guest-accessible; only spending real money requires an
// account, per the product decision to route checkout through sign-in.
boardGamesRouter.use(requirePlayerSession);

boardGamesRouter.get('/credits', (req, res) => {
  res.json({ balance: creditBalance(req.player!.sub) });
});

boardGamesRouter.post('/checkout', async (req, res) => {
  try {
    const { product } = parseCreateCheckoutBody(req.body);
    const payment = createPayment({ playerId: req.player!.sub, product, provider: paymentProvider.name });
    const { redirectUrl } = await paymentProvider.createCheckout({
      paymentId: payment.id,
      product: payment.product,
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
boardGamesRouter.post('/checkout/:paymentId/confirm', (req, res) => {
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

boardGamesRouter.post('/checkout/:paymentId/fail', (req, res) => {
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

/** Idempotent — see consumeCreditForBoardGame. Resuming an interrupted game replays the same boardGameId and spends nothing further. */
boardGamesRouter.post('/consume', (req, res) => {
  try {
    const { boardGameId } = parseConsumeCreditBody(req.body);
    const { boardGame, balance } = consumeCreditForBoardGame(req.player!.sub, boardGameId);
    res.json({ boardGame, balance });
  } catch (err) {
    handleError(err, res);
  }
});

boardGamesRouter.post('/:id/complete', (req, res) => {
  try {
    res.json(completeBoardGame(req.player!.sub, req.params.id));
  } catch (err) {
    handleError(err, res);
  }
});
