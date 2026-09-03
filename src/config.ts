/**
 * Overridable via an EXPO_PUBLIC_ env var (Expo inlines these at build time,
 * safe to expose to the client). Defaults to a local dev server — there is
 * no public deployment of the admin backend yet.
 */
export const CATALOGUE_API_URL =
  process.env.EXPO_PUBLIC_CATALOGUE_API_URL ?? 'http://localhost:4000';

/**
 * Sent with a synced card report so the server knows roughly which build
 * reported it — nothing more identifying than that. Kept manually in step
 * with package.json/app.json's `version`; there is no build step wiring
 * this to either file yet.
 */
export const APP_VERSION = '0.1.0';
