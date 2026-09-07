/**
 * Detects a browser page origin without importing 'react-native' — some
 * test files transitively reach this module, and react-native's package
 * uses ESM syntax this project's plain ts-jest setup doesn't transform (see
 * __tests__/config.test.ts). `location` only ever exists in a browser
 * context in the first place, so this is equivalent to an explicit
 * `Platform.OS === 'web'` check without the import.
 */
function webOrigin(): string | null {
  const g = globalThis as { location?: { origin?: string } };
  return g.location?.origin ?? null;
}

/**
 * An explicitly configured URL always wins. Failing that, on web, this
 * falls back to the page's own origin — the deployed player app and its API
 * are one pm2 process serving one origin (see server/README.md), so a
 * production web build normally has nothing to configure at all, and can't
 * be pointed at the wrong host the way a hardcoded default risked. Native
 * has no page origin to fall back to, so `fallback` (a local dev server)
 * applies there — and on web too, but only when `webOriginValue` is also
 * unavailable, which happens during local web development if the Metro dev
 * server and the API server are on different ports (see README.md — that
 * case still needs the env var set explicitly, same as before).
 */
export function resolveCatalogueApiUrl(
  configured: string | undefined,
  webOriginValue: string | null,
  fallback: string
): string {
  const trimmed = configured?.trim();
  if (trimmed) return trimmed;
  if (webOriginValue) return webOriginValue;
  return fallback;
}

/**
 * Overridable via an EXPO_PUBLIC_ env var (Expo inlines these at build time,
 * safe to expose to the client).
 */
export const CATALOGUE_API_URL = resolveCatalogueApiUrl(
  process.env.EXPO_PUBLIC_CATALOGUE_API_URL,
  webOrigin(),
  'http://localhost:4000'
);

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
