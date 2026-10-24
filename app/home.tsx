import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, ButtonRow, Divider, LowBalanceAlert, LowBalanceBanner, Screen, Spacer, T } from '../src/ui/components';
import { CategoryGrid } from '../src/ui/Hero';
import { Logo } from '../src/ui/Logo';
import { colors, fonts, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';

export default function Home() {
  const {
    t,
    lang,
    homeContent,
    player,
    walletBalance,
    freeGameCredits,
    refreshWallet,
    charades,
    quitCharades,
  } = useApp();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 900;
  // A short phone screen can't hold the decorative category tiles as well
  // as everything else; game setup shows the real decks anyway.
  const showCategoryTiles = height >= 760;
  const shortPhone = !isWide && height < 760;

  useEffect(() => {
    if (player) void refreshWallet();
  }, [player, refreshWallet]);

  // Admin-editable via the mini CMS — falls back to the bundled i18n copy
  // until the first successful fetch (or if the server can't be reached).
  const tagline = (lang === 'ar' ? homeContent?.taglineAr : homeContent?.taglineEn) ?? t('app.tagline');
  const writeup = (lang === 'ar' ? homeContent?.writeupAr : homeContent?.writeupEn) ?? t('app.writeup');

  // Every page keeps its actions in the pinned footer: one primary (purple),
  // anything secondary beside it, outlined.
  const footer = charades ? (
    <ButtonRow>
      <Button
        label={t('resume.discard')}
        tone="secondary"
        showArrow={false}
        onPress={() => {
          quitCharades();
          router.push('/charades/draft');
        }}
      />
      <Button
        label={t('resume.continue')}
        showArrow={false}
        onPress={() => router.push(charades.lock === 'unlocked' ? '/charades/play' : '/charades/checkout')}
      />
    </ButtonRow>
  ) : player ? (
    <Button label={t('charades.home.startNew')} onPress={() => router.push('/charades/draft')} />
  ) : (
    <ButtonRow>
      <Button label={t('account.signIn')} tone="secondary" showArrow={false} onPress={() => router.push('/account')} />
      <Button label={t('account.createAccount')} showArrow={false} onPress={() => router.push('/account?mode=create')} />
    </ButtonRow>
  );

  // One block with its own small gap — spacing between its parts no longer
  // doubles up with the screen's gap.
  const accountSection = (
    <View style={styles.accountSection}>
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
              <T style={{ fontFamily: fonts.displayBlack, fontSize: 32, lineHeight: 38, color: colors.white }}>{walletBalance}</T>
              <T variant="label" color={colors.white} style={{ fontSize: 11, fontWeight: '500' }}>
                {t('home.creditsLabel')}
              </T>
            </View>
          </View>
          {freeGameCredits > 0 ? (
            <T variant="label" color={colors.purple} style={{ fontWeight: '500' }}>
              {t('charades.checkout.freeGamesLeft', { count: freeGameCredits })}
            </T>
          ) : null}
          <LowBalanceBanner />
          <LowBalanceAlert path="/home" />
        </>
      ) : (
        <>
          {!shortPhone ? (
            <T variant="label" color={colors.neutral700} style={{ fontWeight: '500' }}>
              {t('charades.home.guestNotice')}
            </T>
          ) : null}
        </>
      )}

      {charades ? (
        <>
          <View style={styles.resumeCard}>
            <T variant="heading">{t('charades.resume.title')}</T>
            <T variant="label" color={colors.neutral700}>
              {t('charades.resume.body')}
            </T>
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <Screen
      scroll
      wide
      header={{}}
      footer={footer}
    >
      {isWide ? (
        // A wide window uses its whole width: the words and the account on
        // one side, the logo and categories on the other — so the home page
        // fits a desktop screen without scrolling. The row fills the height
        // between header and footer with both columns centred in it, so the
        // spare space is shared evenly around the content instead of piling
        // up in patches under the shorter column and at the bottom.
        <View style={[styles.heroRow, lang === 'en' && styles.heroRowEn]}>
          <View style={[styles.heroTextCol, height < 700 && { gap: spacing.md }]}>
            <T
              variant="title"
              style={[styles.wideTagline, lang === 'ar' && { lineHeight: 56 }, height < 700 && { fontSize: 30, lineHeight: lang === 'ar' ? 42 : 38 }]}
            >
              {tagline}
            </T>
            {!player ? (
              <T variant="body" color={colors.neutral700} style={[styles.wideWriteup, lang === 'ar' && { lineHeight: 32 }]}>
                {writeup}
              </T>
            ) : null}
            <Divider />
            {accountSection}
          </View>
          <View style={styles.heroMediaCol}>
            <View style={styles.heroLogoWrap}>
              <Logo size="lg" />
            </View>
            <Spacer size={spacing.md} />
            <CategoryGrid />
          </View>
        </View>
      ) : (
        <>
          <Logo size="lg" />
          <T variant="heading" style={[{ fontSize: 20 }, shortPhone && { lineHeight: lang === 'ar' ? 30 : 26 }]}>
            {tagline}
          </T>
          {!player ? (
            <>
              {/* The very smallest phones (under 660px tall) skip the write-up to fit. */}
              {height >= 660 ? (
                <T
                  variant="label"
                  color={colors.neutral700}
                  style={[{ fontWeight: '500', fontSize: 12 }, shortPhone && { lineHeight: lang === 'ar' ? 20 : 18 }]}
                >
                  {writeup}
                </T>
              ) : null}
              {showCategoryTiles ? <CategoryGrid /> : null}
            </>
          ) : null}
          <Divider />
          {accountSection}
        </>
      )}

    </Screen>
  );
}

const styles = StyleSheet.create({
  accountSection: { gap: spacing.sm },
  heroRow: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 64, paddingHorizontal: spacing.lg },
  heroRowEn: { flexDirection: 'row' },
  heroTextCol: { flex: 1.15, gap: spacing.lg },
  wideTagline: { fontSize: 36, lineHeight: 46 },
  wideWriteup: { fontSize: 16, lineHeight: 28 },
  heroMediaCol: { flex: 1, justifyContent: 'center' },
  heroLogoWrap: { alignItems: 'center' },
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
  resumeCard: { borderWidth: 2, borderColor: colors.ink, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.white },
});
