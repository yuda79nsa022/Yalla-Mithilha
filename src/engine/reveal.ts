/**
 * The actor's phone is a separate device from whatever is showing the game
 * (a laptop mirrored to a TV, a tablet propped up, or just the phone being
 * passed around). Instead of the title ever appearing on that shared
 * screen, it renders a QR code linking to this app's own `/reveal` page,
 * carrying a single-use token the server minted for this round (see
 * `mintRevealToken` in AppProvider.tsx and server/src/routes/reveal.ts) —
 * any phone's stock camera recognises the link and offers to open it, no
 * app install required. The server, not this opaque-but-decodable token
 * encoding an earlier version of this file used, is what actually stops a
 * second scan of the same code from showing the answer again. Deliberately
 * not under `/charades`: the server claims that whole path prefix for its
 * API and requires a player session for everything under it, which would
 * 401 a plain camera scan that carries no session at all.
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
