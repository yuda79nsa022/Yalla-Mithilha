import { createAdminUser, createPlayer } from '../../src/db';
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
  const passwordHash = await hashPassword('test-password-123');
  const player = createPlayer({ username: `player-${Date.now()}-${counter++}`, passwordHash });
  const token = signPlayerSessionToken({ sub: player.id, username: player.username });
  return { Authorization: `Bearer ${token}` };
}
