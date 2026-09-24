import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Image, View } from 'react-native';
import { Screen, Spacer, T } from '../src/ui/components';
import { colors, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';
import { parseRevealToken } from '../src/engine/reveal';

/**
 * Where a Charades reveal QR code points. Standalone on purpose: opened by
 * scanning the code with a plain camera, on a phone that may not even have
 * this app installed, so it must render from the URL alone — no session,
 * deck, or login state. Deliberately not under `/charades` — the server
 * claims that whole path prefix for its API and requires a player session
 * for everything under it, which would 401 a plain camera scan.
 */
export default function CharadesReveal() {
  const { t, lang } = useApp();
  const { d } = useLocalSearchParams<{ d?: string }>();
  const token = Array.isArray(d) ? d[0] : d;
  const payload = parseRevealToken(token);
  const text = payload?.t;
  const imageUrl = payload?.img;
  const category = payload ? (lang === 'ar' ? payload.ca : payload.ce) : undefined;

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        {text ? (
          <>
            <T variant="label" align="center" color={colors.neutral700}>
              {t('charades.reveal.warning')}
            </T>
            {category ? (
              <View style={{ alignSelf: 'center', backgroundColor: colors.purple, paddingHorizontal: 12, paddingVertical: 4 }}>
                <T variant="label" color={colors.white}>
                  {t('charades.reveal.category', { category })}
                </T>
              </View>
            ) : null}
            <T variant="display" align="center">
              {text}
            </T>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={{ width: '100%', height: 220 }}
                resizeMode="contain"
                accessibilityLabel={text}
              />
            ) : null}
          </>
        ) : (
          <T variant="heading" align="center" color={colors.neutral700}>
            {t('charades.reveal.missing')}
          </T>
        )}
        <Spacer size={spacing.xl} />
      </View>
    </Screen>
  );
}
