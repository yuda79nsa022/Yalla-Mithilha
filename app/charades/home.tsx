import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, ConfirmModal, Divider, Screen, Spacer, T } from '../../src/ui/components';
import { colors, radius, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';

const DECK_THUMB_ACCENTS = [
  colors.act, colors.taboo, colors.who, colors.imitate, colors.lips, colors.sound, colors.final,
];

export default function CharadesHome() {
  const { t, lang, decks, player, walletBalance, refreshWallet, logoutPlayerAccount, charades, quitCharades } =
    useApp();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  useEffect(() => {
    if (player) void refreshWallet();
  }, [player, refreshWallet]);

  const logout = () => {
    setConfirmingLogout(false);
    logoutPlayerAccount();
    router.replace('/home');
  };

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="title">{t('charades.home.play')}</T>
      <T variant="body" color={colors.textMuted}>
        {t('charades.home.subtitle')}
      </T>

      <Spacer size={spacing.lg} />
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

      {decks.length ? (
        <>
          <Spacer size={spacing.lg} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.thumbRow}>
              {decks.map((deck, i) => (
                <Pressable
                  key={deck.id}
                  accessibilityRole="button"
                  accessibilityLabel={lang === 'ar' ? deck.nameAr : deck.nameEn}
                  onPress={() => router.push('/charades/draft')}
                  style={({ pressed }) => [styles.thumbCard, pressed && { opacity: 0.72 }]}
                >
                  <View
                    style={[
                      styles.thumbImage,
                      styles.thumbPlaceholder,
                      { backgroundColor: DECK_THUMB_ACCENTS[i % DECK_THUMB_ACCENTS.length] },
                    ]}
                  />
                  <T variant="label" numberOfLines={1} style={styles.thumbLabel}>
                    {lang === 'ar' ? deck.nameAr : deck.nameEn}
                  </T>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </>
      ) : null}

      <View style={{ flex: 1 }} />
      <Divider />
      <Button label={t('common.back')} tone="ghost" onPress={() => router.push('/home')} />

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
  thumbRow: { flexDirection: 'row', gap: spacing.sm },
  thumbCard: { width: 92, alignItems: 'center', gap: spacing.xs },
  thumbImage: { width: 84, height: 84, borderRadius: radius.md },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbLabel: { textAlign: 'center' },
});
