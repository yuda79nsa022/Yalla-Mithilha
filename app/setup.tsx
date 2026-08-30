import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, OptionCard, Screen, Spacer, T } from '../src/ui/components';
import { colors, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';
import { CONTENT_LEVELS } from '../src/engine/config';
import { NotEnoughContentError } from '../src/engine/engine';
import type { ContentLevel, SessionLength } from '../src/engine/types';

const LENGTHS: SessionLength[] = ['quick', 'standard', 'long'];

const LEVEL_ACCENT: Record<ContentLevel, string> = {
  kids: colors.who,
  family: colors.lips,
  friends: colors.act,
  adults: colors.taboo,
};

export default function Setup() {
  const { t, prefs, setPrefs, startSession } = useApp();
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    try {
      startSession({
        lang: prefs.lang ?? 'en',
        room: prefs.lastRoom,
        mode: prefs.lastMode,
        length: prefs.lastLength,
        level: prefs.lastLevel,
        players: prefs.lastPlayers,
        motionEnabled: prefs.motion,
      });
      router.push('/game/pass');
    } catch (e) {
      // The only expected failure: a room and level combination with nothing
      // to deal. Say so plainly instead of dropping the host into a dead game.
      setError(
        e instanceof NotEnoughContentError ? t('error.notEnoughContent') : String(e)
      );
    }
  };

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="title">{t('setup.title')}</T>

      <Spacer />
      <T variant="heading">{t('setup.length')}</T>
      <Spacer size={spacing.sm} />
      <View style={{ gap: spacing.sm }}>
        {LENGTHS.map((length) => (
          <OptionCard
            key={length}
            title={t(`setup.length.${length}` as never)}
            subtitle={t(`setup.length.${length}.desc` as never)}
            selected={prefs.lastLength === length}
            onPress={() => setPrefs({ lastLength: length })}
          />
        ))}
      </View>

      <Spacer />
      <T variant="heading">{t('setup.level')}</T>
      <Spacer size={spacing.sm} />
      <View style={{ gap: spacing.sm }}>
        {CONTENT_LEVELS.map((level) => (
          <OptionCard
            key={level}
            title={t(`setup.level.${level}` as never)}
            subtitle={t(`setup.level.${level}.desc` as never)}
            accent={LEVEL_ACCENT[level]}
            selected={prefs.lastLevel === level}
            onPress={() => setPrefs({ lastLevel: level })}
          />
        ))}
      </View>

      {error ? (
        <>
          <Spacer />
          <T variant="label" color={colors.skip}>
            {error}
          </T>
        </>
      ) : null}

      <Spacer />
      <Button label={t('setup.startGame')} onPress={start} accent={colors.correct} />
      <Spacer size={spacing.sm} />
      <Button label={t('common.back')} tone="ghost" onPress={() => router.back()} />
      <Spacer />
    </Screen>
  );
}
