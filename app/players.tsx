import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, OptionCard, Screen, Spacer, T } from '../src/ui/components';
import { HIT_SIZE, colors, radius, spacing, type } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';
import type { Player } from '../src/engine/types';

let counter = 0;
const newId = () => `pl-${Date.now().toString(36)}-${counter++}`;

export default function Players() {
  const { t, prefs, setPrefs } = useApp();
  const [draft, setDraft] = useState('');
  const players = prefs.lastPlayers;

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    // Names stay on the device. They are never sent anywhere and never appear
    // in an analytics event.
    setPrefs({ lastPlayers: [...players, { id: newId(), name }] });
    setDraft('');
  };

  const remove = (id: string) =>
    setPrefs({ lastPlayers: players.filter((p: Player) => p.id !== id) });

  const enough = players.length >= 2;

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="title">{t('players.title')}</T>
      <Spacer />

      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder={t('players.placeholder')}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          maxLength={20}
          accessibilityLabel={t('players.placeholder')}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('players.add')}
          onPress={add}
          style={styles.addButton}
        >
          <T variant="title" color={colors.bg}>
            +
          </T>
        </Pressable>
      </View>

      <Spacer size={spacing.sm} />
      <View style={{ gap: spacing.sm }}>
        {players.map((player: Player, index: number) => (
          <View key={player.id} style={styles.playerRow}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    prefs.lastMode === 'teams'
                      ? index % 2 === 0
                        ? colors.teamA
                        : colors.teamB
                      : colors.accent,
                },
              ]}
            />
            <T variant="body" style={{ flex: 1 }}>
              {player.name}
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('players.remove')} ${player.name}`}
              onPress={() => remove(player.id)}
              hitSlop={12}
            >
              <T variant="heading" color={colors.skip}>
                ×
              </T>
            </Pressable>
          </View>
        ))}
      </View>

      {!enough ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.accent}>
            {t('players.min')}
          </T>
        </>
      ) : null}

      <Spacer />
      <T variant="heading">{t('players.mode')}</T>
      <Spacer size={spacing.sm} />
      <OptionCard
        title={t('players.mode.teams')}
        selected={prefs.lastMode === 'teams'}
        accent={colors.teamA}
        onPress={() => setPrefs({ lastMode: 'teams' })}
      />
      <Spacer size={spacing.sm} />
      <OptionCard
        title={t('players.mode.ffa')}
        selected={prefs.lastMode === 'ffa'}
        accent={colors.accent}
        onPress={() => setPrefs({ lastMode: 'ffa' })}
      />

      <Spacer />
      <Button label={t('common.next')} disabled={!enough} onPress={() => router.push('/setup')} />
      <Spacer size={spacing.sm} />
      <Button label={t('common.back')} tone="ghost" onPress={() => router.back()} />
      <Spacer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: HIT_SIZE,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.bgSunken,
    ...type.body,
    // `textAlign: auto` keeps the caret on the correct side in both languages.
    textAlign: 'auto',
  },
  addButton: {
    width: HIT_SIZE,
    height: HIT_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT_SIZE,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgRaised,
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
});
