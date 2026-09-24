import { Platform } from 'react-native';
import type { Lang } from '../engine/types';

/**
 * "Bas Bedoon Kalam" brand system: ink rules instead of borders-with-radius,
 * hard offset shadows instead of blur, a cool purple/green pair on a warm
 * grey ground. oklch is the source of truth (see the comment above each
 * hex) but React Native has no oklch() colour parser on native, so every
 * token here is the pre-computed sRGB hex.
 */
export const colors = {
  /** oklch(0.20 0 0) approx — text, rules, shadows */
  ink: '#201E1D',
  /** page background */
  ground: '#F3F2F2',
  white: '#FFFFFF',
  /** oklch(0.52 0.22 300) — primary / team 1 */
  purple: '#8038D1',
  /** oklch(0.45 0.20 300) — hover, links */
  purple700: '#6928B0',
  /** oklch(0.66 0.18 300) — cube top face, future rounds */
  purpleTop: '#A473EE',
  /** oklch(0.40 0.18 300) — cube side face */
  purpleSide: '#591F97',
  /** oklch(0.80 0.20 140) — team 2, success ("عرفوها!") */
  green: '#6FDB55',
  /** timer, last 10 seconds only */
  red: '#EC3013',
  mutedBg: '#E4E2E2',
  mutedText: '#8A8583',
  neutral700: '#5B5654',

  // ---- legacy aliases -----------------------------------------------
  // Every screen file still imports these names; keeping them mapped onto
  // the new tokens means the rename didn't require touching every call
  // site's imports, only what each name points at.
  bg: '#F3F2F2',
  bgRaised: '#FFFFFF',
  bgSunken: '#FFFFFF',
  text: '#201E1D',
  textMuted: '#5B5654',
  border: '#201E1D',
  correct: '#6FDB55',
  skip: '#EC3013',
  brand: '#8038D1',
  accent: '#8038D1',
  overlay: 'rgba(32, 30, 29, 0.72)',

  // Deck-thumbnail accent colours, cycled through on the Charades hub.
  act: '#A473EE',
  taboo: '#8038D1',
  who: '#6FDB55',
  imitate: '#6928B0',
  lips: '#591F97',
  sound: '#EC3013',
  final: '#5B5654',

  teamA: '#8038D1',
  teamB: '#6FDB55',
} as const;

/** Text that sits on top of an accent colour block — purple/ink are both dark enough that white always reads best. */
export const onAccent = '#FFFFFF';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Zero everywhere — square corners are a deliberate brand rule, not a placeholder. */
export const radius = {
  sm: 0,
  md: 0,
  lg: 0,
  pill: 0,
} as const;

/**
 * Hard, zero-blur offset shadows — RTL, so the offset goes left/down like
 * the spec's `-6px 6px 0 ink`. LTR mirrors it to the right. React Native's
 * `boxShadow` string works on web (RN Web) and is ignored on native, where
 * `shadow*`/`elevation` below stand in; a screen composing a hard shadow
 * should spread both from `hardShadow()`.
 */
export function hardShadow(lang: Lang, color: string = colors.ink, size: 'lg' | 'sm' = 'lg') {
  const d = size === 'lg' ? 6 : 3;
  const dx = lang === 'ar' ? -d : d;
  return {
    boxShadow: `${dx}px ${d}px 0 ${color}`,
    shadowColor: color,
    shadowOffset: { width: dx, height: d },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: d,
  } as const;
}

/** The pressed-state offset shadow — half the travel of `hardShadow`. */
export function hardShadowPressed(lang: Lang, color: string = colors.ink) {
  return hardShadow(lang, color, 'sm');
}

/** The larger -8px/8px offset shadow used behind the acting-screen title/QR card. */
export function cardShadow(lang: Lang, color: string) {
  const dx = lang === 'ar' ? -8 : 8;
  return {
    boxShadow: `${dx}px 8px 0 ${color}`,
    shadowColor: color,
    shadowOffset: { width: dx, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  } as const;
}

/** ← in RTL, → in LTR — the one glyph every primary button/link ends with. */
export function endArrow(lang: Lang): string {
  return lang === 'ar' ? '←' : '→';
}

/** → in RTL (back points toward reading start), ← in LTR. */
export function backArrow(lang: Lang): string {
  return lang === 'ar' ? '→' : '←';
}

/**
 * Arabic needs more line height than Latin at the same size, and the system
 * Arabic faces differ per platform. Noto Kufi Arabic (bundled via
 * @expo-google-fonts) is used everywhere now, so this mostly matters for
 * the extra lineHeight boost below, not for picking a fallback face.
 */
export const fonts = {
  ar: 'NotoKufiArabic_500Medium',
  en: 'NotoKufiArabic_500Medium',
  arBold: 'NotoKufiArabic_700Bold',
  enBold: 'NotoKufiArabic_700Bold',
  arBlack: 'NotoKufiArabic_900Black',
  enBlack: 'NotoKufiArabic_900Black',
  /** Latin display bits only — EN toggle, the "BAS BEDOON KALAM" tag, scores, VS, timer digits. */
  display: Platform.select({ web: 'Archivo_800ExtraBold, sans-serif', default: 'Archivo_800ExtraBold' }),
  displayBlack: Platform.select({ web: 'Archivo_900Black, sans-serif', default: 'Archivo_900Black' }),
} as const;

/**
 * A custom, pre-weighted TTF (loaded via `useFonts`) doesn't get synthetic
 * bolding from the `fontWeight` CSS property the way a system font does —
 * the actual weight has to come from picking the right loaded family. `T`
 * uses this to turn a `type` variant's declared `fontWeight` into the
 * matching Noto Kufi Arabic file.
 */
export const FONT_BY_WEIGHT: Record<string, string> = {
  '400': 'NotoKufiArabic_400Regular',
  '500': 'NotoKufiArabic_500Medium',
  '700': 'NotoKufiArabic_700Bold',
  '900': 'NotoKufiArabic_900Black',
};

/** The font family list passed to `useFonts` in `src/ui/fonts.ts`. */
export const FONT_ASSET_KEYS = [
  'NotoKufiArabic_400Regular',
  'NotoKufiArabic_500Medium',
  'NotoKufiArabic_700Bold',
  'NotoKufiArabic_900Black',
  'Archivo_800ExtraBold',
  'Archivo_900Black',
] as const;

/**
 * Extra multiplier on top of `type[variant].lineHeight` applied only to
 * Arabic text — insurance against Noto Kufi Arabic's taller metrics vs.
 * Latin at the same pixel lineHeight.
 */
export const ARABIC_LINE_HEIGHT_BOOST = 1.15;

export const type = {
  display: { fontSize: 44, lineHeight: 52, fontWeight: '900' as const },
  title: { fontSize: 34, lineHeight: 42, fontWeight: '900' as const },
  heading: { fontSize: 22, lineHeight: 30, fontWeight: '700' as const },
  body: { fontSize: 18, lineHeight: 26, fontWeight: '500' as const },
  label: { fontSize: 15, lineHeight: 21, fontWeight: '700' as const },
  /** The card face during a round — read from across the room. */
  card: { fontSize: 38, lineHeight: 48, fontWeight: '900' as const },
  timer: { fontSize: 64, lineHeight: 68, fontWeight: '900' as const },
} as const;

/** Minimum tap target. Phones get passed around fast and land in odd hands. */
export const HIT_SIZE = 56;

export const durations = {
  fast: 140,
  normal: 240,
  slow: 420,
} as const;
