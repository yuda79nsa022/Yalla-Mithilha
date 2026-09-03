import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { Button, Divider, Screen, Spacer, T } from '../src/ui/components';
import { colors, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';
import { ALL_PROMPTS } from '../src/content';
import { formatNumber } from '../src/i18n';

export default function Privacy() {
  const { t, lang, wipeEverything } = useApp();
  const total = ALL_PROMPTS.filter((p) => p.enabled).length;

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="title">{t('privacy.title')}</T>
      <Spacer />
      <T variant="body">{t('privacy.body')}</T>
      <Spacer />
      <T variant="body" color={colors.textMuted}>
        {t('privacy.network')}
      </T>

      <Spacer />
      <Divider />
      <View style={{ gap: spacing.sm }}>
        <T variant="heading">{t('app.name')}</T>
        <T variant="label" color={colors.textMuted}>
          {formatNumber(lang, total)} {lang === 'ar' ? 'كرت ثنائي اللغة' : 'bilingual cards'}
        </T>
        <T variant="label" color={colors.textMuted}>
          {lang === 'ar'
            ? 'المحتوى مكتوب خصيصاً لهذي اللعبة. لا نستخدم أسئلة أو محتوى من ألعاب ثانية.'
            : 'All content is written for this game. Nothing is taken from another game.'}
        </T>
      </View>

      <View style={{ flex: 1 }} />
      <Spacer />
      <Button label={t('privacy.reset')} tone="danger" onPress={() => void wipeEverything()} />
      <Spacer size={spacing.sm} />
      <Button label={t('common.back')} tone="ghost" onPress={() => router.back()} />
      <Spacer />
    </Screen>
  );
}
