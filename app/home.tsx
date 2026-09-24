import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Button, ConfirmModal, Divider, Screen, Spacer, T, TextLink } from '../src/ui/components';
import { Logo } from '../src/ui/Logo';
import { colors, fonts, hardShadow, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';
import { needsRestartForDirection } from '../src/platform';
import { track } from '../src/services/analytics';
import type { Lang } from '../src/engine/types';

function LanguageToggle() {
  const { lang, prefs, setPrefs, t } = useApp();
  const next: Lang = lang === 'ar' ? 'en' : 'ar';
  const label = next === 'ar' ? 'AR' : 'EN';
  const restartNeeded = prefs.lang !== null && needsRestartForDirection(lang);

  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          setPrefs({ lang: next });
          track({ name: 'language_changed', lang: next });
        }}
        style={({ pressed }) => [styles.langToggle, pressed && { backgroundColor: colors.ink }]}
      >
        {({ pressed }: { pressed: boolean }) => (
          <T style={{ fontFamily: fonts.display, fontSize: 13, letterSpacing: 1, color: pressed ? colors.white : colors.purple }}>
            {label}
          </T>
        )}
      </Pressable>
      {restartNeeded ? (
        <T variant="label" color={colors.purple} align="right" style={{ maxWidth: 160 }}>
          {t('lang.restartNotice')}
        </T>
      ) : null}
    </View>
  );
}

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

export default function Home() {
  const { t, lang, homeContent, player, walletBalance, refreshWallet, logoutPlayerAccount, charades, quitCharades } =
    useApp();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const categories = [
    { Icon: MoviesIcon, label: t('home.catMovies') },
    { Icon: SongsIcon, label: t('home.catSongs') },
    { Icon: PlaysIcon, label: t('home.catPlays') },
    { Icon: SeriesIcon, label: t('home.catSeries') },
  ];

  useEffect(() => {
    if (player) void refreshWallet();
  }, [player, refreshWallet]);

  const logout = () => {
    setConfirmingLogout(false);
    logoutPlayerAccount();
  };

  // Admin-editable via the mini CMS — falls back to the bundled i18n copy
  // until the first successful fetch (or if the server can't be reached).
  const tagline = (lang === 'ar' ? homeContent?.taglineAr : homeContent?.taglineEn) ?? t('app.tagline');
  const writeup = (lang === 'ar' ? homeContent?.writeupAr : homeContent?.writeupEn) ?? t('app.writeup');

  const footer = (
    <Button label={t('charades.home.startNew')} onPress={() => router.push('/charades/draft')} />
  );

  return (
    <Screen
      scroll
      header={{ end: <LanguageToggle />, titleColor: colors.purple }}
      footer={charades ? undefined : footer}
    >
      <Spacer size={spacing.sm} />
      {isWide ? (
        <View style={[styles.heroRow, lang === 'en' && styles.heroRowEn]}>
          <View style={styles.heroTextCol}>
            <T variant="heading" style={{ fontSize: 24 }}>
              {tagline}
            </T>
            {!player ? (
              <>
                <Spacer size={spacing.sm} />
                <T variant="label" color={colors.neutral700} style={{ fontWeight: '500', fontSize: 12 }}>
                  {writeup}
                </T>
              </>
            ) : null}
          </View>
          <View style={styles.heroMediaCol}>
            <View style={styles.heroLogoWrap}>
              <Logo size="lg" />
            </View>
            {!player ? (
              <>
                <Spacer size={spacing.md} />
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
              </>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          <Logo size="lg" />
          <Spacer size={spacing.md} />
          <T variant="heading" style={{ fontSize: 20 }}>
            {tagline}
          </T>
          {!player ? (
            <>
              <Spacer size={spacing.sm} />
              <T variant="label" color={colors.neutral700} style={{ fontWeight: '500', fontSize: 12 }}>
                {writeup}
              </T>
              <Spacer size={spacing.sm} />
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
            </>
          ) : null}
        </>
      )}
      <Spacer size={spacing.md} />
      <Divider />
      <Spacer size={spacing.md} />

      {player ? (
        <>
          <View style={styles.accountCard}>
            <View style={styles.accountCardInfo}>
              <T variant="label" color={colors.neutral700} style={{ fontSize: 12, fontWeight: '500' }}>
                {t('home.loggedInAsLabel')}
              </T>
              <T style={{ fontFamily: fonts.displayBlack, fontSize: 22 }} numberOfLines={1}>
                {player.username}
              </T>
            </View>
            <View style={styles.accountCardCredit}>
              <T style={{ fontFamily: fonts.displayBlack, fontSize: 32, color: colors.white }}>{walletBalance}</T>
              <T variant="label" color={colors.white} style={{ fontSize: 11, fontWeight: '500' }}>
                {t('home.creditsLabel')}
              </T>
            </View>
          </View>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.neutral700} style={{ fontWeight: '500' }}>
            {t('charades.checkout.walletBalance', { count: walletBalance })}
          </T>
          <Spacer size={spacing.xs} />
          <TextLink label={t('account.logout')} onPress={() => setConfirmingLogout(true)} />
        </>
      ) : (
        <>
          <T variant="label" color={colors.neutral700} style={{ fontWeight: '500' }}>
            {t('charades.home.guestNotice')}
          </T>
          <Spacer size={spacing.sm} />
          <Button
            label={t('charades.checkout.signInButton')}
            tone="secondary"
            onPress={() => router.push('/account')}
          />
        </>
      )}

      {charades ? (
        <>
          <Spacer size={spacing.lg} />
          <View style={styles.resumeCard}>
            <T variant="heading">{t('charades.resume.title')}</T>
            <T variant="label" color={colors.neutral700}>
              {t('charades.resume.body')}
            </T>
            <Spacer size={spacing.sm} />
            <Button
              label={t('resume.continue')}
              onPress={() => router.push(charades.lock === 'unlocked' ? '/charades/play' : '/charades/checkout')}
            />
            <Spacer size={spacing.sm} />
            <Button
              label={t('resume.discard')}
              tone="ghost"
              showArrow={false}
              onPress={() => {
                quitCharades();
                router.push('/charades/draft');
              }}
            />
          </View>
        </>
      ) : null}

      <ConfirmModal
        visible={confirmingLogout}
        title={t('account.logout')}
        body={t('account.logoutConfirm')}
        confirmLabel={t('common.yes')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={logout}
        onCancel={() => setConfirmingLogout(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  langToggle: {
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  heroRow: { flexDirection: 'row-reverse', alignItems: 'stretch', gap: 40 },
  heroRowEn: { flexDirection: 'row' },
  heroTextCol: { flex: 1.15, justifyContent: 'center' },
  heroMediaCol: { flex: 1, justifyContent: 'center' },
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
  accountCard: { flexDirection: 'row', borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.white },
  accountCardInfo: { flex: 1, padding: 14, gap: 2 },
  accountCardCredit: {
    padding: 14,
    backgroundColor: colors.purple,
    borderLeftWidth: 2,
    borderLeftColor: colors.ink,
    justifyContent: 'center',
    minWidth: 90,
  },
  resumeCard: { borderWidth: 2, borderColor: colors.ink, padding: spacing.md, backgroundColor: colors.white },
});
