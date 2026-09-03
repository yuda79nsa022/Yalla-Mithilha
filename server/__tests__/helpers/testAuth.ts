import { createAdminUser, createPlayer } from '../../src/db';
import type { PlayerRow } from '../../src/types';
import { hashPassword, signPlayerSessionToken, signSessionToken } from '../../src/auth';

let counter = 0;

/** Creates a fresh admin user (DB must already be reset) and returns a ready-to-use auth header. */
export async function makeAdminAuthHeader(): Promise<{ Authorization: string }> {
  const passwordHash = await hashPassword('test-password-123');
  const user = createAdminUser({ username: `admin-${Date.now()}-${counter++}`, passwordHash });
  const token = signSessionToken({ sub: user.id, username: user.username });
  return { Authorization: `Bearer ${token}` };
}

/** Creates a fresh player account (DB must already be reset) and returns a ready-to-use auth header. */
export async function makePlayerAuthHeader(): Promise<{ Authorization: string }> {
  const { auth } = await makePlayerSession();
  return auth;
}

/** Same as `makePlayerAuthHeader`, but also hands back the player row for tests that need the id. */
export async function makePlayerSession(): Promise<{ auth: { Authorization: string }; player: PlayerRow }> {
  const passwordHash = await hashPassword('test-password-123');
  const player = createPlayer({ username: `player-${Date.now()}-${counter++}`, passwordHash });
  const token = signPlayerSessionToken({ sub: player.id, username: player.username });
  return { auth: { Authorization: `Bearer ${token}` }, player };
}
