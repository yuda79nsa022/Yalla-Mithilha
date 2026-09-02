import { Redirect, router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Divider, Screen, Spacer, T } from '../../src/ui/components';
import { colors, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';

export default function BoardCheckout() {
  const { t, board, boardCredits, unlockCurrentBoard, buyBoardCreditsDev } = useApp();
  const [busy, setBusy] = useState<'one' | 'bundle' | 'start' | null>(null);

  if (!board) return <Redirect href="/board/draft" />;
  if (board.lock === 'unlocked') return <Redirect href="/board/play" />;

  const buy = async (kind: 'one' | 'bundle') => {
    setBusy(kind);
    await buyBoardCreditsDev(kind === 'one' ? 1 : 2);
    setBusy(null);
  };

  const start = async () => {
    setBusy('start');
    const unlocked = await unlockCurrentBoard();
    setBusy(null);
    if (unlocked) router.push('/board/play');
  };

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="title">{t('board.checkout.title')}</T>
      <T variant="body" color={colors.textMuted}>
        {t('board.checkout.subtitle')}
      </T>
      <Spacer size={spacing.xl} />

      <View style={styles.card}>
        <T variant="heading" color={colors.gold}>
          {t('board.checkout.creditsAvailable', { count: boardCredits })}
        </T>
      </View>

      <Spacer />
      <Button
        label={t('board.checkout.buyOne')}
        tone="secondary"
        busy={busy === 'one'}
        onPress={() => buy('one')}
      />
      <Spacer size={spacing.sm} />
      <Button
        label={t('board.checkout.buyBundle')}
        tone="secondary"
        busy={busy === 'bundle'}
        onPress={() => buy('bundle')}
      />

      <Spacer size={spacing.sm} />
      <T variant="label" color={colors.textMuted}>
        {t('board.checkout.devNotice')}
      </T>

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
    borderColor: colors.gold,
    borderRadius: 18,
    padding: spacing.md,
    backgroundColor: colors.bgRaised,
    alignItems: 'center' as const,
  },
};
