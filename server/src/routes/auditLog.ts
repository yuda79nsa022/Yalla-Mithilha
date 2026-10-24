import { Router } from 'express';
import { AUDIT_SORTS, listAuditLog, searchAuditLog } from '../db';
import { handleError } from '../errors';
import { parseListQuery } from '../validate';

export const auditLogRouter = Router();

/**
 * Read-only by design — never exposed for edit or delete from the admin UI.
 * With `?page=` it's searched, sorted and paged (`{ items, total, page,
 * pageSize }`, newest first by default); without, the latest 200 as before.
 */
auditLogRouter.get('/audit-log', (req, res) => {
  try {
    const query = parseListQuery(req.query, Object.keys(AUDIT_SORTS), 'desc');
    res.json(query ? searchAuditLog(query) : listAuditLog());
  } catch (err) {
    handleError(err, res);
  }
});
