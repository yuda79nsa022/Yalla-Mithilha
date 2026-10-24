import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, ButtonRow, ConfirmModal, Field, MenuItem, PageTitle, Screen, T, TextLink } from '../src/ui/components';
import { colors } from '../src/ui/theme';
import { goBack } from '../src/platform/navigation';
import { useApp } from '../src/state/AppProvider';
import { CATALOGUE_API_URL } from '../src/config';
import { loginAdmin } from '../src/services/adminAuthApi';
import type { PlayerProfile } from '../src/services/playerAuthApi';

type Mode = 'signIn' | 'create' | 'forgotRequest' | 'forgotConfirm';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Account() {
  const {
    t,
    lang,
    player,
    formatDate,
    playerAuthBusy,
    playerAuthError,
    registerPlayerAccount,
    loginPlayerAccount,
    logoutPlayerAccount,
    requestPasswordReset,
    confirmPasswordReset,
    loadProfile,
  } = useApp();
  // `?mode=create` opens straight on the create-account form (Home's "Create account" button).
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [mode, setMode] = useState<Mode>(initialMode === 'create' ? 'create' : 'signIn');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [justResetPassword, setJustResetPassword] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [tryingAdmin, setTryingAdmin] = useState(false);
  const [adminRedirecting, setAdminRedirecting] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [profileFailed, setProfileFailed] = useState(false);
  const signedIn = Boolean(player);

  // Profile details for the signed-in view (this page doubles as the Profile page).
  useEffect(() => {
    if (!signedIn) {
      setProfile(null);
      return;
    }
    let live = true;
    setProfileFailed(false);
    loadProfile()
      .then((p) => live && setProfile(p))
      .catch(() => live && setProfileFailed(true));
    return () => {
      live = false;
    };
  }, [signedIn, loadProfile]);

  const logout = () => {
    setConfirmingLogout(false);
    logoutPlayerAccount();
    router.replace('/home');
  };

  const goToMode = (next: Mode) => {
    setJustResetPassword(false);
    setAdminRedirecting(false);
    setMode(next);
  };

  const submit = async () => {
    setAdminRedirecting(false);
    if (mode !== 'signIn') {
      const ok = await registerPlayerAccount(username.trim(), password, email.trim());
      if (ok) goBack();
      return;
    }

    const ok = await loginPlayerAccount(username.trim(), password);
    if (ok) {
      goBack();
      return;
    }

    // Not a player account, or the wrong password — try it as an admin
    // sign-in instead, so an admin never needs a separate "Admin sign-in"
    // link to find their own form. A real admin tool (deck management,
    // players, audit log) lives on its own separate page (`/admin-ui`),
    // not inside this app, so success here means opening that page with
    // the freshly issued token rather than navigating anywhere in-app. The
    // token goes in the URL fragment (`#`), never the query string: a
    // browser never sends the fragment to the server, so the token can't
    // land in nginx's access logs the way `?token=` did.
    setTryingAdmin(true);
    try {
      const result = await loginAdmin(username.trim(), password);
      setAdminRedirecting(true);
      const adminUrl = `${CATALOGUE_API_URL}/admin-ui#token=${encodeURIComponent(
        result.token
      )}&username=${encodeURIComponent(result.user.username)}`;
      // On web, navigate this same tab to the admin tool — Linking.openURL
      // opens a new tab there, which leaves a stale, half-finished sign-in
      // page open behind it. Native has no "same tab" to navigate, so it
      // keeps using Linking.openURL (opens the device browser).
      if (Platform.OS === 'web') {
        const g = globalThis as { location?: { href?: string } };
        if (g.location) g.location.href = adminUrl;
      } else {
        void Linking.openURL(adminUrl);
      }
    } catch {
      // Not an admin account either — the player-login error already
      // showing (playerAuthError) covers this case, nothing further to add.
    } finally {
      setTryingAdmin(false);
    }
  };

  const sendResetCode = async () => {
    const ok = await requestPasswordReset(username.trim());
    if (ok) setMode('forgotConfirm');
  };

  const submitReset = async () => {
    const ok = await confirmPasswordReset(username.trim(), resetCode.trim(), newPassword);
    if (ok) {
      setResetCode('');
      setNewPassword('');
      setPassword('');
      setJustResetPassword(true);
      setMode('signIn');
    }
  };

  if (player) {
    return (
      <Screen
        scroll
        header={{}}
        footer={
          <ButtonRow>
            <Button label={t('account.logout')} tone="danger" showArrow={false} onPress={() => setConfirmingLogout(true)} />
          </ButtonRow>
        }
      >
        <PageTitle>{t('account.title')}</PageTitle>
        <T variant="body">{t('account.loggedInAs', { username: player.username })}</T>
        {profileFailed ? (
          <T variant="label" color={colors.red}>
            {t('account.profileLoadError')}
          </T>
        ) : profile ? (
          <View style={{ gap: 6 }}>
            <T variant="label" color={colors.neutral700}>
              {profile.email ?? t('account.noEmail')}
            </T>
            {profile.createdAt ? (
              <T variant="label" color={colors.neutral700}>
                {t('account.memberSince', {
                  date: formatDate(profile.createdAt),
                })}
              </T>
            ) : null}
            <T variant="label" color={colors.neutral700}>
              {t('account.freeGames', { count: profile.freeGameCredits })}
            </T>
          </View>
        ) : null}
        <MenuItem label={t('password.title')} onPress={() => router.push('/change-password')} />
        <MenuItem label={t('nav.usageReport')} onPress={() => router.push('/usage')} />

        <ConfirmModal
          visible={confirmingLogout}
          title={t('account.logout')}
          body={t('account.logoutConfirm')}
          confirmLabel={t('common.yes')}
          cancelLabel={t('common.cancel')}
          destructive
          onConfirm={logout}
          onCancel={() => setConfirmingLogout(false)}
        />
      </Screen>
    );
  }

  const title =
    mode === 'signIn' || mode === 'create' ? t('account.title') : t('account.forgotRequestTitle');
  const canSubmitSignIn = Boolean(username.trim() && password);
  const canSubmitCreate = Boolean(username.trim() && password && EMAIL_PATTERN.test(email.trim()));
  const canSendReset = Boolean(username.trim());
  const canSubmitReset = resetCode.trim().length === 6 && Boolean(newPassword);

  // One button in the footer; switching between sign-in, sign-up and the
  // reset steps is a text link under the form, so the page fits a screen
  // without scrolling.
  const footer =
    mode === 'signIn' || mode === 'create' ? (
      // The reference button pair for the whole app: Cancel returns to the homepage.
      <ButtonRow>
        <Button label={t('common.cancel')} tone="secondary" showArrow={false} onPress={() => router.replace('/home')} />
        <Button
          label={mode === 'signIn' ? t('account.signIn') : t('account.createAccount')}
          showArrow={false}
          disabled={!(mode === 'signIn' ? canSubmitSignIn : canSubmitCreate) || playerAuthBusy || tryingAdmin}
          busy={playerAuthBusy || tryingAdmin}
          onPress={submit}
        />
      </ButtonRow>
    ) : (
      // Every step has the same pair: Cancel back to sign-in, then this step's action.
      <ButtonRow>
        <Button label={t('common.cancel')} tone="secondary" showArrow={false} onPress={() => goToMode('signIn')} />
        {mode === 'forgotRequest' ? (
          <Button
            label={t('account.sendResetCode')}
            showArrow={false}
            disabled={!canSendReset || playerAuthBusy}
            busy={playerAuthBusy}
            onPress={sendResetCode}
          />
        ) : (
          <Button
            label={t('account.resetPassword')}
            showArrow={false}
            disabled={!canSubmitReset || playerAuthBusy}
            busy={playerAuthBusy}
            onPress={submitReset}
          />
        )}
      </ButtonRow>
    );

  const intro = (
    <>
      <PageTitle>{title}</PageTitle>
      {mode !== 'signIn' && mode !== 'create' ? (
        <T variant="body" color={colors.neutral700}>
          {t(mode === 'forgotRequest' ? 'account.forgotRequestBody' : 'account.forgotConfirmBody')}
        </T>
      ) : null}
      {mode === 'create' ? (
        <T variant="label" color={colors.purple} style={{ fontSize: 13 }}>
          {t('account.signupBonus')}
        </T>
      ) : null}
      {mode === 'signIn' && justResetPassword ? (
        <T variant="label" color={colors.green}>
          {t('account.resetSuccess')}
        </T>
      ) : null}
    </>
  );
  const form = (
    <>
      {mode !== 'forgotConfirm' ? (
        <Field label={t('account.username')} value={username} onChangeText={setUsername} placeholder={t('account.username')} maxLength={40} />
      ) : null}

      {mode === 'signIn' || mode === 'create' ? (
        <Field
          label={t('account.password')}
          value={password}
          onChangeText={setPassword}
          placeholder={t('account.password')}
          secureTextEntry
        />
      ) : null}

      {mode === 'signIn' ? (
        <TextLink label={t('account.forgotPassword')} onPress={() => goToMode('forgotRequest')} />
      ) : null}

      {mode === 'create' ? (
        <>
          <Field
            label={t('account.email')}
            value={email}
            onChangeText={setEmail}
            // On a phone the "why we need it" note is the box's placeholder, so the form fits the screen.
            placeholder={width < 600 ? t('account.emailRequiredHint') : t('account.email')}
            keyboardType="email-address"
            maxLength={254}
          />
          {width >= 600 ? (
            <T variant="label" color={colors.neutral700} style={{ fontSize: 12, fontWeight: '500' }}>
              {t('account.emailRequiredHint')}
            </T>
          ) : null}
        </>
      ) : null}

      {mode === 'forgotConfirm' ? (
        <>
          <Field label={t('account.resetCode')} value={resetCode} onChangeText={setResetCode} placeholder={t('account.resetCode')} keyboardType="number-pad" maxLength={6} />
          <Field label={t('account.newPassword')} value={newPassword} onChangeText={setNewPassword} placeholder={t('account.newPassword')} secureTextEntry />
        </>
      ) : null}

      {adminRedirecting ? (
        <T variant="label" color={colors.green}>
          {t('account.openingAdminTool')}
        </T>
      ) : playerAuthError ? (
        <T variant="label" color={colors.red}>
          {playerAuthError}
        </T>
      ) : null}
    </>
  );
  const switchLink = (
    <TextLink
      label={mode === 'signIn' ? t('account.switchToCreate') : mode === 'create' ? t('account.switchToSignIn') : t('account.backToSignIn')}
      onPress={() => goToMode(mode === 'signIn' ? 'create' : 'signIn')}
    />
  );

  // A wide window puts the heading and notes beside the form instead of
  // above it, so the page fits a laptop-sized browser window without
  // scrolling (and the fields don't stretch across the whole screen).
  return (
    <Screen scroll wide header={{}} footer={footer}>
      {isWide ? (
        <View style={[styles.wideRow, lang === 'en' && styles.wideRowEn]}>
          <View style={styles.wideIntro}>
            {intro}
            {switchLink}
          </View>
          <View style={styles.wideForm}>{form}</View>
        </View>
      ) : (
        <>
          {intro}
          {form}
          {switchLink}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wideRow: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 64, paddingHorizontal: 24 },
  wideRowEn: { flexDirection: 'row' },
  wideIntro: { flex: 1, gap: 16 },
  wideForm: { flex: 1.2, gap: 16, maxWidth: 640 },
});
