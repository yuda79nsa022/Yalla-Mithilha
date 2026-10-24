import { Redirect, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, ButtonRow, PageTitle, Screen, T, TextLink } from '../../src/ui/components';
import { colors, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { useTopUp, type PaymentNotice } from '../../src/state/useTopUp';
import { formatKwd } from '../../src/services/walletApi';

const NOTICE_KEY = {
  paid: 'payment.starting',
  pending: 'charades.checkout.paymentNotCompleted',
  failed: 'charades.checkout.paymentFailed',
  error: 'charades.checkout.paymentError',
} as const satisfies Record<PaymentNotice, string>;

export default function CharadesCheckout() {
  const {
    t,
    charades,
    player,
    gamePriceFils,
    modifiedGamePriceFils,
    walletBalance,
    freeGameCredits,
    walletBusy,
    walletError,
    refreshWallet,
    unlockCurrentCharades,
  } = useApp();
  const [starting, setStarting] = useState(false);

  const start = async () => {
    // Only a game still waiting to be paid for — this screen stays mounted
    // under the game, and must never re-deal one already in progress.
    if (!charades || charades.lock === 'unlocked' || starting) return;
    setStarting(true);
    const unlocked = await unlockCurrentCharades();
    setStarting(false);
    if (unlocked) router.push('/charades/play');
  };

  // The game only ever starts once the server says MyFatoorah was paid.
  const {
    busy: toppingUp,
    waiting,
    notice: paymentNotice,
    topUp: topUpFor,
    cancelWaiting,
    simulateFailure: simulateFailureFor,
    returnedPaymentId,
    returnedResult,
  } = useTopUp({ onPaid: () => void start() });

  useEffect(() => {
    if (player) void refreshWallet();
  }, [player, refreshWallet]);

  // A guest lands here with nothing to configure — skip straight to sign-in
  // instead of showing an explanatory stop first. `useFocusEffect` (not a
  // plain `useEffect`) is required: React Navigation keeps this screen
  // mounted after navigating away from it, so a plain effect's unchanged
  // dependencies would never refire if the guest hit "back" from the account
  // screen without signing in — leaving a blank screen stuck in the stack.
  // `replace` (not `push`) drops checkout from the stack entirely, so that
  // "back" is exactly the screen that led here (draft or home), not another
  // visit to this same dead end.
  useFocusEffect(
    useCallback(() => {
      if (charades && charades.lock !== 'unlocked' && !player) router.replace('/account');
    }, [charades, player])
  );

  // A payment started from the Buy-more screen also comes back through
  // here (the gateway's return route only knows this one address) — with no
  // game being set up, its result belongs on that screen instead.
  if (!charades && (returnedPaymentId || returnedResult)) {
    const query = returnedPaymentId
      ? `payment=${encodeURIComponent(returnedPaymentId)}&result=${encodeURIComponent(returnedResult ?? '')}`
      : `result=${encodeURIComponent(returnedResult ?? '')}`;
    return <Redirect href={`/buy?${query}`} />;
  }
  if (!charades) return <Redirect href="/charades/draft" />;
  if (charades.lock === 'unlocked') return <Redirect href="/charades/play" />;
  if (!player) return null;

  const mode = charades.mode;
  const priceFils = mode === 'classic' ? gamePriceFils : modifiedGamePriceFils;
  const hasFreeGame = freeGameCredits > 0;
  const canStart = hasFreeGame || walletBalance >= 1;

  // One action, always in the same place: start when there's a game to
  // spend, otherwise pay for one (MyFatoorah opens in a popup, and the game
  // starts by itself once the payment is confirmed).
  const footer = waiting ? (
    <ButtonRow>
      <Button label={t('payment.cancel')} tone="secondary" showArrow={false} onPress={cancelWaiting} />
      <Button label={t('charades.checkout.price', { price: formatKwd(priceFils) })} busy onPress={() => undefined} />
    </ButtonRow>
  ) : canStart ? (
    <ButtonRow>
      <Button label={t('charades.checkout.start')} busy={starting} onPress={start} />
    </ButtonRow>
  ) : (
    <ButtonRow>
      <Button
        label={t('charades.checkout.price', { price: formatKwd(priceFils) })}
        disabled={priceFils <= 0}
        busy={toppingUp || walletBusy || starting}
        onPress={() => void topUpFor(mode)}
      />
    </ButtonRow>
  );

  return (
    <Screen scroll header={{}} footer={footer}>
      <PageTitle>{t('charades.checkout.title')}</PageTitle>
      <T variant="body" color={colors.neutral700} style={{ fontSize: 13, fontWeight: '500' }}>
        {t('charades.checkout.subtitle')}
      </T>
      <TextLink label={t('charades.checkout.changeSetup')} onPress={() => router.replace('/charades/draft')} />

      <View style={styles.card}>
        <T variant="heading" color={colors.white}>
          {t('charades.checkout.walletBalance', { count: walletBalance })}
        </T>
      </View>

      {hasFreeGame ? (
        <T variant="label" color={colors.purple}>
          {t('charades.checkout.freeGamesLeft', { count: freeGameCredits })}
        </T>
      ) : null}

      {!canStart && !waiting ? (
        <T variant="label" color={colors.neutral700}>
          {t('charades.checkout.payToPlay')}
        </T>
      ) : null}

      {waiting ? (
        <T variant="label" color={colors.purple}>
          {t('payment.waiting')}
        </T>
      ) : paymentNotice ? (
        <T variant="label" color={paymentNotice === 'paid' ? colors.purple : colors.red}>
          {t(NOTICE_KEY[paymentNotice])}
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
            <Button label={t('charades.checkout.simulateFailure')} tone="ghost" showArrow={false} onPress={() => void simulateFailureFor(mode)} />
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
