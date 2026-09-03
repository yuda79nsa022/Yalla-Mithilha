import { createAdminUser } from '../../src/db';
import { hashPassword, signSessionToken } from '../../src/auth';

let counter = 0;

/** Creates a fresh admin user (DB must already be reset) and returns a ready-to-use auth header. */
export async function makeAdminAuthHeader(): Promise<{ Authorization: string }> {
  const passwordHash = await hashPassword('test-password-123');
  const user = createAdminUser({ username: `admin-${Date.now()}-${counter++}`, passwordHash });
  const token = signSessionToken({ sub: user.id, username: user.username });
  return { Authorization: `Bearer ${token}` };
}
