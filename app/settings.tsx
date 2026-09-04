import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, ConfirmModal, Divider, Screen, Spacer, T, Toggle } from '../src/ui/components';
import { colors, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';

export default function Settings() {
  const { t, prefs, setPrefs, reports, wipeEverything, player } = useApp();
  const [wiped, setWiped] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const reset = async () => {
    setConfirmingReset(false);
    await wipeEverything();
    setWiped(true);
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

      <Spacer size={spacing.sm} />
      <Button
        label={player ? t('account.loggedInAs', { username: player.username }) : t('account.title')}
        tone="secondary"
        onPress={() => router.push('/account')}
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
      <Button label={t('settings.reset')} tone="danger" onPress={() => setConfirmingReset(true)} />
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

      <ConfirmModal
        visible={confirmingReset}
        title={t('settings.reset')}
        body={t('settings.resetConfirm')}
        confirmLabel={t('common.yes')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={reset}
        onCancel={() => setConfirmingReset(false)}
      />
    </Screen>
  );
}
