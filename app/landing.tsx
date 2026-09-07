import { router } from 'expo-router';
import React from 'react';
import { Image, View } from 'react-native';
import { Button, Divider, Screen, Spacer, T } from '../src/ui/components';
import { colors, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';

/**
 * The public web entry point (see app/index.tsx) — a first-time visitor
 * lands here, not straight in the app's own menu, since a website visitor
 * has not necessarily played before. Native installs skip this entirely.
 */
export default function Landing() {
  const { t, prefs } = useApp();

  return (
    <Screen scroll>
      <Spacer size={spacing.xl} />
      <View style={styles.logoRow}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel={t('app.name')}
        />
      </View>

      <T variant="label" color={colors.accent}>
        {t('landing.eyebrow')}
      </T>
      <T variant="display">{t('app.name')}</T>
      <T variant="body" color={colors.textMuted}>
        {t('app.tagline')}
      </T>
      <Spacer />
      <T variant="body">{t('landing.intro')}</T>

      <Spacer size={spacing.xl} />
      <View style={[styles.card, { borderColor: colors.accent }]}>
        <T variant="heading" color={colors.accent}>
          {t('landing.charadesTitle')}
        </T>
        <T variant="body" color={colors.textMuted}>
          {t('landing.charadesBody')}
        </T>
        <Spacer size={spacing.sm} />
        <Button label={t('landing.charadesCta')} accent={colors.accent} onPress={() => router.push('/home')} />
      </View>

      <Spacer size={spacing.xl} />
      <T variant="heading">{t('landing.bilingualTitle')}</T>
      <T variant="body" color={colors.textMuted}>
        {t('landing.bilingualBody')}
      </T>
      <Spacer size={spacing.sm} />
      <Button
        label={`${t('settings.language')} — ${prefs.lang === 'ar' ? 'العربية' : 'English'}`}
        tone="secondary"
        onPress={() => router.push('/language')}
      />

      <Spacer size={spacing.xl} />
      <T variant="heading">{t('landing.privacyTitle')}</T>
      <T variant="body" color={colors.textMuted}>
        {t('landing.privacyBody')}
      </T>
      <Spacer size={spacing.sm} />
      <Button label={t('landing.privacyLink')} tone="ghost" onPress={() => router.push('/privacy')} />

      <Spacer size={spacing.xl} />
      <Divider />
      <Spacer />
      <Button label={t('landing.fullMenu')} tone="ghost" onPress={() => router.push('/home')} />
      <Spacer size={spacing.xl} />
    </Screen>
  );
}

const styles = {
  logoRow: { alignItems: 'center' as const, marginBottom: spacing.md },
  logo: { width: 120, height: 120, borderRadius: 24 },
  card: {
    borderWidth: 2,
    borderRadius: 18,
    padding: spacing.md,
    backgroundColor: colors.bgRaised,
  },
};
