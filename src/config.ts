/**
 * Overridable via an EXPO_PUBLIC_ env var (Expo inlines these at build time,
 * safe to expose to the client). Defaults to a local dev server — there is
 * no public deployment of the admin backend yet.
 */
export const CATALOGUE_API_URL =
  process.env.EXPO_PUBLIC_CATALOGUE_API_URL ?? 'http://localhost:4000';

/**
 * Where a Charades reveal QR code should point. Only needed when the shared
 * screen isn't a browser (so there's no page origin to fall back to) — see
 * `resolveRevealBaseUrl` in `src/engine/reveal.ts`.
 */
export const REVEAL_BASE_URL = process.env.EXPO_PUBLIC_REVEAL_BASE_URL ?? null;

/**
 * Sent with a synced card report so the server knows roughly which build
 * reported it — nothing more identifying than that. Kept manually in step
 * with package.json/app.json's `version`; there is no build step wiring
 * this to either file yet.
 */
export const APP_VERSION = '0.1.0';
