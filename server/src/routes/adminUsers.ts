import { Router } from 'express';
import { createAdminUser, deleteAdminUser, getAdminUserById, listAdminUsers, recordAudit, updateAdminUser } from '../db';
import { hashPassword } from '../auth';
import { handleError } from '../errors';
import { parseCreateAdminUserBody, parseUpdateAdminUserBody } from '../validate';

export const adminUsersRouter = Router();

adminUsersRouter.get('/', (_req, res) => {
  res.json(listAdminUsers());
});

adminUsersRouter.post('/', async (req, res) => {
  try {
    const { username, password } = parseCreateAdminUserBody(req.body);
    const passwordHash = await hashPassword(password);
    const created = createAdminUser({ username, passwordHash });
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'admin.create',
      target: created.id,
      after: { username: created.username },
    });
    res.status(201).json(created);
  } catch (err) {
    handleError(err, res);
  }
});

adminUsersRouter.put('/:id', async (req, res) => {
  try {
    const before = getAdminUserById(req.params.id);
    const input = parseUpdateAdminUserBody(req.body);
    const patch: { username?: string; passwordHash?: string } = {};
    if (input.username !== undefined) patch.username = input.username;
    if (input.password !== undefined) patch.passwordHash = await hashPassword(input.password);
    const updated = updateAdminUser(req.params.id, patch);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'admin.update',
      target: req.params.id,
      before: before ? { username: before.username } : undefined,
      after: { username: updated.username, passwordChanged: input.password !== undefined },
    });
    res.json(updated);
  } catch (err) {
    handleError(err, res);
  }
});

adminUsersRouter.delete('/:id', (req, res) => {
  try {
    const before = getAdminUserById(req.params.id);
    deleteAdminUser(req.params.id);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'admin.delete',
      target: req.params.id,
      before: before ? { username: before.username } : undefined,
    });
    res.status(204).end();
  } catch (err) {
    handleError(err, res);
  }
});
