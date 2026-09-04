import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, Screen, Spacer, T } from '../../src/ui/components';
import { HIT_SIZE, colors, radius, spacing, type } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';

export default function CharadesDraft() {
  const { t, lang, decks, startCharadesDraft } = useApp();
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const [phase, setPhase] = useState<'names' | 'deck'>('names');
  const [deckId, setDeckId] = useState<string | null>(null);

  const confirmNames = () => {
    if (!teamAName.trim() || !teamBName.trim()) return;
    setPhase('deck');
  };

  const confirmDraft = () => {
    if (!deckId) return;
    startCharadesDraft(deckId, teamAName.trim(), teamBName.trim());
    router.push('/charades/checkout');
  };

  if (phase === 'names') {
    return (
      <Screen scroll>
        <Spacer size={spacing.md} />
        <T variant="title">{t('charades.draft.title')}</T>
        <T variant="body" color={colors.textMuted}>
          {t('charades.draft.subtitle')}
        </T>
        <Spacer size={spacing.xl} />

        <TextInput
          value={teamAName}
          onChangeText={setTeamAName}
          placeholder={t('charades.draft.teamAName')}
          placeholderTextColor={colors.textMuted}
          maxLength={20}
          accessibilityLabel={t('charades.draft.teamAName')}
          style={[styles.input, { borderColor: colors.teamA }]}
        />
        <Spacer size={spacing.md} />
        <TextInput
          value={teamBName}
          onChangeText={setTeamBName}
          placeholder={t('charades.draft.teamBName')}
          placeholderTextColor={colors.textMuted}
          maxLength={20}
          accessibilityLabel={t('charades.draft.teamBName')}
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

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="title">{t('charades.draft.title')}</T>
      <T variant="heading" color={colors.accent}>
        {t('charades.draft.deckLabel')}
      </T>
      <Spacer />

      {decks.length === 0 ? (
        <T variant="body" color={colors.textMuted}>
          {t('charades.draft.noDecks')}
        </T>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {decks.map((deck) => {
            const selected = deckId === deck.id;
            return (
              <Pressable
                key={deck.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={lang === 'ar' ? deck.nameAr : deck.nameEn}
                onPress={() => setDeckId(deck.id)}
                style={({ pressed }) => [
                  styles.deck,
                  selected && { borderColor: colors.accent, backgroundColor: colors.bgRaised },
                  pressed && { opacity: 0.72 },
                ]}
              >
                <View>
                  <T variant="heading">{lang === 'ar' ? deck.nameAr : deck.nameEn}</T>
                  <T variant="label" color={colors.textMuted}>
                    {t('charades.draft.deckCount', { count: deck.titleCount })}
                  </T>
                </View>
                {selected ? (
                  <T variant="heading" color={colors.accent}>
                    ✓
                  </T>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      <Spacer size={spacing.xl} />
      <Button label={t('charades.draft.confirm')} disabled={!deckId} accent={colors.accent} onPress={confirmDraft} />
      <Spacer size={spacing.sm} />
      <Button label={t('charades.draft.back')} tone="ghost" onPress={() => setPhase('names')} />
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
  deck: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: HIT_SIZE,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgSunken,
  },
});
