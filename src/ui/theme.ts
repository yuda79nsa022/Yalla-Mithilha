import { Platform } from 'react-native';
import type { MiniGameId } from '../engine/types';

/**
 * Visual direction: a lit room at night. The base is a deep plum rather than
 * black so the colour blocks feel warm instead of clinical, and every
 * mini-game owns one saturated hue that fills the whole screen — from three
 * metres away you should know which game is running before you read a word.
 */
export const colors = {
  bg: '#17102A',
  bgRaised: '#221838',
  bgSunken: '#0F0A1D',
  text: '#FFF6EC',
  textMuted: '#B7A9C9',
  border: '#3A2D55',
  correct: '#3DDC91',
  skip: '#FF7A6B',
  gold: '#FFC94D',
  overlay: 'rgba(15, 10, 29, 0.92)',

  // Mini-game identity colours.
  act: '#FFB020',
  taboo: '#FF5A6E',
  who: '#3FC7F4',
  imitate: '#B98BFF',
  lips: '#4FE3B0',
  sound: '#FF8FB0',
  final: '#FFD75E',

  teamA: '#FF5A6E',
  teamB: '#3FC7F4',
} as const;

export function miniGameColor(game: MiniGameId): string {
  return colors[game];
}

/** Text that sits on top of a mini-game colour block. */
export const onAccent = '#1B1130';

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
 * render Kuwaiti text cleanly; a bundled face is a production task.
 */
export const fonts = {
  ar: Platform.select({ ios: 'Geeza Pro', android: 'sans-serif', default: 'System' }),
  en: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
} as const;

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
