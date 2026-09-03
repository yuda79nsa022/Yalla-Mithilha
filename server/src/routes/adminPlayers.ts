import { Router } from 'express';
import { deletePlayer, getPlayerById, listPlayers, recordAudit, updatePlayer } from '../db';
import { hashPassword } from '../auth';
import { handleError } from '../errors';
import { parseUpdatePlayerBody } from '../validate';

export const adminPlayersRouter = Router();

/** Real player accounts (as opposed to guest play) — admin can list, rename, reset password, and remove. */
adminPlayersRouter.get('/', (_req, res) => {
  res.json(listPlayers());
});

adminPlayersRouter.put('/:id', async (req, res) => {
  try {
    const before = getPlayerById(req.params.id);
    const input = parseUpdatePlayerBody(req.body);
    const patch: { username?: string; passwordHash?: string } = {};
    if (input.username !== undefined) patch.username = input.username;
    if (input.password !== undefined) patch.passwordHash = await hashPassword(input.password);
    const updated = updatePlayer(req.params.id, patch);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'player.update',
      target: req.params.id,
      before: before ? { username: before.username } : undefined,
      after: { username: updated.username, passwordChanged: input.password !== undefined },
    });
    res.json(updated);
  } catch (err) {
    handleError(err, res);
  }
});

adminPlayersRouter.delete('/:id', (req, res) => {
  try {
    const before = getPlayerById(req.params.id);
    deletePlayer(req.params.id);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'player.delete',
      target: req.params.id,
      before: before ? { username: before.username } : undefined,
    });
    res.status(204).end();
  } catch (err) {
    handleError(err, res);
  }
});
