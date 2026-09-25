import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { T } from './components';
import { Logo } from './Logo';
import { colors, hardShadow, spacing } from './theme';
import { useApp } from '../state/AppProvider';

function MoviesIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={9} width={18} height={11} stroke={color} strokeWidth={1.6} />
      <Path
        d="M3 9l2-5h3l-2 5M10 9l2-5h3l-2 5M17 9l1.5-5"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SongsIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={3} width={6} height={11} rx={3} stroke={color} strokeWidth={1.6} />
      <Path d="M6 11a6 6 0 0 0 12 0" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M12 17v4M9 21h6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function PlaysIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8c2 2 5 2 8 0s6-2 8 0" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M4 8c0 4 2.5 8 8 8s8-4 8-8" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M9 12.5c.6.6 1.4.9 3 .9s2.4-.3 3-.9" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function SeriesIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={6} width={18} height={13} stroke={color} strokeWidth={1.6} />
      <Path d="M8 6l3-3M16 6l-3-3" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M7 22h10" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

const CATEGORY_TILT = [-2, 1.5, -1.5, 2];

/** The 4 deck-category preview cards (movies/songs/plays/series) shown under the brand logo. */
export function CategoryGrid() {
  const { t, lang } = useApp();
  const categories = [
    { Icon: MoviesIcon, label: t('home.catMovies') },
    { Icon: SongsIcon, label: t('home.catSongs') },
    { Icon: PlaysIcon, label: t('home.catPlays') },
    { Icon: SeriesIcon, label: t('home.catSeries') },
  ];
  return (
    <View style={styles.categoryGrid}>
      {categories.map(({ Icon, label }, i) => (
        <View
          key={label}
          style={[
            styles.categoryCard,
            { transform: [{ rotate: `${CATEGORY_TILT[i]}deg` }] },
            hardShadow(lang, colors.ink, 'sm'),
          ]}
        >
          <Icon color={colors.purple} />
          <T variant="label" style={{ fontWeight: '700', fontSize: 12 }}>
            {label}
          </T>
        </View>
      ))}
    </View>
  );
}

/**
 * The brand logo plus the category showcase, as a standalone header block —
 * the home screen's own hero uses these two pieces alongside its tagline in
 * a custom layout, but every other screen just wants this combo as-is:
 * side by side on wide screens, stacked on narrow ones.
 */
export function Hero({ animateLogo = false }: { animateLogo?: boolean }) {
  const { lang } = useApp();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  if (isWide) {
    return (
      <View style={[styles.heroRow, lang === 'en' && styles.heroRowEn]}>
        <View style={styles.heroCol}>
          <View style={styles.heroLogoWrap}>
            <Logo size="lg" animated={animateLogo} />
          </View>
        </View>
        <View style={styles.heroCol}>
          <CategoryGrid />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Logo size="lg" animated={animateLogo} />
      <CategoryGrid />
    </View>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 40 },
  heroRowEn: { flexDirection: 'row' },
  heroCol: { flex: 1 },
  heroLogoWrap: { alignItems: 'center' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  categoryCard: {
    flexBasis: '46%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
});
