import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Screen, Spacer, T } from '../src/ui/components';
import { colors, miniGameColor, radius, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';
import { ALL_MINI_GAMES } from '../src/engine/config';

const STEPS = ['howto.step1', 'howto.step2', 'howto.step3', 'howto.step4', 'howto.step5'] as const;

export default function HowToPlay() {
  const { t, setPrefs } = useApp();

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="title">{t('howto.title')}</T>
      <Spacer />

      <View style={{ gap: spacing.md }}>
        {STEPS.map((key, i) => (
          <View key={key} style={styles.step}>
            <View style={styles.number}>
              <T variant="label" color={colors.bg}>
                {i + 1}
              </T>
            </View>
            <T variant="body" style={{ flex: 1 }}>
              {t(key)}
            </T>
          </View>
        ))}
      </View>

      <Spacer />
      <View style={{ gap: spacing.sm }}>
        {ALL_MINI_GAMES.map((game) => (
          <View key={game} style={[styles.gameRow, { borderColor: miniGameColor(game) }]}>
            <T variant="heading" color={miniGameColor(game)}>
              {t(`game.${game}` as never)}
            </T>
            <T variant="label" color={colors.textMuted}>
              {t(`game.${game}.rule` as never)}
            </T>
          </View>
        ))}
      </View>

      <Spacer />
      <Button
        label={t('common.done')}
        onPress={() => {
          setPrefs({ hasSeenHowToPlay: true });
          router.back();
        }}
      />
      <Spacer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  number: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameRow: {
    borderStartWidth: 4,
    borderRadius: radius.sm,
    paddingStart: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
});
