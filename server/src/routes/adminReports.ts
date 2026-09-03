import { Router } from 'express';
import { listContentReports, recordAudit, setReportStatusForPrompt } from '../db';
import { handleError } from '../errors';
import { parseSetReportStatusBody } from '../validate';

export const adminReportsRouter = Router();

/** Raw list, most-recent-first — the admin UI groups and counts them per card client-side. */
adminReportsRouter.get('/', (_req, res) => {
  res.json(listContentReports());
});

/**
 * Bulk action on every currently-open report for one card at once — an
 * admin reviews a troublesome card's reports together, not one row at a
 * time. Already-resolved/dismissed reports are left alone.
 */
adminReportsRouter.put('/by-prompt/:promptId/status', (req, res) => {
  try {
    const { status } = parseSetReportStatusBody(req.body);
    const result = setReportStatusForPrompt(req.params.promptId, status);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: `report.${status}`,
      target: req.params.promptId,
      after: result,
    });
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});
