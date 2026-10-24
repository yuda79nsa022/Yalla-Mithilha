import { router } from 'expo-router';
import React, { useState } from 'react';
import { Button, ConfirmModal, Divider, PageTitle, Screen, T } from '../src/ui/components';
import { colors } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';

export default function Settings() {
  const { t, prefs, wipeEverything, player } = useApp();
  const [wiped, setWiped] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const reset = async () => {
    setConfirmingReset(false);
    await wipeEverything();
    setWiped(true);
  };

  return (
    <Screen scroll header={{}}>
      <PageTitle>{t('settings.title')}</PageTitle>

      <Button
        label={`${t('settings.language')} — ${prefs.lang === 'ar' ? 'العربية' : 'English'}`}
        tone="secondary"
        onPress={() => router.push('/language')}
      />

      <Button
        label={player ? t('account.loggedInAs', { username: player.username }) : t('account.title')}
        tone="secondary"
        onPress={() => router.push('/account')}
      />

      <Divider />
      <Button label={t('home.about')} tone="secondary" onPress={() => router.push('/privacy')} />
      <Button label={t('settings.reset')} tone="danger" showArrow={false} onPress={() => setConfirmingReset(true)} />
      {wiped ? (
        <T variant="label" color={colors.green}>
          {t('settings.resetDone')}
        </T>
      ) : null}

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
