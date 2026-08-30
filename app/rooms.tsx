import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { Button, OptionCard, Screen, Spacer, T } from '../src/ui/components';
import { colors, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';
import { ROOMS } from '../src/engine/config';
import { roomCoverage } from '../src/content';
import { track } from '../src/services/analytics';
import type { RoomId } from '../src/engine/types';

const ROOM_ACCENTS: Record<RoomId, string> = {
  friends: colors.act,
  family: colors.lips,
  diwaniya: colors.gold,
  kuwait: colors.taboo,
  ramadan: colors.imitate,
  couples: colors.sound,
  kids: colors.who,
  mixed: colors.final,
};

export default function Rooms() {
  const { t, prefs, setPrefs } = useApp();
  const coverage = roomCoverage();

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="title">{t('rooms.title')}</T>
      <T variant="label" color={colors.textMuted}>
        {t('rooms.subtitle')}
      </T>
      <Spacer />

      <View style={{ gap: spacing.sm }}>
        {ROOMS.map((room) => (
          <OptionCard
            key={room}
            title={t(`rooms.${room}` as never)}
            subtitle={t(`rooms.${room}.desc` as never)}
            accent={ROOM_ACCENTS[room]}
            selected={prefs.lastRoom === room}
            badge={room === 'mixed' ? undefined : String(coverage[room] ?? 0)}
            onPress={() => {
              setPrefs({ lastRoom: room });
              track({ name: 'room_selected', room });
            }}
          />
        ))}
      </View>

      <Spacer />
      <Button label={t('common.next')} onPress={() => router.push('/players')} />
      <Spacer size={spacing.sm} />
      <Button label={t('common.back')} tone="ghost" onPress={() => router.back()} />
      <Spacer />
    </Screen>
  );
}
