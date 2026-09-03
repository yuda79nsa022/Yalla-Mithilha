import { router } from 'expo-router';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, Screen, Spacer, T } from '../src/ui/components';
import { colors, radius, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';

const CATEGORY_THUMB_ACCENTS = [
  colors.act, colors.taboo, colors.who, colors.imitate, colors.lips, colors.sound, colors.final,
];

export default function Home() {
  const { t, lang, catalogue, savedSession, resumeSaved, discardSaved, board, quitBoard } = useApp();

  const resume = () => {
    resumeSaved();
    router.push('/game/pass');
  };

  return (
    <Screen scroll>
      <Spacer size={spacing.xl} />
      <View style={styles.band}>
        {Array.from({ length: 9 }, (_, i) => (
          <View
            key={i}
            style={[styles.chevron, { backgroundColor: i % 2 ? colors.accent : colors.brand }]}
          />
        ))}
      </View>
      <T variant="display">{t('app.name')}</T>
      <T variant="body" color={colors.textMuted}>
        {t('app.tagline')}
      </T>

      <Spacer size={spacing.xl} />

      {savedSession ? (
        <View style={styles.resume}>
          <T variant="heading">{t('resume.title')}</T>
          <T variant="label" color={colors.textMuted}>
            {t('resume.body')}
          </T>
          <Spacer size={spacing.sm} />
          <Button label={t('resume.continue')} onPress={resume} accent={colors.correct} />
          <Spacer size={spacing.sm} />
          <Button label={t('resume.discard')} tone="ghost" onPress={discardSaved} />
        </View>
      ) : null}

      <Spacer />
      <Button label={t('home.play')} onPress={() => router.push('/rooms')} />
      <Spacer size={spacing.sm} />
      <Button
        label={t('home.howTo')}
        tone="secondary"
        onPress={() => router.push('/how-to-play')}
      />
      <Spacer size={spacing.sm} />
      <Button label={t('home.settings')} tone="secondary" onPress={() => router.push('/settings')} />

      <Spacer size={spacing.lg} />
      <View style={styles.boardCard}>
        {board ? (
          <>
            <T variant="heading">{t('board.resume.title')}</T>
            <T variant="label" color={colors.textMuted}>
              {t('board.resume.body')}
            </T>
            <Spacer size={spacing.sm} />
            <Button
              label={t('resume.continue')}
              accent={colors.accent}
              onPress={() =>
                router.push(board.lock === 'unlocked' ? '/board/play' : '/board/checkout')
              }
            />
            <Spacer size={spacing.sm} />
            <Button
              label={t('resume.discard')}
              tone="ghost"
              onPress={() => {
                quitBoard();
                router.push('/board/draft');
              }}
            />
          </>
        ) : (
          <>
            <T variant="heading">{t('board.home.play')}</T>
            <T variant="label" color={colors.textMuted}>
              {t('board.home.subtitle')}
            </T>
            <Spacer size={spacing.sm} />
            <Button
              label={t('board.home.play')}
              tone="secondary"
              accent={colors.accent}
              onPress={() => router.push('/board/draft')}
            />
            {catalogue.length ? (
              <>
                <Spacer size={spacing.md} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.thumbRow}>
                    {catalogue.map((deck, i) => (
                      <Pressable
                        key={deck.id}
                        accessibilityRole="button"
                        accessibilityLabel={lang === 'ar' ? deck.nameAr : deck.nameEn}
                        onPress={() => router.push('/board/draft')}
                        style={({ pressed }) => [styles.thumbCard, pressed && { opacity: 0.72 }]}
                      >
                        {deck.imageUrl ? (
                          <Image source={{ uri: deck.imageUrl }} style={styles.thumbImage} />
                        ) : (
                          <View
                            style={[
                              styles.thumbImage,
                              styles.thumbPlaceholder,
                              { backgroundColor: CATEGORY_THUMB_ACCENTS[i % CATEGORY_THUMB_ACCENTS.length] },
                            ]}
                          />
                        )}
                        <T variant="label" numberOfLines={1} style={styles.thumbLabel}>
                          {lang === 'ar' ? deck.nameAr : deck.nameEn}
                        </T>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </>
            ) : null}
          </>
        )}
      </View>

      <View style={{ flex: 1 }} />
      <Divider />
      <Button label={t('home.about')} tone="ghost" onPress={() => router.push('/privacy')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  band: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
  chevron: { width: 14, height: 14, transform: [{ rotate: '45deg' }], borderRadius: 2 },
  resume: {
    borderWidth: 2,
    borderColor: colors.correct,
    borderRadius: 18,
    padding: spacing.md,
    backgroundColor: colors.bgRaised,
  },
  boardCard: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 18,
    padding: spacing.md,
    backgroundColor: colors.bgRaised,
  },
  thumbRow: { flexDirection: 'row', gap: spacing.sm },
  thumbCard: { width: 92, alignItems: 'center', gap: spacing.xs },
  thumbImage: { width: 84, height: 84, borderRadius: radius.md },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbLabel: { textAlign: 'center' },
});
