import type { Response } from 'express';
import {
  AdminUserNotFoundError,
  DeckNotFoundError,
  DuplicateDeckError,
  DuplicatePlayerUsernameError,
  DuplicateUsernameError,
  GameSessionNotFoundError,
  InsufficientCreditsError,
  LastAdminError,
  NoTitlesAvailableError,
  PaymentNotFoundError,
  PlayerNotFoundError,
  TitleNotFoundError,
} from './db';
import { ValidationError } from './validate';

export function handleError(err: unknown, res: Response): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (
    err instanceof DuplicateDeckError ||
    err instanceof DuplicateUsernameError ||
    err instanceof DuplicatePlayerUsernameError ||
    err instanceof LastAdminError ||
    err instanceof NoTitlesAvailableError
  ) {
    res.status(409).json({ error: err.message });
    return;
  }
  if (err instanceof InsufficientCreditsError) {
    res.status(402).json({ error: err.message });
    return;
  }
  if (
    err instanceof DeckNotFoundError ||
    err instanceof TitleNotFoundError ||
    err instanceof AdminUserNotFoundError ||
    err instanceof PlayerNotFoundError ||
    err instanceof PaymentNotFoundError ||
    err instanceof GameSessionNotFoundError
  ) {
    res.status(404).json({ error: err.message });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'internal error' });
}
