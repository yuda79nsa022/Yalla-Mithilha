import { Router } from 'express';
import { createAdminUser, deleteAdminUser, listAdminUsers, updateAdminUser } from '../db';
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
    res.status(201).json(createAdminUser({ username, passwordHash }));
  } catch (err) {
    handleError(err, res);
  }
});

adminUsersRouter.put('/:id', async (req, res) => {
  try {
    const input = parseUpdateAdminUserBody(req.body);
    const patch: { username?: string; passwordHash?: string } = {};
    if (input.username !== undefined) patch.username = input.username;
    if (input.password !== undefined) patch.passwordHash = await hashPassword(input.password);
    res.json(updateAdminUser(req.params.id, patch));
  } catch (err) {
    handleError(err, res);
  }
});

adminUsersRouter.delete('/:id', (req, res) => {
  try {
    deleteAdminUser(req.params.id);
    res.status(204).end();
  } catch (err) {
    handleError(err, res);
  }
});
