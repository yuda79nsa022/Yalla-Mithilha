/**
 * The actor's phone is a separate device from whatever is showing the game
 * (a laptop mirrored to a TV, a tablet propped up, or just the phone being
 * passed around). Instead of the title ever appearing on that shared
 * screen, it renders a QR code linking to this app's own `/reveal` page with
 * the title in the query string — any phone's stock camera recognises the
 * link and offers to open it, no app install required. Deliberately not
 * under `/charades`: the server claims that whole path prefix for its API
 * and requires a player session for everything under it, which would 401 a
 * plain camera scan that carries no session at all.
 */

/**
 * Picks the base URL a reveal link should point at: an explicitly
 * configured one wins (needed when the shared screen isn't a browser, so
 * there's no `window.location` to fall back to), otherwise the origin the
 * shared screen's own page is already being served from — the common case
 * when that screen is a browser on the same network as the TV.
 */
export function resolveRevealBaseUrl(configured: string | null, webOrigin: string | null): string | null {
  const base = configured?.trim() || webOrigin?.trim() || null;
  if (!base) return null;
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

/**
 * `imageUrl`, when given, must already be a fully-qualified absolute URL —
 * the reveal page has no config or API context of its own, so everything it
 * shows has to be self-contained in this link (see the file comment above).
 */
export function buildRevealUrl(
  baseUrl: string,
  title: string,
  categoryAr: string,
  categoryEn: string,
  imageUrl?: string
): string {
  const params = new URLSearchParams({ t: title, ca: categoryAr, ce: categoryEn });
  if (imageUrl) params.set('img', imageUrl);
  return `${baseUrl}/reveal?${params.toString()}`;
}
