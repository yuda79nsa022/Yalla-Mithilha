import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Divider, Screen, Spacer, T, Toggle } from '../src/ui/components';
import { colors, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';

export default function Settings() {
  const { t, prefs, setPrefs, reports, wipeEverything } = useApp();
  const [wiped, setWiped] = useState(false);

  const confirmReset = () => {
    Alert.alert(t('settings.reset'), t('settings.resetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          await wipeEverything();
          setWiped(true);
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="title">{t('settings.title')}</T>
      <Spacer />

      <Button
        label={`${t('settings.language')} — ${prefs.lang === 'ar' ? 'العربية' : 'English'}`}
        tone="secondary"
        onPress={() => router.push('/language')}
      />

      <Spacer />
      <View>
        <Toggle
          label={t('settings.sound')}
          value={prefs.sound}
          onChange={(v) => setPrefs({ sound: v })}
        />
        <Toggle
          label={t('settings.haptics')}
          value={prefs.haptics}
          onChange={(v) => setPrefs({ haptics: v })}
        />
        <Toggle
          label={t('settings.motion')}
          description={t('round.tiltHint')}
          value={prefs.motion}
          onChange={(v) => setPrefs({ motion: v })}
        />
        <Toggle
          label={t('settings.reduceMotion')}
          value={prefs.reduceMotion}
          onChange={(v) => setPrefs({ reduceMotion: v })}
        />
      </View>

      <Divider />
      <T variant="label" color={colors.textMuted}>
        {t('settings.reports', { count: reports.length })}
      </T>

      <Spacer />
      <Button label={t('home.about')} tone="secondary" onPress={() => router.push('/privacy')} />
      <Spacer size={spacing.sm} />
      <Button label={t('settings.reset')} tone="danger" onPress={confirmReset} />
      {wiped ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.correct}>
            {t('settings.resetDone')}
          </T>
        </>
      ) : null}

      <View style={{ flex: 1 }} />
      <Spacer />
      <Button label={t('common.back')} tone="ghost" onPress={() => router.back()} />
      <Spacer />
    </Screen>
  );
}
