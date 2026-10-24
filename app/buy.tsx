import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, ButtonRow, OptionCard, PageTitle, Screen, T } from '../src/ui/components';
import { colors, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';
import { useTopUp, type PaymentNotice } from '../src/state/useTopUp';
import { formatKwd } from '../src/services/walletApi';
import type { GameMode } from '../src/engine/game';

const NOTICE_KEY = {
  paid: 'charades.checkout.paymentReceived',
  pending: 'charades.checkout.paymentNotCompleted',
  failed: 'charades.checkout.paymentFailed',
  error: 'charades.checkout.paymentError',
} as const satisfies Record<PaymentNotice, string>;

/**
 * "Buy more games" — reached from the low-balance alert, its banner, and
 * the link in the low-balance email. Each purchase is one game's credit,
 * paid on MyFatoorah's page in a popup (see useTopUp); the credit is only
 * added once the server confirms the payment with MyFatoorah. Needs a
 * signed-in player, since the credit lands in their account's wallet.
 */
export default function Buy() {
  const { t, player, charades, walletBalance, freeGameCredits, walletBusy, walletError, refreshWallet, gamePriceFils, modifiedGamePriceFils } =
    useApp();
  const { busy, waiting, notice, topUp, cancelWaiting, simulateFailure } = useTopUp();
  const [mode, setMode] = useState<GameMode>(charades?.mode ?? 'classic');

  useEffect(() => {
    if (player) void refreshWallet();
  }, [player, refreshWallet]);

  // A guest (say, opening the low-balance email's link on a fresh browser)
  // never gets here — SignInGuard (app/_layout.tsx) sends them to sign in
  // first, and straight back here afterwards.
  if (!player) return null;

  const gamesLeft = walletBalance + freeGameCredits;
  const draftWaiting = charades !== null && charades.lock === 'locked';
  const priceFils = mode === 'classic' ? gamePriceFils : modifiedGamePriceFils;

  return (
    <Screen
      scroll
      header={{}}
      footer={
        <ButtonRow>
          {waiting ? (
            <Button label={t('payment.cancel')} tone="secondary" showArrow={false} onPress={cancelWaiting} />
          ) : draftWaiting ? (
            <Button label={t('buy.backToGame')} tone="secondary" showArrow={false} onPress={() => router.replace('/charades/checkout')} />
          ) : null}
          <Button
            label={t('buy.pay', { price: formatKwd(priceFils) })}
            disabled={priceFils <= 0}
            busy={busy || walletBusy || waiting}
            onPress={() => void topUp(mode)}
          />
        </ButtonRow>
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

      <T variant="label">{t('buy.choose')}</T>
      <OptionCard title={t('buy.classic', { price: formatKwd(gamePriceFils) })} selected={mode === 'classic'} onPress={() => setMode('classic')} />
      <OptionCard
        title={t('buy.modified', { price: formatKwd(modifiedGamePriceFils) })}
        selected={mode === 'modified'}
        onPress={() => setMode('modified')}
      />

      {waiting ? (
        <T variant="label" color={colors.purple}>
          {t('payment.waiting')}
        </T>
      ) : notice ? (
        <T variant="label" color={notice === 'paid' ? colors.purple : colors.red}>
          {t(NOTICE_KEY[notice])}
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
          <ButtonRow>
            <Button label={t('charades.checkout.simulateFailure')} tone="ghost" showArrow={false} onPress={() => void simulateFailure(mode)} />
          </ButtonRow>
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
