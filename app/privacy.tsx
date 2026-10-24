import React, { useState } from 'react';
import { Button, ButtonRow, ConfirmModal, PageTitle, Screen, T } from '../src/ui/components';
import { colors } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';

export default function Privacy() {
  const { t, wipeEverything } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [wiped, setWiped] = useState(false);

  // Same as Settings' reset: a destructive action always asks first.
  const wipe = async () => {
    setConfirming(false);
    await wipeEverything();
    setWiped(true);
  };

  return (
    <Screen
      scroll
      header={{}}
      footer={
        <ButtonRow>
          <Button label={t('privacy.reset')} tone="danger" showArrow={false} onPress={() => setConfirming(true)} />
        </ButtonRow>
      }
    >
      <PageTitle>{t('privacy.title')}</PageTitle>
      <T variant="body">{t('privacy.body')}</T>
      <T variant="body" color={colors.neutral700}>
        {t('privacy.network')}
      </T>
      {wiped ? (
        <T variant="label" color={colors.green}>
          {t('settings.resetDone')}
        </T>
      ) : null}
      <ConfirmModal
        visible={confirming}
        title={t('privacy.reset')}
        body={t('settings.resetConfirm')}
        confirmLabel={t('common.yes')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => void wipe()}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}
