/**
 * Client-side bookkeeping for a player session token's lifetime. The token
 * is a JWT whose signature only the server can check; this reads its `exp`
 * claim purely to know *when* to refresh it or treat it as ended — never to
 * decide whether it's genuine. The server still checks every request.
 */

/** Refresh once a token has less than this long left — half its 12-hour life. */
export const SESSION_REFRESH_WINDOW_MS = 6 * 60 * 60 * 1000;

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** base64url → string, without relying on `atob` (absent on some React Native engines). Throws on a malformed input. */
function decodeBase64Url(input: string): string {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of input.replace(/=+$/, '')) {
    const index = BASE64URL.indexOf(ch);
    if (index < 0) throw new Error('not base64url');
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  // The payload is JSON; decode it as UTF-8 so a non-ASCII username survives.
  return decodeURIComponent(bytes.map((b) => `%${b.toString(16).padStart(2, '0')}`).join(''));
}

/** When the token stops being accepted, in epoch ms — `null` for anything that doesn't carry a readable `exp`. */
export function tokenExpiresAt(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { exp?: unknown };
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export type SessionCheck = 'ok' | 'refresh' | 'expired';

/** What to do with a session right now: nothing, refresh it, or treat it as ended. A token with no readable expiry is left to the server to judge. */
export function checkSession(token: string, now: number): SessionCheck {
  const expiresAt = tokenExpiresAt(token);
  if (expiresAt === null) return 'ok';
  if (expiresAt <= now) return 'expired';
  return expiresAt - now <= SESSION_REFRESH_WINDOW_MS ? 'refresh' : 'ok';
}

/** Games left below this trigger the low-balance alert — matches the server's own threshold for its email. */
export const LOW_BALANCE_THRESHOLD = 2;
