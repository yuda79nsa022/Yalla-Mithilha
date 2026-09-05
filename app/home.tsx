import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, ConfirmModal, Divider, Pill, Screen, Spacer, T } from '../src/ui/components';
import { colors, radius, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';
import { needsRestartForDirection } from '../src/platform';
import { track } from '../src/services/analytics';
import type { Lang } from '../src/engine/types';

function LanguageToggle() {
  const { lang, prefs, setPrefs, t } = useApp();
  const next: Lang = lang === 'ar' ? 'en' : 'ar';
  const label = next === 'ar' ? 'العربية' : 'English';
  // Whether the *currently active* language's direction hasn't taken full
  // effect yet — same check as the dedicated language screen. Checking the
  // not-yet-chosen `next` language here instead would be true by definition
  // (switching direction always needs a restart), which is never useful
  // information before the player has even tapped anything.
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
        style={({ pressed }) => pressed && { opacity: 0.72 }}
      >
        <Pill text={label} color={colors.brand} />
      </Pressable>
      {restartNeeded ? (
        <T variant="label" color={colors.accent} align="right" style={{ maxWidth: 160 }}>
          {t('lang.restartNotice')}
        </T>
      ) : null}
    </View>
  );
}

export default function Home() {
  const { t, player, walletBalance, refreshWallet, logoutPlayerAccount, charades, quitCharades } = useApp();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  useEffect(() => {
    if (player) void refreshWallet();
  }, [player, refreshWallet]);

  const logout = () => {
    setConfirmingLogout(false);
    logoutPlayerAccount();
  };

  return (
    <Screen scroll>
      <Spacer size={spacing.xl} />
      <View style={styles.topRow}>
        <View style={styles.band}>
          {Array.from({ length: 9 }, (_, i) => (
            <View
              key={i}
              style={[styles.chevron, { backgroundColor: i % 2 ? colors.accent : colors.brand }]}
            />
          ))}
        </View>
        <LanguageToggle />
      </View>
      <T variant="display">{t('app.name')}</T>
      <T variant="body" color={colors.textMuted}>
        {t('app.tagline')}
      </T>

      <Spacer size={spacing.xl} />
      <View style={styles.accountCard}>
        {player ? (
          <>
            <T variant="heading">{t('account.loggedInAs', { username: player.username })}</T>
            <T variant="label" color={colors.textMuted}>
              {t('charades.checkout.walletBalance', { count: walletBalance })}
            </T>
            <Spacer size={spacing.sm} />
            <Button label={t('account.logout')} tone="ghost" onPress={() => setConfirmingLogout(true)} />
          </>
        ) : (
          <>
            <T variant="label" color={colors.textMuted}>
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
      </View>

      <Spacer size={spacing.lg} />
      {charades ? (
        <View style={styles.resumeCard}>
          <T variant="heading">{t('charades.resume.title')}</T>
          <T variant="label" color={colors.textMuted}>
            {t('charades.resume.body')}
          </T>
          <Spacer size={spacing.sm} />
          <Button
            label={t('resume.continue')}
            accent={colors.accent}
            onPress={() =>
              router.push(charades.lock === 'unlocked' ? '/charades/play' : '/charades/checkout')
            }
          />
          <Spacer size={spacing.sm} />
          <Button
            label={t('resume.discard')}
            tone="ghost"
            onPress={() => {
              quitCharades();
              router.push('/charades/draft');
            }}
          />
        </View>
      ) : (
        <Button
          label={t('charades.home.startNew')}
          accent={colors.accent}
          onPress={() => router.push('/charades/draft')}
        />
      )}

      <Spacer size={spacing.lg} />
      <Button label={t('home.settings')} tone="secondary" onPress={() => router.push('/settings')} />

      <View style={{ flex: 1 }} />
      <Divider />
      <Button label={t('home.about')} tone="ghost" onPress={() => router.push('/privacy')} />

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
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.md },
  band: { flexDirection: 'row', gap: 6 },
  chevron: { width: 14, height: 14, transform: [{ rotate: '45deg' }], borderRadius: 2 },
  accountCard: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.bgRaised,
  },
  resumeCard: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.bgRaised,
  },
});
