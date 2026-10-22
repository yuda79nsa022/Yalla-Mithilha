import React from 'react';
import { Button, Screen, T } from '../src/ui/components';
import { colors } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';

export default function Privacy() {
  const { t, wipeEverything } = useApp();

  return (
    <Screen scroll header={{}} footer={<Button label={t('privacy.reset')} tone="danger" showArrow={false} onPress={() => void wipeEverything()} />}>
      <T variant="title">{t('privacy.title')}</T>
      <T variant="body">{t('privacy.body')}</T>
      <T variant="body" color={colors.neutral700}>
        {t('privacy.network')}
      </T>
    </Screen>
  );
}
