import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors } from './theme';
import { T } from './components';
import { useApp } from '../state/AppProvider';

/** `xs` is the phone header's: the bar has the least room there. */
type Size = 'lg' | 'md' | 'sm' | 'xs';

const CUBE_FACE: Record<Size, number> = { lg: 100, md: 44, sm: 32, xs: 26 };

/**
 * `perspective`, `transform-style` and a `translateZ` transform op aren't
 * part of React Native's core ViewStyle type — they're real CSS properties
 * react-native-web forwards straight through to the DOM, though, and this
 * app's actual deployment is the web export (server/README.md), so casting
 * past the type here buys a real 3D cube on the platform that matters, at
 * the cost of falling back to a flat face on native (untested there).
 */
const web3d = (style: Record<string, unknown>) => (Platform.OS === 'web' ? (style as ViewStyle) : {});

/**
 * The zipped-mouth face content — brows, eye slits, zip bar/teeth/pull —
 * proportioned as percentages of the face so it scales cleanly across the
 * three sizes. Ported from design/reference.html screen 01's markup.
 */
function CubeFaceContent({ face }: { face: number }) {
  return (
    <>
      <View style={[styles.brow, { top: '21%', right: '17%', width: '24%', height: '7%', transform: [{ rotate: '-18deg' }] }]} />
      <View style={[styles.brow, { top: '21%', left: '17%', width: '24%', height: '7%', transform: [{ rotate: '18deg' }] }]} />
      <View style={[styles.eye, { top: '37%', right: '25%', width: '12%', height: '5%' }]} />
      <View style={[styles.eye, { top: '37%', left: '25%', width: '12%', height: '5%' }]} />
      <View style={[styles.zipBar, { bottom: '26%', left: '18%', right: '18%', height: '8%' }]} />
      {face >= 60 ? (
        <>
          {/* Individual tooth marks, not a solid bar — a zipper reads as a
              row of distinct teeth, not a plain stripe. */}
          {Array.from({ length: 7 }, (_, i) => (
            <View
              key={i}
              style={[styles.zipTooth, { bottom: '23%', left: `${23 + i * 8}%`, width: '3.5%', height: '12%' }]}
            />
          ))}
          <View style={[styles.zipPull, { bottom: '21%', left: '9%', width: '10%', height: '17%' }]} />
        </>
      ) : null}
    </>
  );
}

/**
 * A slow, gentle up/down float — opt-in per call site (the timer/acting
 * screen only; see Hero's `animateLogo` prop) rather than always-on, since
 * the cube now appears on every screen and a constant bob everywhere would
 * wear thin fast.
 */
function useBob(enabled: boolean) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, value]);

  return value.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
}

/** The 3D cube: front (zipped-mouth), side and top faces in true CSS 3D on web. */
function Cube({ size, animated = false }: { size: Size; animated?: boolean }) {
  const face = CUBE_FACE[size];
  const wrap = face + 40;
  const half = face / 2;
  const translateY = useBob(animated);
  return (
    <Animated.View style={animated ? { transform: [{ translateY }] } : undefined}>
      <View style={{ width: wrap, height: wrap * 1.07, position: 'relative' }}>
        {size === 'lg' ? (
          <View style={styles.steamRow}>
            <View style={[styles.steam, { width: 12, height: 12, transform: [{ rotate: '12deg' }, { translateY: 8 }] }]} />
            <View style={[styles.steam, { width: 18, height: 18, transform: [{ rotate: '-8deg' }] }]} />
            <View style={[styles.steam, { width: 10, height: 10, transform: [{ rotate: '20deg' }, { translateY: 12 }] }]} />
          </View>
        ) : null}
        <View
          style={[
            {
              position: 'absolute',
              left: (wrap - face) / 2,
              top: size === 'lg' ? 48 : (wrap * 1.07 - face) / 2,
              width: face,
              height: face,
            },
            web3d({ perspective: 800 }),
          ]}
        >
          <View
            style={[
              { width: face, height: face },
              web3d({ transformStyle: 'preserve-3d', transform: 'rotateX(-22deg) rotateY(-32deg)' }),
            ]}
          >
            <View
              style={[
                styles.cubeFace,
                { width: face, height: face, backgroundColor: colors.purple },
                web3d({ transform: `translateZ(${half}px)` }),
              ]}
            >
              <CubeFaceContent face={face} />
            </View>
            <View
              style={[
                styles.cubeFace,
                { width: face, height: face, backgroundColor: colors.purpleSide, backfaceVisibility: 'hidden' },
                web3d({ transform: `rotateY(90deg) translateZ(${half}px)` }),
              ]}
            />
            <View
              style={[
                styles.cubeFace,
                { width: face, height: face, backgroundColor: colors.purpleTop },
                web3d({ transform: `rotateX(90deg) translateZ(${half}px)` }),
              ]}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
/** Height of an admin-uploaded logo at each size — about the cube's own footprint. */
const CUSTOM_LOGO_HEIGHT: Record<Size, number> = { lg: 120, md: 48, sm: 36, xs: 30 };

/**
 * The built-in brand logo — cube and "بس! بدون كلام / BAS BEDOON KALAM"
 * wordmark in one transparent image, the same in English and Arabic. Also
 * served to the admin tool as server/public/brand-logo.png.
 */
const BRAND_LOGO = require('../../assets/images/brand-logo.png');
const BRAND_LOGO_ASPECT = 1368 / 799;
const BRAND_LOGO_HEIGHT: Record<Size, number> = { lg: 150, md: 72, sm: 48, xs: 36 };

/**
 * Whether the logo already spells out the app's name — true for the built-in
 * brand image, so the header doesn't print the name a second time beside it.
 */
export function useLogoShowsName(): boolean {
  const { t, appName, logoUrl } = useApp();
  return !logoUrl && appName === t('app.name');
}

/**
 * The brand mark. By default the built-in brand image (cube + wordmark) at
 * every size: `lg` for the splash and home hero, `md` beside the game,
 * `sm` in the header. An admin-uploaded logo replaces it everywhere. An app
 * renamed without a logo of its own falls back to the plain cube with its
 * new name, since the brand image spells out the original one.
 */
export function Logo({ size = 'lg', animated = false }: { size?: Size; animated?: boolean }) {
  const { lang, appName, logoUrl } = useApp();
  const showsName = useLogoShowsName();
  const translateY = useBob(animated && (showsName || Boolean(logoUrl)));

  if (showsName) {
    const height = BRAND_LOGO_HEIGHT[size];
    return (
      <Animated.View style={animated ? { transform: [{ translateY }] } : undefined}>
        <Image
          source={BRAND_LOGO}
          accessibilityLabel={appName}
          resizeMode="contain"
          style={{ height, width: Math.round(height * BRAND_LOGO_ASPECT) }}
        />
      </Animated.View>
    );
  }

  const mark = logoUrl ? (
    <Animated.View style={animated ? { transform: [{ translateY }] } : undefined}>
      <Image
        source={{ uri: logoUrl }}
        accessibilityLabel={appName}
        resizeMode="contain"
        style={{ height: CUSTOM_LOGO_HEIGHT[size], width: CUSTOM_LOGO_HEIGHT[size] * 1.6 }}
      />
    </Animated.View>
  ) : (
    <Cube size={size} animated={animated} />
  );
  if (size !== 'lg') return mark;
  return (
    <View style={[styles.row, lang === 'en' && styles.rowReversed]}>
      {mark}
      <T variant="title" style={styles.customName}>
        {appName}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 14 },
  rowReversed: { flexDirection: 'row' },
  steamRow: { position: 'absolute', top: 0, left: 22, flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  steam: { backgroundColor: colors.mutedText },
  cubeFace: { position: 'absolute', top: 0, left: 0 },
  brow: { position: 'absolute', backgroundColor: colors.ink },
  eye: { position: 'absolute', backgroundColor: colors.white },
  zipBar: { position: 'absolute', backgroundColor: colors.ink },
  zipTooth: { position: 'absolute', backgroundColor: colors.white },
  zipPull: { position: 'absolute', backgroundColor: colors.ink },
  customName: { flexShrink: 1 },
});
