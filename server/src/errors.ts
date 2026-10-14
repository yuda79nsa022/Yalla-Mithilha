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
  RevealTokenAlreadyUsedError,
  RevealTokenNotFoundError,
  TitleNotFoundError,
} from './db';
import { PaymentProviderError } from './payments/errors';
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
    err instanceof GameSessionNotFoundError ||
    err instanceof RevealTokenNotFoundError
  ) {
    res.status(404).json({ error: err.message });
    return;
  }
  if (err instanceof RevealTokenAlreadyUsedError) {
    res.status(410).json({ error: err.message });
    return;
  }
  if (err instanceof PaymentProviderError) {
    // The detail (gateway message, validation errors) is for the server log,
    // not the player.
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(502).json({ error: 'the payment service is unavailable, try again shortly' });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'internal error' });
}
