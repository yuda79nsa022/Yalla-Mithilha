import { CATALOGUE_API_URL } from '../config';

/**
 * Only ever called as the fallback from the player app's own sign-in form
 * (`app/account.tsx`), after a player login already failed — an admin
 * still signs into the actual admin tool (a separate page, `/admin-ui`),
 * not into this app itself. This just means an admin no longer needs a
 * separate "Admin sign-in" link to find that form.
 */
export class AdminAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface AdminAccount {
  id: string;
  username: string;
}

export interface AdminAuthResult {
  token: string;
  user: AdminAccount;
}

function isAdminAccount(value: unknown): value is AdminAccount {
  if (!value || typeof value !== 'object') return false;
  const u = value as Record<string, unknown>;
  return typeof u.id === 'string' && typeof u.username === 'string';
}

export async function loginAdmin(
  username: string,
  password: string,
  baseUrl: string = CATALOGUE_API_URL,
  timeoutMs = 8000
): Promise<AdminAuthResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    });
    const data: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        data && typeof data === 'object' && typeof (data as Record<string, unknown>).error === 'string'
          ? ((data as Record<string, unknown>).error as string)
          : `request failed with status ${res.status}`;
      throw new AdminAuthError(message, res.status);
    }

    const d = (data ?? {}) as Record<string, unknown>;
    if (typeof d.token !== 'string' || !isAdminAccount(d.user)) {
      throw new AdminAuthError('unexpected response from server', res.status);
    }
    return { token: d.token, user: d.user };
  } catch (err) {
    if (err instanceof AdminAuthError) throw err;
    throw new AdminAuthError('could not reach the server', 0);
  } finally {
    clearTimeout(timer);
  }
}
