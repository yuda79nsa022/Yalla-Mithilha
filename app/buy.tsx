import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Button, PageTitle, Screen, T } from '../src/ui/components';
import { colors, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';
import { useTopUp } from '../src/state/useTopUp';
import { formatKwd } from '../src/services/walletApi';

/**
 * "Buy more games" — reached from the low-balance alert, its banner, and
 * the link in the low-balance email. Each purchase is one game's credit,
 * paid on MyFatoorah's page (see useTopUp); the result is checked with the
 * server when the player comes back. Needs a signed-in player, since the
 * credit lands in their account's wallet.
 */
export default function Buy() {
  const { t, player, charades, walletBalance, freeGameCredits, walletBusy, walletError, refreshWallet, gamePriceFils, modifiedGamePriceFils } =
    useApp();
  const { busy, notice, topUp, simulateFailure } = useTopUp();

  useEffect(() => {
    if (player) void refreshWallet();
  }, [player, refreshWallet]);

  // A guest (say, opening the email's link on a fresh browser) has no
  // wallet to add to yet — sign in first, which comes straight back here.
  if (!player) {
    return (
      <Screen
        scroll
        header={{}}
        footer={<Button label={t('charades.checkout.signInButton')} onPress={() => router.push('/account')} />}
      >
        <PageTitle>{t('buy.title')}</PageTitle>
        <T variant="body" color={colors.neutral700} style={{ fontSize: 13, fontWeight: '500' }}>
          {t('charades.home.guestNotice')}
        </T>
      </Screen>
    );
  }

  const gamesLeft = walletBalance + freeGameCredits;
  const draftWaiting = charades !== null && charades.lock === 'locked';

  return (
    <Screen
      scroll
      header={{}}
      footer={
        draftWaiting ? <Button label={t('buy.backToGame')} onPress={() => router.replace('/charades/checkout')} /> : undefined
      }
    >
      <PageTitle>{t('buy.title')}</PageTitle>
      <T variant="body" color={colors.neutral700} style={{ fontSize: 13, fontWeight: '500' }}>
        {t('buy.subtitle')}
      </T>

      <View style={styles.card}>
        <T variant="heading" color={colors.white}>
          {t('buy.gamesLeft', { count: gamesLeft })}
        </T>
      </View>

      <Button
        label={t('buy.classic', { price: formatKwd(gamePriceFils) })}
        busy={busy || walletBusy}
        onPress={() => void topUp('classic')}
      />
      <Button
        label={t('buy.modified', { price: formatKwd(modifiedGamePriceFils) })}
        tone="secondary"
        busy={busy || walletBusy}
        onPress={() => void topUp('modified')}
      />

      {notice ? (
        <T variant="label" color={notice === 'paid' ? colors.purple : colors.red}>
          {t(
            notice === 'paid'
              ? 'charades.checkout.paymentReceived'
              : notice === 'pending'
                ? 'charades.checkout.paymentNotCompleted'
                : notice === 'failed'
                  ? 'charades.checkout.paymentFailed'
                  : 'charades.checkout.paymentError'
          )}
        </T>
      ) : null}

      {walletError ? (
        <T variant="label" color={colors.red}>
          {walletError}
        </T>
      ) : null}

      {__DEV__ ? (
        <>
          <T variant="label" color={colors.neutral700}>
            {t('charades.checkout.devNotice')}
          </T>
          <Button label={t('charades.checkout.simulateFailure')} tone="ghost" showArrow={false} onPress={() => void simulateFailure('classic')} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = {
  card: {
    borderWidth: 2,
    borderColor: colors.ink,
    padding: spacing.md,
    backgroundColor: colors.purple,
    alignItems: 'center' as const,
  },
};
