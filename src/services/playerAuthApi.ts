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

async function postJson(
  path: string,
  body: unknown,
  baseUrl: string,
  timeoutMs: number
): Promise<PlayerAuthResult> {
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

    const d = (data ?? {}) as Record<string, unknown>;
    if (typeof d.token !== 'string' || !isPlayerAccount(d.player)) {
      throw new PlayerAuthError('unexpected response from server', res.status);
    }
    return { token: d.token, player: d.player };
  } catch (err) {
    if (err instanceof PlayerAuthError) throw err;
    throw new PlayerAuthError('could not reach the server', 0);
  } finally {
    clearTimeout(timer);
  }
}

/** Optional — guest play never calls this. Only a player who chooses to create an account does. */
export function registerPlayer(
  username: string,
  password: string,
  baseUrl: string = CATALOGUE_API_URL,
  timeoutMs = 8000
): Promise<PlayerAuthResult> {
  return postJson('/players/register', { username, password }, baseUrl, timeoutMs);
}

export function loginPlayer(
  username: string,
  password: string,
  baseUrl: string = CATALOGUE_API_URL,
  timeoutMs = 8000
): Promise<PlayerAuthResult> {
  return postJson('/players/login', { username, password }, baseUrl, timeoutMs);
}
