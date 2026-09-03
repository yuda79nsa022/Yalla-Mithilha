import type { Response } from 'express';
import {
  AdminUserNotFoundError,
  CategoryNotFoundError,
  DuplicateCategoryError,
  DuplicatePlayerUsernameError,
  DuplicateUsernameError,
  InvalidTileIndexError,
  LastAdminError,
  PlayerNotFoundError,
} from './db';
import { ValidationError } from './validate';

export function handleError(err: unknown, res: Response): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (
    err instanceof DuplicateCategoryError ||
    err instanceof DuplicateUsernameError ||
    err instanceof DuplicatePlayerUsernameError
  ) {
    res.status(409).json({ error: err.message });
    return;
  }
  if (err instanceof LastAdminError) {
    res.status(409).json({ error: err.message });
    return;
  }
  if (
    err instanceof CategoryNotFoundError ||
    err instanceof InvalidTileIndexError ||
    err instanceof AdminUserNotFoundError ||
    err instanceof PlayerNotFoundError
  ) {
    res.status(404).json({ error: err.message });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'internal error' });
}
