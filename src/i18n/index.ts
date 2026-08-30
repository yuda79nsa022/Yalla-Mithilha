import type { Lang } from '../engine/types';
import { ar, type TranslationKey } from './ar';
import { en } from './en';

export type { TranslationKey };

const CATALOGUES: Record<Lang, Record<TranslationKey, string>> = {
  ar: ar as unknown as Record<TranslationKey, string>,
  en,
};

export type TranslateParams = Record<string, string | number>;

/**
 * Deliberately tiny. A full i18n library buys plural rules and date
 * formatting we do not need yet, at the cost of a dependency that has to work
 * inside Hermes. `{{name}}` interpolation covers every string we ship.
 */
export function translate(lang: Lang, key: TranslationKey, params?: TranslateParams): string {
  const catalogue = CATALOGUES[lang] ?? CATALOGUES.en;
  const template = catalogue[key] ?? CATALOGUES.en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

export function makeTranslator(lang: Lang) {
  return (key: TranslationKey, params?: TranslateParams) => translate(lang, key, params);
}

export function isRtl(lang: Lang): boolean {
  return lang === 'ar';
}

export function directionFor(lang: Lang): 'rtl' | 'ltr' {
  return isRtl(lang) ? 'rtl' : 'ltr';
}

/** `flex-start` in an RTL tree still means "leading edge", so this is only
 * needed where a value must be an absolute side (shadows, icon mirroring). */
export function leadingSide(lang: Lang): 'left' | 'right' {
  return isRtl(lang) ? 'right' : 'left';
}

export function allKeys(): TranslationKey[] {
  return Object.keys(ar) as TranslationKey[];
}

/** Keys present in Arabic but missing or empty in another catalogue. */
export function missingKeys(lang: Lang): TranslationKey[] {
  const catalogue = CATALOGUES[lang];
  return allKeys().filter((k) => !catalogue[k] || !String(catalogue[k]).trim());
}

/** Arabic-Indic digits read more naturally inside Arabic sentences. */
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function formatNumber(lang: Lang, value: number): string {
  const western = String(value);
  if (lang !== 'ar') return western;
  return western.replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
}

/** Detects the app language from a device locale such as `ar-KW`. */
export function langFromLocale(locale: string | null | undefined): Lang {
  if (!locale) return 'en';
  return locale.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}
