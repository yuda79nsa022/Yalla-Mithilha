import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Button, ButtonRow, CategoryTile, PageTitle, Screen, T } from '../../src/ui/components';
import { colors, fonts, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import type { GameMode } from '../../src/engine/game';
import { DIFFICULTY_POINTS } from '../../src/engine/modifiedCharades';
import { getPlayableDecks, type PlayableDeck } from '../../src/services/walletApi';

/**
 * The two game types. On a phone (`compact`) each card shows just its name
 * and the chosen type's description sits on one small line underneath, so
 * the whole setup fits a phone screen.
 */
function ModePicker({
  mode,
  onChange,
  compact = false,
  hideDescription = false,
}: {
  mode: GameMode;
  onChange: (mode: GameMode) => void;
  compact?: boolean;
  /** The very shortest phone screens skip even the one-line description. */
  hideDescription?: boolean;
}) {
  const { t } = useApp();
  const options: { value: GameMode; title: string; desc: string }[] = [
    { value: 'classic', title: t('charades.draft.modeClassic'), desc: t('charades.draft.modeClassicDesc') },
    { value: 'modified', title: t('charades.draft.modeModified'), desc: t('charades.draft.modeModifiedDesc') },
  ];
  const chosen = options.find((opt) => opt.value === mode)!;
  return (
    <View style={{ gap: 6 }}>
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
                compact && { padding: 8 },
                { borderColor: colors.ink, backgroundColor: selected ? colors.purple : colors.white },
                pressed && styles.pressed,
              ]}
            >
              <T style={{ fontFamily: fonts.displayBlack, fontSize: 18, color: selected ? colors.white : colors.ink }}>
                {opt.title}
              </T>
              {!compact ? (
                <T variant="label" style={{ fontSize: 11 }} color={selected ? colors.white : colors.neutral700}>
                  {opt.desc}
                </T>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {compact && !hideDescription ? (
        <T variant="label" color={colors.neutral700} style={{ fontSize: 12, lineHeight: 17, fontWeight: '500' }}>
          {chosen.desc}
        </T>
      ) : null}
    </View>
  );
}

const PRO_LEVELS = [
  { level: 'easy', labelKey: 'charades.play.difficultyEasy' },
  { level: 'medium', labelKey: 'charades.play.difficultyMedium' },
  { level: 'hard', labelKey: 'charades.play.difficultyHard' },
] as const;

/**
 * Pro's three levels, as plain text — information, not a control. The team
 * picks the level every round during play, so nothing here is tappable (it
 * used to be bordered chips that looked like a picker and did nothing).
 */
function ProLevels() {
  const { t } = useApp();
  return (
    <T variant="label" color={colors.neutral700} style={{ fontSize: 13 }}>
      {PRO_LEVELS.map(({ level, labelKey }) => `${t(labelKey)} · ${t('charades.play.difficultyPoints', { points: DIFFICULTY_POINTS[level] })}`).join('   |   ')}
    </T>
  );
}

export default function CharadesDraft() {
  const { t, lang, startCharadesDraft } = useApp();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 900;
  const isPhone = width < 600;
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

  const intro = (
    <View style={styles.section}>
      <PageTitle>{t('charades.draft.title')}</PageTitle>
      {!isPhone ? (
        <T variant="body" color={colors.neutral700} style={{ fontSize: 13, fontWeight: '500' }}>
          {t('charades.draft.subtitle')}
        </T>
      ) : null}
    </View>
  );

  const modeSection = (
    <View style={styles.section}>
      {!isPhone ? (
        <T variant="heading" style={{ fontSize: 18 }}>
          {t('charades.draft.modeTitle')}
        </T>
      ) : null}
      <ModePicker mode={mode} onChange={setMode} compact={isPhone} hideDescription={isPhone && height < 660} />
    </View>
  );

  // Lite always deals every level mixed, so it has nothing to choose here.
  // Pro lists its easy / medium / hard levels (picked each round in play).
  const difficultySection =
    mode === 'classic' ? null : (
      <View style={styles.section}>
        {!isPhone ? (
          <T variant="heading" style={{ fontSize: 18 }}>
            {t('charades.draft.difficultyTitle')}
          </T>
        ) : null}
        <ProLevels />
        {!isPhone ? (
          <T variant="label" color={colors.neutral700} style={{ fontSize: 13, fontWeight: '500' }}>
            {t('charades.draft.difficultyModifiedNote')}
          </T>
        ) : null}
      </View>
    );

  const teamsSection = (
    <View style={styles.teamRow}>
      <View style={[styles.teamPanel, isPhone && styles.teamPanelPhone, { backgroundColor: colors.purple }]}>
        {!isPhone ? (
          <T variant="label" color={colors.white} style={{ fontSize: 11 }}>
            {t('charades.draft.teamALabel')}
          </T>
        ) : null}
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
      <View style={[styles.teamPanel, isPhone && styles.teamPanelPhone, { backgroundColor: colors.green }]}>
        {!isPhone ? (
          <T variant="label" color={colors.ink} style={{ fontSize: 11 }}>
            {t('charades.draft.teamBLabel')}
          </T>
        ) : null}
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
  );

  const decksSection = (
    <View style={styles.section}>
      <View style={styles.decksHeader}>
        <T variant="heading" style={isPhone ? { fontSize: 16, lineHeight: lang === 'ar' ? 26 : 22 } : { fontSize: 18 }}>
          {t('charades.draft.decksTitle')}
        </T>
        <T style={{ fontFamily: fonts.display, fontSize: 13, color: colors.purple700 }}>
          {selectedDeckIds.length}/{decks?.length ?? 0}
        </T>
      </View>
      {decksError ? (
        <>
          <T variant="label" color={colors.red}>
            {t('charades.draft.decksError')}
          </T>
          <ButtonRow>
            <Button label={t('charades.draft.decksRetry')} tone="secondary" showArrow={false} onPress={loadDecks} />
          </ButtonRow>
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
              style={isWide ? styles.wideTile : undefined}
              compact={isPhone}
            />
          ))}
        </View>
      )}
    </View>
  );

  // A wide window sets the game up in two columns — how to play on one
  // side, who plays and with which decks on the other — so it fits a
  // laptop-sized browser window without scrolling.
  return (
    <Screen
      scroll
      wide
      header={{}}
      footer={<Button label={t('charades.draft.confirm')} disabled={!canConfirm} onPress={confirmDraft} />}
    >
      {isWide ? (
        <View style={[styles.wideRow, lang === 'en' && styles.wideRowEn]}>
          <View style={[styles.wideCol, height < 700 && { gap: spacing.md }]}>
            {intro}
            {modeSection}
            {difficultySection}
          </View>
          <View style={[styles.wideCol, height < 700 && { gap: spacing.md }]}>
            {teamsSection}
            {decksSection}
          </View>
        </View>
      ) : (
        <>
          {intro}
          {modeSection}
          {difficultySection}
          {teamsSection}
          {decksSection}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  wideRow: { flex: 1, flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 48 },
  wideRowEn: { flexDirection: 'row' },
  wideCol: { flex: 1, gap: spacing.lg },
  // Four decks to a row on a wide window, shorter than on a phone.
  wideTile: { flexBasis: '23%', minHeight: 72 },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeCard: { flex: 1, borderWidth: 2, padding: 12, gap: 4 },
  pressed: { opacity: 0.72 },
  teamRow: { flexDirection: 'row', alignItems: 'stretch', borderWidth: 2, borderColor: colors.ink },
  teamPanelPhone: { padding: 8, gap: 0 },
  teamPanel: { flex: 1, padding: 14, gap: 6, justifyContent: 'center' },
  vsStrip: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, backgroundColor: colors.ink },
  teamInput: {
    fontFamily: 'NotoKufiArabic_700Bold',
    // 16, not less: iOS Safari zooms into any input under 16px on focus,
    // leaving the page zoomed and shifted after typing a team name.
    fontSize: 16,
    padding: 8,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    color: colors.ink,
  },
  decksHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
