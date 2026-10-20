import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, ConfirmModal, Divider, LowBalanceAlert, LowBalanceBanner, Screen, Spacer, T, TextLink } from '../src/ui/components';
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
    logoutPlayerAccount,
    charades,
    quitCharades,
  } = useApp();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

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
      header={{ titleColor: colors.purple }}
      footer={charades ? undefined : footer}
    >
      <Spacer size={spacing.sm} />
      {/* One layout at every width — a desktop window shows the same
          phone-shaped column as the app (see MAX_CONTENT_WIDTH). */}
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
          <CategoryGrid />
        </>
      ) : null}
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
              <T style={{ fontFamily: fonts.displayBlack, fontSize: 32, lineHeight: 38, color: colors.white }}>{walletBalance}</T>
              <T variant="label" color={colors.white} style={{ fontSize: 11, fontWeight: '500' }}>
                {t('home.creditsLabel')}
              </T>
            </View>
          </View>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.neutral700} style={{ fontWeight: '500' }}>
            {t('charades.checkout.walletBalance', { count: walletBalance })}
          </T>
          {freeGameCredits > 0 ? (
            <T variant="label" color={colors.purple} style={{ fontWeight: '500' }}>
              {t('charades.checkout.freeGamesLeft', { count: freeGameCredits })}
            </T>
          ) : null}
          <Spacer size={spacing.sm} />
          <LowBalanceBanner />
          <LowBalanceAlert path="/home" />
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
