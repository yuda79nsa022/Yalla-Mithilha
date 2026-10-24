import React, { useEffect, useRef, useState } from 'react';
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
/**
 * The built-in brand logo — cube and "بس! بدون كلام / BAS BEDOON KALAM"
 * wordmark in one transparent image, the same in English and Arabic. Also
 * served to the admin tool as server/public/brand-logo.png.
 */
const BRAND_LOGO = require('../../assets/images/brand-logo.png');
const BRAND_LOGO_ASPECT = 1368 / 799;

/** How tall a logo image is at each size; its width follows its own proportions. */
const LOGO_HEIGHT: Record<Size, number> = { lg: 150, md: 72, sm: 52, xs: 34 };

/**
 * An uploaded logo's width-to-height ratio, read from the image itself — a
 * fixed box squeezed a wide logo down to a sliver. Square until it's known.
 */
function useImageAspect(uri: string | null): number {
  const [aspect, setAspect] = useState(1);
  useEffect(() => {
    if (!uri) return;
    let live = true;
    Image.getSize(
      uri,
      (w, h) => live && h > 0 && setAspect(w / h),
      () => undefined
    );
    return () => {
      live = false;
    };
  }, [uri]);
  return aspect;
}

/**
 * Whether the logo is a picture (the built-in brand image, or one an admin
 * uploaded) rather than the plain cube. A picture is the brand on its own —
 * nothing prints the app's name beside it; the cube always comes with it.
 */
export function useLogoIsImage(): boolean {
  const { t, appName, logoUrl } = useApp();
  return Boolean(logoUrl) || appName === t('app.name');
}

/**
 * The brand mark, the same in English and Arabic: the built-in brand image,
 * or the logo an admin uploaded in its place. `lg` is the splash and home
 * hero, `md` beside the game, `sm` the header, `xs` the phone header. An app
 * renamed without a logo of its own gets the plain cube with its new name
 * instead, since the brand image spells out the original one.
 */
export function Logo({ size = 'lg', animated = false }: { size?: Size; animated?: boolean }) {
  const { lang, appName, logoUrl } = useApp();
  const isImage = useLogoIsImage();
  const uploadedAspect = useImageAspect(logoUrl);
  const translateY = useBob(animated && isImage);

  if (isImage) {
    const height = LOGO_HEIGHT[size];
    const aspect = logoUrl ? uploadedAspect : BRAND_LOGO_ASPECT;
    return (
      <Animated.View style={animated ? { transform: [{ translateY }] } : undefined}>
        <Image
          source={logoUrl ? { uri: logoUrl } : BRAND_LOGO}
          accessibilityLabel={appName}
          resizeMode="contain"
          style={{ height, width: Math.round(height * aspect) }}
        />
      </Animated.View>
    );
  }

  if (size !== 'lg') return <Cube size={size} animated={animated} />;
  return (
    <View style={[styles.row, lang === 'en' && styles.rowReversed]}>
      <Cube size={size} animated={animated} />
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
