import { router } from 'expo-router';
import React, { useState } from 'react';
import { Button, ButtonRow, ConfirmModal, MenuItem, PageTitle, Screen, T } from '../src/ui/components';
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

  // Places to go are menu rows; the page's one action sits in the footer like every other page's.
  return (
    <Screen
      scroll
      header={{}}
      footer={
        <ButtonRow>
          <Button label={t('settings.reset')} tone="danger" showArrow={false} onPress={() => setConfirmingReset(true)} />
        </ButtonRow>
      }
    >
      <PageTitle>{t('settings.title')}</PageTitle>

      <MenuItem
        label={t('settings.language')}
        value={prefs.lang === 'ar' ? 'العربية' : 'English'}
        onPress={() => router.push('/language')}
      />
      <MenuItem
        label={t('account.title')}
        value={player ? player.username : undefined}
        onPress={() => router.push('/account')}
      />
      <MenuItem label={t('home.about')} onPress={() => router.push('/privacy')} />

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
