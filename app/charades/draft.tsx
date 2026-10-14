import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, CategoryTile, Divider, Screen, Spacer, T } from '../../src/ui/components';
import { Hero } from '../../src/ui/Hero';
import { colors, fonts, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { goBack } from '../../src/platform/navigation';
import type { GameMode } from '../../src/engine/game';
import { getPlayableDecks, type PlayableDeck } from '../../src/services/walletApi';

function ModePicker({ mode, onChange }: { mode: GameMode; onChange: (mode: GameMode) => void }) {
  const { t } = useApp();
  const options: { value: GameMode; title: string; desc: string }[] = [
    { value: 'classic', title: t('charades.draft.modeClassic'), desc: t('charades.draft.modeClassicDesc') },
    { value: 'modified', title: t('charades.draft.modeModified'), desc: t('charades.draft.modeModifiedDesc') },
  ];
  return (
    <View style={styles.modeRow}>
      {options.map((opt) => {
        const selected = mode === opt.value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.title}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.modeCard,
              { borderColor: colors.ink, backgroundColor: selected ? colors.purple : colors.white },
              pressed && styles.pressed,
            ]}
          >
            <T style={{ fontFamily: fonts.displayBlack, fontSize: 18, color: selected ? colors.white : colors.ink }}>
              {opt.title}
            </T>
            <T variant="label" style={{ fontSize: 11 }} color={selected ? colors.white : colors.neutral700}>
              {opt.desc}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CharadesDraft() {
  const { t, lang, startCharadesDraft } = useApp();
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const [mode, setMode] = useState<GameMode>('classic');
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
    startCharadesDraft(teamAName.trim(), teamBName.trim(), selectedDeckIds, mode);
    router.push('/charades/checkout');
  };

  return (
    <Screen
      scroll
      header={{ onBack: () => goBack() }}
      footer={<Button label={t('charades.draft.confirm')} disabled={!canConfirm} onPress={confirmDraft} />}
    >
      <>
        <Spacer size={spacing.md} />
        <Hero />
        <Spacer size={spacing.md} />
        <Divider />
        <Spacer size={spacing.md} />
        <T variant="title" style={{ fontSize: 34 }}>
          {t('charades.draft.title')}
        </T>
        <T variant="body" color={colors.neutral700} style={{ fontSize: 13, fontWeight: '500' }}>
          {t('charades.draft.subtitle')}
        </T>
        <Spacer size={spacing.lg} />

        <T variant="heading" style={{ fontSize: 18 }}>
          {t('charades.draft.modeTitle')}
        </T>
        <Spacer size={spacing.sm} />
        <ModePicker mode={mode} onChange={setMode} />
        <Spacer size={spacing.lg} />

        <View style={styles.teamRow}>
          <View style={[styles.teamPanel, { backgroundColor: colors.purple }]}>
            <T variant="label" color={colors.white} style={{ fontSize: 11 }}>
              {t('charades.draft.teamALabel')}
            </T>
            <TextInput
              value={teamAName}
              onChangeText={setTeamAName}
              placeholder={t('charades.draft.teamAName')}
              placeholderTextColor={colors.neutral700}
              maxLength={20}
              accessibilityLabel={t('charades.draft.teamAName')}
              style={styles.teamInput}
            />
          </View>
          <View style={styles.vsStrip}>
            <T style={{ fontFamily: fonts.display, fontSize: 14, color: colors.white }}>VS</T>
          </View>
          <View style={[styles.teamPanel, { backgroundColor: colors.green }]}>
            <T variant="label" color={colors.ink} style={{ fontSize: 11 }}>
              {t('charades.draft.teamBLabel')}
            </T>
            <TextInput
              value={teamBName}
              onChangeText={setTeamBName}
              placeholder={t('charades.draft.teamBName')}
              placeholderTextColor={colors.neutral700}
              maxLength={20}
              accessibilityLabel={t('charades.draft.teamBName')}
              style={styles.teamInput}
            />
          </View>
        </View>

        <Spacer size={spacing.lg} />
        <View style={styles.decksHeader}>
          <T variant="heading" style={{ fontSize: 18 }}>
            {t('charades.draft.decksTitle')}
          </T>
          <T style={{ fontFamily: fonts.display, fontSize: 13, color: colors.purple700 }}>
            {selectedDeckIds.length}/{decks?.length ?? 0}
          </T>
        </View>
        <Spacer size={spacing.sm} />

        {decksError ? (
          <>
            <T variant="label" color={colors.red}>
              {t('charades.draft.decksError')}
            </T>
            <Spacer size={spacing.xs} />
            <Button label={t('charades.draft.decksRetry')} tone="secondary" showArrow={false} onPress={loadDecks} />
          </>
        ) : decks === null ? (
          <T variant="label" color={colors.neutral700}>
            {t('charades.draft.decksLoading')}
          </T>
        ) : decks.length === 0 ? (
          <T variant="label" color={colors.neutral700}>
            {t('charades.draft.decksEmpty')}
          </T>
        ) : (
          <View style={styles.grid}>
            {decks.map((deck, i) => (
              <CategoryTile
                key={deck.id}
                index={i}
                name={lang === 'ar' ? deck.nameAr : deck.nameEn}
                selected={selectedDeckIds.includes(deck.id)}
                onPress={() => toggleDeck(deck.id)}
              />
            ))}
          </View>
        )}
        <Spacer size={spacing.lg} />
      </>
    </Screen>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row', gap: 10 },
  modeCard: { flex: 1, borderWidth: 2, padding: 12, gap: 4 },
  pressed: { opacity: 0.72 },
  teamRow: { flexDirection: 'row', alignItems: 'stretch', borderWidth: 2, borderColor: colors.ink },
  teamPanel: { flex: 1, padding: 14, gap: 6, justifyContent: 'center' },
  vsStrip: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, backgroundColor: colors.ink },
  teamInput: {
    fontFamily: 'NotoKufiArabic_700Bold',
    fontSize: 15,
    padding: 8,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    color: colors.ink,
  },
  decksHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
