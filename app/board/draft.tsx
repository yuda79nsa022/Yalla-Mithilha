import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, Screen, Spacer, T } from '../../src/ui/components';
import { HIT_SIZE, colors, radius, spacing, type } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { BOARD_CATALOGUE } from '../../src/content/board';

const PICKS_PER_TEAM = 3;

export default function BoardDraft() {
  const { t, lang, startBoardDraft } = useApp();
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const [phase, setPhase] = useState<'names' | 'teamA' | 'teamB'>('names');
  const [teamAPicks, setTeamAPicks] = useState<string[]>([]);
  const [teamBPicks, setTeamBPicks] = useState<string[]>([]);

  const currentPicks = phase === 'teamA' ? teamAPicks : teamBPicks;
  const setCurrentPicks = phase === 'teamA' ? setTeamAPicks : setTeamBPicks;
  const taken = new Set([...teamAPicks, ...teamBPicks]);

  const toggle = (id: string) => {
    if (currentPicks.includes(id)) {
      setCurrentPicks(currentPicks.filter((c) => c !== id));
      return;
    }
    if (currentPicks.length >= PICKS_PER_TEAM || taken.has(id)) return;
    setCurrentPicks([...currentPicks, id]);
  };

  const confirmNames = () => {
    if (!teamAName.trim() || !teamBName.trim()) return;
    setPhase('teamA');
  };

  const confirmDraft = () => {
    startBoardDraft(
      teamAName.trim(),
      teamBName.trim(),
      teamAPicks as [string, string, string],
      teamBPicks as [string, string, string]
    );
    router.push('/board/checkout');
  };

  if (phase === 'names') {
    return (
      <Screen scroll>
        <Spacer size={spacing.md} />
        <T variant="title">{t('board.draft.title')}</T>
        <T variant="body" color={colors.textMuted}>
          {t('board.draft.subtitle')}
        </T>
        <Spacer size={spacing.xl} />

        <TextInput
          value={teamAName}
          onChangeText={setTeamAName}
          placeholder={t('board.draft.teamAName')}
          placeholderTextColor={colors.textMuted}
          maxLength={20}
          accessibilityLabel={t('board.draft.teamAName')}
          style={[styles.input, { borderColor: colors.teamA }]}
        />
        <Spacer size={spacing.md} />
        <TextInput
          value={teamBName}
          onChangeText={setTeamBName}
          placeholder={t('board.draft.teamBName')}
          placeholderTextColor={colors.textMuted}
          maxLength={20}
          accessibilityLabel={t('board.draft.teamBName')}
          style={[styles.input, { borderColor: colors.teamB }]}
        />

        <Spacer size={spacing.xl} />
        <Button
          label={t('common.next')}
          disabled={!teamAName.trim() || !teamBName.trim()}
          onPress={confirmNames}
        />
        <Spacer size={spacing.sm} />
        <Button label={t('common.back')} tone="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const teamLabel = phase === 'teamA' ? teamAName : teamBName;
  const teamColor = phase === 'teamA' ? colors.teamA : colors.teamB;
  const remaining = PICKS_PER_TEAM - currentPicks.length;
  const canAdvance = currentPicks.length === PICKS_PER_TEAM;

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="title">{t('board.draft.title')}</T>
      <T variant="heading" color={teamColor}>
        {remaining > 0
          ? t('board.draft.picksFor', { team: teamLabel, count: remaining })
          : t('board.draft.picksDone', { team: teamLabel })}
      </T>
      <Spacer />

      <View style={{ gap: spacing.sm }}>
        {BOARD_CATALOGUE.map((deck) => {
          const pickedByOther = taken.has(deck.id) && !currentPicks.includes(deck.id);
          const selected = currentPicks.includes(deck.id);
          return (
            <Pressable
              key={deck.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: pickedByOther }}
              accessibilityLabel={lang === 'ar' ? deck.nameAr : deck.nameEn}
              disabled={pickedByOther}
              onPress={() => toggle(deck.id)}
              style={({ pressed }) => [
                styles.category,
                selected && { borderColor: teamColor, backgroundColor: colors.bgRaised },
                pickedByOther && styles.categoryTaken,
                pressed && !pickedByOther && { opacity: 0.72 },
              ]}
            >
              <T variant="heading" color={pickedByOther ? colors.textMuted : colors.text}>
                {lang === 'ar' ? deck.nameAr : deck.nameEn}
              </T>
              {selected ? (
                <T variant="heading" color={teamColor}>
                  ✓
                </T>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Spacer size={spacing.xl} />
      {phase === 'teamA' ? (
        <Button
          label={t('common.next')}
          disabled={!canAdvance}
          accent={teamColor}
          onPress={() => setPhase('teamB')}
        />
      ) : (
        <Button
          label={t('board.draft.confirm')}
          disabled={!canAdvance}
          accent={teamColor}
          onPress={confirmDraft}
        />
      )}
      <Spacer size={spacing.sm} />
      <Button
        label={t('common.back')}
        tone="ghost"
        onPress={() => setPhase(phase === 'teamB' ? 'teamA' : 'names')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: HIT_SIZE,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.bgSunken,
    ...type.body,
    textAlign: 'auto',
  },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: HIT_SIZE,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgSunken,
  },
  categoryTaken: { opacity: 0.35 },
});
