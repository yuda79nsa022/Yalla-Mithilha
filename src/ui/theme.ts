import { Platform } from 'react-native';

/**
 * Visual direction: the app's own poster. Warm paper cream instead of black
 * or white, deep ink-navy for reading text and line art, hot pink as the one
 * colour that means "tap this." Palette lifted straight from the Yalla
 * Mithilha logo (cream ground, blue illustration, pink accent).
 */
export const colors = {
  bg: '#F7F0DF',
  bgRaised: '#FFFCF4',
  bgSunken: '#EDE1C3',
  text: '#17222E',
  textMuted: '#57697E',
  border: '#D8C79C',
  correct: '#1F9E6C',
  skip: '#C23A2E',
  /** Poster blue, straight off the logo's masks and film reel. Chrome and brand marks. */
  brand: '#246E9C',
  /** The one colour that means "tap this" — the logo's hand gesture and ticket stubs. */
  accent: '#E8368F',
  overlay: 'rgba(247, 240, 223, 0.94)',

  // Deck-thumbnail accent colours, cycled through on the Charades hub.
  act: '#F0A23C',
  taboo: '#F0614C',
  who: '#4FB6E0',
  imitate: '#A98BEE',
  lips: '#33C9A5',
  sound: '#F17FA6',
  final: '#F5C64B',

  teamA: '#F0614C',
  teamB: '#4FB6E0',
} as const;

/** Text that sits on top of an accent colour block. */
export const onAccent = '#17222E';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 18,
  lg: 28,
  pill: 999,
} as const;

/**
 * Arabic needs more line height than Latin at the same size, and the system
 * Arabic faces differ per platform. Naskh on iOS and the Android default both
 * render Kuwaiti text cleanly; a bundled face is a production task. On web,
 * with no fontFamily set at all, the browser falls back to whatever default
 * font it has for Arabic script — which varies by OS and can have far taller
 * line metrics than Latin, causing wrapped Arabic text to visually overlap
 * the line below it if lineHeight isn't generous enough. Tahoma is present
 * on effectively every Windows machine and has solid, predictable Arabic
 * metrics, which is why it leads the web fallback stack here.
 */
export const fonts = {
  ar: Platform.select({
    ios: 'Geeza Pro',
    android: 'sans-serif',
    web: 'Tahoma, "Segoe UI", Arial, sans-serif',
    default: 'System',
  }),
  en: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: '-apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    default: 'System',
  }),
} as const;

/**
 * Extra multiplier on top of `type[variant].lineHeight` applied only to
 * Arabic text (see `fonts` above) — insurance against whatever font a given
 * platform actually renders it in still needing more vertical room than a
 * fixed pixel lineHeight tuned for Latin metrics provides.
 */
export const ARABIC_LINE_HEIGHT_BOOST = 1.3;

export const type = {
  display: { fontSize: 44, lineHeight: 56, fontWeight: '800' as const },
  title: { fontSize: 30, lineHeight: 40, fontWeight: '800' as const },
  heading: { fontSize: 22, lineHeight: 32, fontWeight: '700' as const },
  body: { fontSize: 18, lineHeight: 28, fontWeight: '500' as const },
  label: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
  /** The card face during a round — read from across the room. */
  card: { fontSize: 38, lineHeight: 52, fontWeight: '800' as const },
  timer: { fontSize: 64, lineHeight: 70, fontWeight: '800' as const },
} as const;

/** Minimum tap target. Phones get passed around fast and land in odd hands. */
export const HIT_SIZE = 56;

export const durations = {
  fast: 140,
  normal: 240,
  slow: 420,
} as const;
