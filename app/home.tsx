import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Divider, Screen, Spacer, T } from '../src/ui/components';
import { colors, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';

export default function Home() {
  const { t, savedSession, resumeSaved, discardSaved } = useApp();

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
            style={[styles.chevron, { backgroundColor: i % 2 ? colors.gold : colors.taboo }]}
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
});
