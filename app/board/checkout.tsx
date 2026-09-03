import { Redirect, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Divider, Screen, Spacer, T } from '../../src/ui/components';
import { colors, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';

export default function BoardCheckout() {
  const {
    t,
    board,
    player,
    boardCredits,
    boardCreditsBusy,
    boardCheckoutError,
    refreshBoardCredits,
    startBoardCheckout,
    confirmBoardCheckout,
    failBoardCheckout,
    unlockCurrentBoard,
  } = useApp();
  const [busy, setBusy] = useState<'one' | 'bundle' | 'start' | null>(null);

  useEffect(() => {
    if (player) void refreshBoardCredits();
  }, [player, refreshBoardCredits]);

  if (!board) return <Redirect href="/board/draft" />;
  if (board.lock === 'unlocked') return <Redirect href="/board/play" />;

  const buy = async (kind: 'one' | 'bundle') => {
    setBusy(kind);
    const payment = await startBoardCheckout(kind === 'one' ? 'single' : 'bundle2');
    if (payment) await confirmBoardCheckout(payment.id);
    setBusy(null);
  };

  const simulateFailure = async () => {
    setBusy('one');
    const payment = await startBoardCheckout('single');
    if (payment) await failBoardCheckout(payment.id);
    setBusy(null);
  };

  const start = async () => {
    setBusy('start');
    const unlocked = await unlockCurrentBoard();
    setBusy(null);
    if (unlocked) router.push('/board/play');
  };

  if (!player) {
    return (
      <Screen scroll>
        <Spacer size={spacing.md} />
        <T variant="title">{t('board.checkout.signInTitle')}</T>
        <T variant="body" color={colors.textMuted}>
          {t('board.checkout.signInBody')}
        </T>
        <Spacer size={spacing.xl} />
        <Button label={t('board.checkout.signInButton')} onPress={() => router.push('/account')} />
        <Spacer size={spacing.sm} />
        <Button label={t('common.back')} tone="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="title">{t('board.checkout.title')}</T>
      <T variant="body" color={colors.textMuted}>
        {t('board.checkout.subtitle')}
      </T>
      <Spacer size={spacing.xl} />

      <View style={styles.card}>
        <T variant="heading" color={colors.accent}>
          {t('board.checkout.creditsAvailable', { count: boardCredits })}
        </T>
      </View>

      <Spacer />
      <Button
        label={t('board.checkout.buyOne')}
        tone="secondary"
        busy={busy === 'one' || boardCreditsBusy}
        onPress={() => buy('one')}
      />
      <Spacer size={spacing.sm} />
      <Button
        label={t('board.checkout.buyBundle')}
        tone="secondary"
        busy={busy === 'bundle' || boardCreditsBusy}
        onPress={() => buy('bundle')}
      />

      {boardCheckoutError ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.skip}>
            {boardCheckoutError}
          </T>
        </>
      ) : null}

      <Spacer size={spacing.sm} />
      <T variant="label" color={colors.textMuted}>
        {t('board.checkout.devNotice')}
      </T>
      <Spacer size={spacing.xs} />
      <Button label={t('board.checkout.simulateFailure')} tone="ghost" onPress={simulateFailure} />

      <Spacer size={spacing.xl} />
      <Divider />
      <Spacer />
      <Button
        label={t('board.checkout.start')}
        disabled={boardCredits < 1}
        busy={busy === 'start'}
        onPress={start}
      />
      <Spacer size={spacing.sm} />
      <Button label={t('common.back')} tone="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = {
  card: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 18,
    padding: spacing.md,
    backgroundColor: colors.bgRaised,
    alignItems: 'center' as const,
  },
};
