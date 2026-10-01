import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Screen, Spacer, T } from '../src/ui/components';
import { colors, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';

interface RevealPayload {
  t: string;
  ca: string;
  ce: string;
  img?: string;
}

type RevealState =
  | { status: 'missing' }
  | { status: 'loading' }
  | { status: 'used' }
  | { status: 'error' }
  | { status: 'ready'; payload: RevealPayload };

/**
 * Where a Charades reveal QR code points. Standalone on purpose: opened by
 * scanning the code with a plain camera, on a phone that may not even have
 * this app installed, so it must render from the URL alone — no login, no
 * deck or session state beyond the single-use token in `id`. Deliberately
 * not under `/charades` — the server claims that whole path prefix for its
 * API and requires a player session for everything under it, which would
 * 401 a plain camera scan.
 *
 * The token is single-use, enforced server-side (see
 * server/src/routes/reveal.ts): the first fetch here claims it and gets the
 * round's answer; every fetch after that — a reload of this same page, or
 * someone else scanning the same still-visible QR code — gets the
 * "already used" state below instead of the answer. That's what actually
 * stops a teammate or an opposing player from peeking at the title by
 * scanning the code after the actor already has.
 */
export default function CharadesReveal() {
  const { t, lang } = useApp();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const tokenId = Array.isArray(id) ? id[0] : id;
  const [state, setState] = useState<RevealState>(tokenId ? { status: 'loading' } : { status: 'missing' });

  useEffect(() => {
    if (!tokenId) {
      setState({ status: 'missing' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    // A relative fetch, not CATALOGUE_API_URL: this page has no config of
    // its own (see the file comment above), and is always served by the
    // same origin that owns /reveal-tokens — the one the QR code's own
    // "baseUrl" already resolved to when the link was built.
    fetch(`/reveal-tokens/${encodeURIComponent(tokenId)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 410) {
          setState({ status: 'used' });
          return;
        }
        if (!res.ok) {
          setState({ status: 'error' });
          return;
        }
        const payload = (await res.json()) as RevealPayload;
        setState({ status: 'ready', payload });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  const payload = state.status === 'ready' ? state.payload : null;
  const category = payload ? (lang === 'ar' ? payload.ca : payload.ce) : undefined;

  const message =
    state.status === 'loading'
      ? t('charades.reveal.loading')
      : state.status === 'used'
        ? t('charades.reveal.alreadyUsed')
        : state.status === 'error'
          ? t('charades.reveal.error')
          : t('charades.reveal.missing');

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        {payload ? (
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
              {payload.t}
            </T>
            {payload.img ? (
              <Image
                source={{ uri: payload.img }}
                style={{ width: '100%', height: 220 }}
                resizeMode="contain"
                accessibilityLabel={payload.t}
              />
            ) : null}
          </>
        ) : (
          <T variant="heading" align="center" color={colors.neutral700}>
            {message}
          </T>
        )}
        <Spacer size={spacing.xl} />
      </View>
    </Screen>
  );
}
