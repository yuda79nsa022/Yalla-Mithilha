import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Image, View } from 'react-native';
import { Screen, Spacer, T } from '../src/ui/components';
import { colors, radius, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';

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
  const { t: title, ca, ce, img } = useLocalSearchParams<{ t?: string; ca?: string; ce?: string; img?: string }>();
  const text = Array.isArray(title) ? title[0] : title;
  const categoryAr = Array.isArray(ca) ? ca[0] : ca;
  const categoryEn = Array.isArray(ce) ? ce[0] : ce;
  const imageUrl = Array.isArray(img) ? img[0] : img;
  const category = lang === 'ar' ? categoryAr : categoryEn;

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        {text ? (
          <>
            <T variant="label" align="center" color={colors.textMuted}>
              {t('charades.reveal.warning')}
            </T>
            {category ? (
              <T variant="heading" align="center" color={colors.accent}>
                {t('charades.reveal.category', { category })}
              </T>
            ) : null}
            <T variant="display" align="center">
              {text}
            </T>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={{ width: '100%', height: 220, borderRadius: radius.lg }}
                resizeMode="contain"
                accessibilityLabel={text}
              />
            ) : null}
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
