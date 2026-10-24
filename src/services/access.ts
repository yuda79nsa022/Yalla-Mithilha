/**
 * Which screens a guest may open. Everything else needs a signed-in player:
 * opening one by a bookmark or a typed address sends a guest to sign in
 * first, then straight back to that screen (see `app/_layout.tsx`).
 *
 * This only decides what the app shows. The data behind every screen is
 * protected by the server itself (every wallet, usage, checkout, game and
 * profile request needs a player session), so a screen opened some other
 * way still shows nothing of anyone's account.
 *
 * Plain TypeScript, no React Native — tested in __tests__/access.test.ts.
 */

const PUBLIC_PATHS = new Set([
  '/',
  '/home',
  '/account',
  '/language',
  '/privacy',
  // Opened by a phone's camera from the shared screen's QR code — never signed in.
  '/reveal',
]);

const SIGN_IN_PATH = '/account';

/** Whether a guest may open `pathname` without signing in. */
export function isPublicPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PUBLIC_PATHS.has(path);
}

/**
 * A `next` address worth returning to after sign-in, or `null`. Only this
 * app's own screens: a path starting with exactly one `/`, so a crafted link
 * (`//evil.example`, `/\evil.example`, `https://…`) can never send someone
 * off-site after they sign in. Never the sign-in screen itself.
 */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== 'string' || next.length > 500) return null;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
  if (/[\u0000-\u001f]/.test(next)) return null;
  const path = next.split(/[?#]/)[0];
  if (path === SIGN_IN_PATH || path === `${SIGN_IN_PATH}/`) return null;
  return next;
}

/** Where a guest opening `pathname` (with its query string, if any) is sent: sign-in, then back here. */
export function signInHref(pathname: string, search = ''): string {
  const next = search ? `${pathname}?${search}` : pathname;
  return `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`;
}
