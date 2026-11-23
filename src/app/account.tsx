import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAccount, type SignInResult } from '@/account/AccountProvider';
import { Card, Choice, Field, formStyles, LinkButton, PrimaryButton } from '@/components/account/Form';
import { LinkChoice } from '@/components/account/LinkChoice';
import { PrivacyNote } from '@/components/account/PrivacyNote';
import { Colors } from '@/constants/theme';
import { PASSWORD_MIN, passwordProblem, usernameProblem } from '@shared/account';

type Mode = 'signup' | 'signin' | 'recover' | 'password';

const TITLES: Record<Mode, string> = { signup: 'Create an account', signin: 'Sign in', recover: 'Forgot your password', password: 'Password' };

/**
 * Creating an account, signing in, resetting a forgotten password with the recovery code, and (signed in) adding or
 * changing a password. Opened from Settings → Account & sync, and from Friends.
 */
export default function AccountScreen() {
  const params = useLocalSearchParams<{ mode?: Mode }>();
  const accountState = useAccount();
  const { account, passkeys } = accountState;
  const [mode, setMode] = useState<Mode>(params.mode ?? 'signup');
  const [method, setMethod] = useState<'passkey' | 'password'>(passkeys ? 'passkey' : 'password');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A recovery code to show once, after which the screen closes. */
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const run = async (action: () => Promise<Partial<SignInResult>>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      // A recovery code first; then, if there's a choice about this device's books, it's shown here (pendingLink).
      if (result.recoveryCode) setRecoveryCode(result.recoveryCode);
      else if (!result.choose) router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const usernameError = username && usernameProblem(username.trim());
  const passwordError = password && passwordProblem(password);

  if (recoveryCode)
    return (
      <RecoveryCode
        code={recoveryCode}
        onSaved={() => {
          setRecoveryCode(null);
          if (!accountState.pendingLink) router.back();
        }}
      />
    );

  if (accountState.pendingLink)
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Your books' }} />
        <LinkChoice onDone={() => router.back()} />
      </ScrollView>
    );

  const changing = mode === 'password' && account?.hasPassword;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: TITLES[mode] }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {mode === 'signup' && (
          <>
            <Text style={styles.lead}>
              An account keeps your library the same on all your devices, and lets friends you choose see your shelf. The
              books on this device become your account’s. It’s optional: without one, everything stays on this device.
            </Text>
            <Field label="Username" value={username} onChangeText={setUsername} autoComplete="username-new" error={usernameError} hint="3 to 20 letters, digits, _ or . Friends add you by this." />
            <Field label="Name (optional)" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" autoComplete="name" hint="Shown to friends instead of your username." />
            <Text style={styles.label}>Sign in with</Text>
            <Card>
              {passkeys && (
                <Choice first title="A passkey" body="Your fingerprint, face or device PIN. Nothing to remember. Works on this site, in this browser or its password manager." selected={method === 'passkey'} onPress={() => setMethod('passkey')} />
              )}
              <Choice first={!passkeys} title="A password" body={`At least ${PASSWORD_MIN} characters. You get a recovery code in case you forget it.`} selected={method === 'password'} onPress={() => setMethod('password')} />
            </Card>
            {!passkeys && Platform.OS !== 'web' && <Text style={formStyles.note}>Passkeys work in Bookie on the web. The app uses a password for now.</Text>}
            {method === 'password' && <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={passwordError} />}
            <PrimaryButton
              title="Create account"
              busy={busy}
              disabled={!username || !!usernameError || (method === 'password' && (!password || !!passwordError))}
              onPress={() =>
                run(() =>
                  method === 'passkey' ? accountState.signUpWithPasskey(username.trim(), displayName) : accountState.signUpWithPassword(username.trim(), displayName, password),
                )
              }
            />
            {error && <Text style={formStyles.error}>{error}</Text>}
            <LinkButton title="I already have an account" onPress={() => switchTo('signin')} />
          </>
        )}

        {mode === 'signin' && (
          <>
            {passkeys && (
              <>
                <PrimaryButton title="Sign in with a passkey" busy={busy && method === 'passkey'} onPress={() => {
                    setMethod('passkey');
                    run(accountState.signInWithPasskey);
                  }}
                />
                <Text style={styles.or}>or with a password</Text>
              </>
            )}
            <Field label="Username" value={username} onChangeText={setUsername} autoComplete="username" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
            <PrimaryButton
              title="Sign in"
              busy={busy && method === 'password'}
              disabled={!username || !password}
              onPress={() => {
                setMethod('password');
                run(() => accountState.signInWithPassword(username.trim(), password));
              }}
            />
            {error && <Text style={formStyles.error}>{error}</Text>}
            <Text style={formStyles.note}>If this device has books, you’ll be asked whether to add them to your account or replace them with your account’s.</Text>
            <LinkButton title="Forgot your password?" onPress={() => switchTo('recover')} />
            <LinkButton title="Create an account instead" onPress={() => switchTo('signup')} />
          </>
        )}

        {mode === 'recover' && (
          <>
            <Text style={styles.lead}>Use the recovery code you saved when you made your password. You’ll get a new code, and other devices will be signed out.</Text>
            <Field label="Username" value={username} onChangeText={setUsername} autoComplete="username" />
            <Field label="Recovery code" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX" />
            <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={passwordError} />
            <PrimaryButton title="Set new password" busy={busy} disabled={!username || !code || !password || !!passwordError} onPress={() => run(() => accountState.recover(username.trim(), code, password))} />
            {error && <Text style={formStyles.error}>{error}</Text>}
            <Text style={formStyles.note}>Without the code, a forgotten password can’t be reset: Bookie has no email address for you. If you have a passkey, sign in with that instead.</Text>
            <LinkButton title="Back to sign in" onPress={() => switchTo('signin')} />
          </>
        )}

        {mode === 'password' && (
          <>
            <Text style={styles.lead}>{changing ? 'Choose a new password.' : `Add a password, to sign in where your passkey isn’t. At least ${PASSWORD_MIN} characters.`}</Text>
            {changing && <Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoComplete="current-password" />}
            <Field label={changing ? 'New password' : 'Password'} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={passwordError} />
            <PrimaryButton
              title={changing ? 'Change password' : 'Add password'}
              busy={busy}
              disabled={!password || !!passwordError || (changing && !currentPassword)}
              onPress={() => run(async () => ({ recoveryCode: await accountState.setPassword(password, changing ? currentPassword : undefined) }))}
            />
            {error && <Text style={formStyles.error}>{error}</Text>}
          </>
        )}

        {(mode === 'signup' || mode === 'signin') && (
          <View style={styles.footer}>
            <LinkButton title="Keep my library on this device only" onPress={() => router.back()} />
            <PrivacyNote />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Shown once after making a password (or resetting it). */
function RecoveryCode({ code, onSaved }: { code: string; onSaved: () => void }) {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Your recovery code' }} />
      <Text style={styles.lead}>If you forget your password, this code lets you set a new one. Bookie has no email address for you, so it’s the only way back in.</Text>
      <Card>
        <Text selectable style={styles.code} accessibilityLabel={`Recovery code ${code.split('').join(' ')}`}>
          {code}
        </Text>
      </Card>
      <Text style={formStyles.note}>It’s shown only this once. Write it down, or keep it in your password manager.</Text>
      <PrimaryButton title="I’ve saved it" onPress={onSaved} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, paddingBottom: 60, maxWidth: 520, width: '100%', alignSelf: 'center' },
  lead: { color: Colors.text, fontSize: 15, lineHeight: 21 },
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 8 },
  or: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8 },
  footer: { marginTop: 16, gap: 8 },
  code: { color: Colors.text, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, monospace' }), fontSize: 24, letterSpacing: 2, textAlign: 'center', paddingVertical: 22 },
});
