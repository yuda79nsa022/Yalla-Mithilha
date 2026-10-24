import { CATALOGUE_API_URL } from '../config';
import type { Lang } from '../engine/types';

/** The admin-set app name, logo and timezone — see the server's `GET /charades/branding`. */
export interface Branding {
  appNameAr: string;
  appNameEn: string;
  /** A path relative to CATALOGUE_API_URL, or `null` for the built-in logo. */
  logoPath: string | null;
  /** IANA timezone every date in the app is shown in. */
  timezone: string;
}

/** The timezone dates are shown in until the server's branding arrives — the one the app is built for. */
export const DEFAULT_TIMEZONE = 'Asia/Kuwait';

export async function getBranding(timeoutMs = 8000): Promise<Branding> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${CATALOGUE_API_URL}/charades/branding`, { signal: controller.signal });
    if (!res.ok) throw new Error(`branding request failed with status ${res.status}`);
    return (await res.json()) as Branding;
  } finally {
    clearTimeout(timer);
  }
}

/** The app's name in `lang`, or `fallback` (the bundled i18n name) until the branding has loaded. */
export function appNameFor(branding: Branding | null, lang: Lang, fallback: string): string {
  const name = lang === 'ar' ? branding?.appNameAr : branding?.appNameEn;
  return name?.trim() ? name : fallback;
}

/** The logo's full URL, or `null` for the built-in one. */
export function logoUrlFor(branding: Branding | null, apiUrl: string = CATALOGUE_API_URL): string | null {
  return branding?.logoPath ? `${apiUrl}${branding.logoPath}` : null;
}

/**
 * A timestamp as the player reads it — in the admin-set timezone, not the
 * device's. A runtime whose Intl doesn't know the zone falls back to the
 * device's own rather than showing nothing.
 */
export function formatDateTime(ts: number, lang: Lang, timezone: string, withTime: boolean): string {
  const locale = lang === 'ar' ? 'ar-KW' : 'en-GB';
  const options: Intl.DateTimeFormatOptions = withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' };
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone }).format(ts);
  } catch {
    return new Intl.DateTimeFormat(locale, options).format(ts);
  }
}
