import { Router } from 'express';
import { submitContentReports } from '../db';
import { handleError } from '../errors';
import { reportLimiter } from '../rateLimit';
import { parseSubmitReportsBody } from '../validate';

export const reportsRouter = Router();

// Public and CORS-open, same reasoning as /catalogue and /players — the app
// calls this cross-origin, and reporting a card deliberately never requires
// an account. A JSON POST body also triggers a CORS preflight.
reportsRouter.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

/** The app's offline queue syncs here as a batch. Idempotent per report id — see submitContentReports. */
reportsRouter.post('/', reportLimiter, (req, res) => {
  try {
    const { reports } = parseSubmitReportsBody(req.body);
    res.status(201).json(submitContentReports(reports));
  } catch (err) {
    handleError(err, res);
  }
});
