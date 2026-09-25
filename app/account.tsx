import { router } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { Button, ConfirmModal, Divider, Field, Screen, Spacer, T, TextLink } from '../src/ui/components';
import { Hero } from '../src/ui/Hero';
import { colors, spacing } from '../src/ui/theme';
import { goBack } from '../src/platform/navigation';
import { useApp } from '../src/state/AppProvider';
import { CATALOGUE_API_URL } from '../src/config';
import { loginAdmin } from '../src/services/adminAuthApi';

type Mode = 'signIn' | 'create' | 'forgotRequest' | 'forgotConfirm';

export default function Account() {
  const {
    t,
    player,
    playerAuthBusy,
    playerAuthError,
    registerPlayerAccount,
    loginPlayerAccount,
    logoutPlayerAccount,
    requestPasswordReset,
    confirmPasswordReset,
  } = useApp();
  const [mode, setMode] = useState<Mode>('signIn');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [justResetPassword, setJustResetPassword] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [tryingAdmin, setTryingAdmin] = useState(false);
  const [adminRedirecting, setAdminRedirecting] = useState(false);

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
      const ok = await registerPlayerAccount(username.trim(), password, email.trim() || undefined);
      if (ok) router.back();
      return;
    }

    const ok = await loginPlayerAccount(username.trim(), password);
    if (ok) {
      router.back();
      return;
    }

    // Not a player account, or the wrong password — try it as an admin
    // sign-in instead, so an admin never needs a separate "Admin sign-in"
    // link to find their own form. A real admin tool (deck management,
    // players, audit log) lives on its own separate page (`/admin-ui`),
    // not inside this app, so success here means opening that page with
    // the freshly issued token rather than navigating anywhere in-app.
    setTryingAdmin(true);
    try {
      const result = await loginAdmin(username.trim(), password);
      setAdminRedirecting(true);
      const adminUrl = `${CATALOGUE_API_URL}/admin-ui?token=${encodeURIComponent(
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
        header={{ onBack: () => goBack() }}
        footer={<Button label={t('account.logout')} tone="danger" showArrow={false} onPress={() => setConfirmingLogout(true)} />}
      >
        <Spacer size={spacing.md} />
        <Hero />
        <Spacer size={spacing.md} />
        <Divider />
        <Spacer size={spacing.md} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <T variant="title" style={{ fontSize: 44, lineHeight: 50 }}>
            {t('account.title')}
          </T>
        </View>
        <Spacer size={spacing.xl} />
        <T variant="body">{t('account.loggedInAs', { username: player.username })}</T>

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
  const canSendReset = Boolean(username.trim());
  const canSubmitReset = resetCode.trim().length === 6 && Boolean(newPassword);

  const footer =
    mode === 'signIn' || mode === 'create' ? (
      <>
        <Button
          label={mode === 'signIn' ? t('account.signIn') : t('account.createAccount')}
          disabled={!canSubmitSignIn || playerAuthBusy || tryingAdmin}
          busy={playerAuthBusy || tryingAdmin}
          onPress={submit}
        />
        <Spacer size={spacing.sm} />
        <Button
          label={mode === 'signIn' ? t('account.switchToCreate') : t('account.switchToSignIn')}
          tone="secondary"
          showArrow={mode === 'signIn'}
          onPress={() => goToMode(mode === 'signIn' ? 'create' : 'signIn')}
        />
      </>
    ) : mode === 'forgotRequest' ? (
      <>
        <Button label={t('account.sendResetCode')} disabled={!canSendReset || playerAuthBusy} busy={playerAuthBusy} onPress={sendResetCode} />
        <Spacer size={spacing.sm} />
        <Button label={t('account.backToSignIn')} tone="secondary" showArrow={false} onPress={() => goToMode('signIn')} />
      </>
    ) : (
      <>
        <Button label={t('account.resetPassword')} disabled={!canSubmitReset || playerAuthBusy} busy={playerAuthBusy} onPress={submitReset} />
        <Spacer size={spacing.sm} />
        <Button label={t('account.backToSignIn')} tone="secondary" showArrow={false} onPress={() => goToMode('signIn')} />
      </>
    );

  return (
    <Screen scroll header={{ onBack: () => goBack() }} footer={footer}>
      <Spacer size={spacing.md} />
      <Hero />
      <Spacer size={spacing.md} />
      <Divider />
      <Spacer size={spacing.md} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <T variant="title" style={{ fontSize: 44, lineHeight: 50 }}>
          {title}
        </T>
      </View>

      {mode !== 'signIn' && mode !== 'create' ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="body" color={colors.neutral700}>
            {t(mode === 'forgotRequest' ? 'account.forgotRequestBody' : 'account.forgotConfirmBody')}
          </T>
        </>
      ) : null}
      {mode === 'create' ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.purple}>
            {t('account.signupBonus')}
          </T>
        </>
      ) : null}
      {mode === 'signIn' && justResetPassword ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.green}>
            {t('account.resetSuccess')}
          </T>
        </>
      ) : null}

      <Spacer size={spacing.xl} />

      {mode !== 'forgotConfirm' ? (
        <Field label={t('account.username')} value={username} onChangeText={setUsername} placeholder={t('account.username')} maxLength={40} />
      ) : null}

      {mode === 'signIn' || mode === 'create' ? (
        <>
          <Spacer size={spacing.md} />
          <Field
            label={t('account.password')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('account.password')}
            secureTextEntry
          />
        </>
      ) : null}

      {mode === 'signIn' ? (
        <>
          <Spacer size={spacing.md} />
          <TextLink label={t('account.forgotPassword')} onPress={() => goToMode('forgotRequest')} />
        </>
      ) : null}

      {mode === 'create' ? (
        <>
          <Spacer size={spacing.md} />
          <Field
            label={t('account.email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('account.email')}
            keyboardType="email-address"
            maxLength={254}
          />
          <Spacer size={spacing.xs} />
          <T variant="label" color={colors.neutral700}>
            {t('account.emailOptionalHint')}
          </T>
        </>
      ) : null}

      {mode === 'forgotConfirm' ? (
        <>
          <Field label={t('account.resetCode')} value={resetCode} onChangeText={setResetCode} placeholder={t('account.resetCode')} keyboardType="number-pad" maxLength={6} />
          <Spacer size={spacing.md} />
          <Field label={t('account.newPassword')} value={newPassword} onChangeText={setNewPassword} placeholder={t('account.newPassword')} secureTextEntry />
        </>
      ) : null}

      {adminRedirecting ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.green}>
            {t('account.openingAdminTool')}
          </T>
        </>
      ) : playerAuthError ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.red}>
            {playerAuthError}
          </T>
        </>
      ) : null}
    </Screen>
  );
}
