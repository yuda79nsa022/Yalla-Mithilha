import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { Button, OptionCard, Screen, Spacer, T } from '../src/ui/components';
import { colors, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';
import { needsRestartForDirection } from '../src/platform';
import { track } from '../src/services/analytics';
import type { Lang } from '../src/engine/types';

export default function LanguageScreen() {
  const { prefs, setPrefs, lang, t } = useApp();

  const choose = (next: Lang) => {
    setPrefs({ lang: next });
    track({ name: 'language_changed', lang: next });
  };

  const restartNeeded = prefs.lang !== null && needsRestartForDirection(lang);

  return (
    <Screen scroll>
      <Spacer size={spacing.xl} />
      <T variant="title">{t('lang.title')}</T>
      <Spacer />
      <View style={{ gap: spacing.md }}>
        <OptionCard
          title="العربية"
          subtitle="واجهة من اليمين لليسار"
          selected={prefs.lang === 'ar'}
          onPress={() => choose('ar')}
          accent={colors.act}
        />
        <OptionCard
          title="English"
          subtitle="Left-to-right interface"
          selected={prefs.lang === 'en'}
          onPress={() => choose('en')}
          accent={colors.who}
        />
      </View>

      {restartNeeded ? (
        <>
          <Spacer />
          {/* Being honest about the reload beats showing a half-mirrored screen. */}
          <T variant="label" color={colors.gold}>
            {lang === 'ar'
              ? 'سكّر التطبيق وافتحه مرة ثانية عشان يضبط اتجاه الواجهة.'
              : 'Close and reopen the app so the layout direction updates.'}
          </T>
        </>
      ) : null}

      <View style={{ flex: 1 }} />
      <Button
        label={t('common.continue')}
        disabled={!prefs.lang}
        onPress={() => router.replace('/home')}
      />
      <Spacer />
    </Screen>
  );
}
