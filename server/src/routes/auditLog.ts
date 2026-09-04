import { Router } from 'express';
import { listAuditLog } from '../db';

export const auditLogRouter = Router();

/** Read-only by design — never exposed for edit or delete from the admin UI. */
auditLogRouter.get('/audit-log', (_req, res) => {
  res.json(listAuditLog());
});
