import { CATALOGUE_API_URL } from '../config';

export class PlayerAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface PlayerAccount {
  id: string;
  username: string;
}

export interface PlayerAuthResult {
  token: string;
  player: PlayerAccount;
}

function isPlayerAccount(value: unknown): value is PlayerAccount {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.username === 'string';
}

/** Shared by every call below: posts JSON, applies a timeout, and turns a non-2xx (or unreachable server) into a `PlayerAuthError`. Returns the parsed body as-is — callers that need a particular shape (a token+player pair, say) validate it themselves. */
async function postJson(path: string, body: unknown, baseUrl: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        data && typeof data === 'object' && typeof (data as Record<string, unknown>).error === 'string'
          ? ((data as Record<string, unknown>).error as string)
          : `request failed with status ${res.status}`;
      throw new PlayerAuthError(message, res.status);
    }
    return data;
  } catch (err) {
    if (err instanceof PlayerAuthError) throw err;
    throw new PlayerAuthError('could not reach the server', 0);
  } finally {
    clearTimeout(timer);
  }
}

async function postJsonForAuthResult(path: string, body: unknown, baseUrl: string, timeoutMs: number): Promise<PlayerAuthResult> {
  const data = await postJson(path, body, baseUrl, timeoutMs);
  const d = (data ?? {}) as Record<string, unknown>;
  if (typeof d.token !== 'string' || !isPlayerAccount(d.player)) {
    throw new PlayerAuthError('unexpected response from server', 0);
  }
  return { token: d.token, player: d.player };
}

/** Optional — guest play never calls this. Only a player who chooses to create an account does. `email` is mandatory — it's the account's only forgot-password channel. */
export function registerPlayer(
  username: string,
  password: string,
  email: string,
  baseUrl: string = CATALOGUE_API_URL,
  timeoutMs = 8000
): Promise<PlayerAuthResult> {
  return postJsonForAuthResult('/players/register', { username, password, email }, baseUrl, timeoutMs);
}

export function loginPlayer(
  username: string,
  password: string,
  baseUrl: string = CATALOGUE_API_URL,
  timeoutMs = 8000
): Promise<PlayerAuthResult> {
  return postJsonForAuthResult('/players/login', { username, password }, baseUrl, timeoutMs);
}

/**
 * Always resolves once the server accepts the request — the response never
 * reveals whether `username` matched an account or had an email on file
 * (see the server route), so there is nothing meaningful to return here.
 */
export async function requestPasswordReset(
  username: string,
  baseUrl: string = CATALOGUE_API_URL,
  timeoutMs = 8000
): Promise<void> {
  await postJson('/players/password-reset/request', { username }, baseUrl, timeoutMs);
}

export async function confirmPasswordReset(
  username: string,
  code: string,
  newPassword: string,
  baseUrl: string = CATALOGUE_API_URL,
  timeoutMs = 8000
): Promise<void> {
  await postJson('/players/password-reset/confirm', { username, code, newPassword }, baseUrl, timeoutMs);
}
