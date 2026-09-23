import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { Button, OptionCard, Screen, Spacer, T } from '../../src/ui/components';
import { HIT_SIZE, colors, radius, spacing, type } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { CATALOGUE_API_URL } from '../../src/config';
import { getPlayableDecks, type PlayableDeck } from '../../src/services/walletApi';

export default function CharadesDraft() {
  const { t, lang, startCharadesDraft } = useApp();
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const [decks, setDecks] = useState<PlayableDeck[] | null>(null);
  const [decksError, setDecksError] = useState(false);
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([]);

  const loadDecks = () => {
    setDecksError(false);
    setDecks(null);
    getPlayableDecks()
      .then((result) => {
        setDecks(result);
        // No deck selected by default — the player opts in to at least one
        // before `canConfirm` allows continuing, rather than opting out of
        // ones they don't want.
        setSelectedDeckIds([]);
      })
      .catch(() => setDecksError(true));
  };

  useEffect(loadDecks, []);

  const toggleDeck = (id: string) => {
    setSelectedDeckIds((current) => (current.includes(id) ? current.filter((d) => d !== id) : [...current, id]));
  };

  const canConfirm = Boolean(teamAName.trim() && teamBName.trim() && selectedDeckIds.length > 0);

  const confirmDraft = () => {
    if (!canConfirm) return;
    startCharadesDraft(teamAName.trim(), teamBName.trim(), selectedDeckIds);
    router.push('/charades/checkout');
  };

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
      <T variant="heading">{t('charades.draft.decksTitle')}</T>
      <Spacer size={spacing.sm} />

      {decksError ? (
        <>
          <T variant="label" color={colors.skip}>
            {t('charades.draft.decksError')}
          </T>
          <Spacer size={spacing.xs} />
          <Button label={t('charades.draft.decksRetry')} tone="ghost" onPress={loadDecks} />
        </>
      ) : decks === null ? (
        <T variant="label" color={colors.textMuted}>
          {t('charades.draft.decksLoading')}
        </T>
      ) : decks.length === 0 ? (
        <T variant="label" color={colors.textMuted}>
          {t('charades.draft.decksEmpty')}
        </T>
      ) : (
        decks.map((deck) => (
          <React.Fragment key={deck.id}>
            <OptionCard
              role="checkbox"
              title={lang === 'ar' ? deck.nameAr : deck.nameEn}
              selected={selectedDeckIds.includes(deck.id)}
              onPress={() => toggleDeck(deck.id)}
              imageUri={deck.imageUrl ? `${CATALOGUE_API_URL}${deck.imageUrl}` : undefined}
            />
            <Spacer size={spacing.sm} />
          </React.Fragment>
        ))
      )}

      <Spacer size={spacing.xl} />
      <Button label={t('charades.draft.confirm')} disabled={!canConfirm} accent={colors.accent} onPress={confirmDraft} />
      <Spacer size={spacing.sm} />
      <Button label={t('common.back')} tone="ghost" onPress={() => router.back()} />
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
});
