import { Router } from 'express';
import { deletePlayer, listPlayers, updatePlayer } from '../db';
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
    const input = parseUpdatePlayerBody(req.body);
    const patch: { username?: string; passwordHash?: string } = {};
    if (input.username !== undefined) patch.username = input.username;
    if (input.password !== undefined) patch.passwordHash = await hashPassword(input.password);
    res.json(updatePlayer(req.params.id, patch));
  } catch (err) {
    handleError(err, res);
  }
});

adminPlayersRouter.delete('/:id', (req, res) => {
  try {
    deletePlayer(req.params.id);
    res.status(204).end();
  } catch (err) {
    handleError(err, res);
  }
});
