import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { Screen, Spacer, T } from '../../src/ui/components';
import { colors, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';

/**
 * Where a Charades reveal QR code points. Standalone on purpose: opened by
 * scanning the code with a plain camera, on a phone that may not even have
 * this app installed, so it must render from the URL alone — no session,
 * deck, or login state.
 */
export default function CharadesReveal() {
  const { t } = useApp();
  const { t: title } = useLocalSearchParams<{ t?: string }>();
  const text = Array.isArray(title) ? title[0] : title;

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        {text ? (
          <>
            <T variant="label" align="center" color={colors.textMuted}>
              {t('charades.reveal.warning')}
            </T>
            <T variant="display" align="center">
              {text}
            </T>
          </>
        ) : (
          <T variant="heading" align="center" color={colors.textMuted}>
            {t('charades.reveal.missing')}
          </T>
        )}
        <Spacer size={spacing.xl} />
      </View>
    </Screen>
  );
}
