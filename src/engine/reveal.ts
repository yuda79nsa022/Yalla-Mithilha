/**
 * The actor's phone is a separate device from whatever is showing the game
 * (a laptop mirrored to a TV, a tablet propped up, or just the phone being
 * passed around). Instead of the title ever appearing on that shared
 * screen, it renders a QR code linking to this app's own `/charades/reveal`
 * page with the title in the query string — any phone's stock camera
 * recognises the link and offers to open it, no app install required.
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

export function buildRevealUrl(baseUrl: string, title: string): string {
  return `${baseUrl}/charades/reveal?t=${encodeURIComponent(title)}`;
}
