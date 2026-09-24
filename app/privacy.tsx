import { router } from 'expo-router';
import React from 'react';
import { Button, Screen, Spacer, T } from '../src/ui/components';
import { colors } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';

export default function Privacy() {
  const { t, wipeEverything } = useApp();

  return (
    <Screen scroll header={{ onBack: () => router.back() }} footer={<Button label={t('privacy.reset')} tone="danger" showArrow={false} onPress={() => void wipeEverything()} />}>
      <Spacer size={16} />
      <T variant="title">{t('privacy.title')}</T>
      <Spacer />
      <T variant="body">{t('privacy.body')}</T>
      <Spacer />
      <T variant="body" color={colors.neutral700}>
        {t('privacy.network')}
      </T>
    </Screen>
  );
}
