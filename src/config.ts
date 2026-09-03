/**
 * Overridable via an EXPO_PUBLIC_ env var (Expo inlines these at build time,
 * safe to expose to the client). Defaults to a local dev server — there is
 * no public deployment of the admin backend yet.
 */
export const CATALOGUE_API_URL =
  process.env.EXPO_PUBLIC_CATALOGUE_API_URL ?? 'http://localhost:4000';
