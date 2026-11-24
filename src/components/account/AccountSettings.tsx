import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useAccount } from '@/account/AccountProvider';
import { alert } from '@/components/alert';
import { Colors } from '@/constants/theme';

import { Card, Choice } from './Form';
import { LinkChoice } from './LinkChoice';
import { PrivacyNote } from './PrivacyNote';

/** "Synced just now", "Synced 5 min ago"… */
export function syncedAgo(at: number | null, now = Date.now()): string {
  if (at == null) return 'Not synced yet';
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return 'Synced just now';
  if (minutes < 60) return `Synced ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Synced ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  return `Synced ${new Date(at).toLocaleDateString()}`;
}

/** Settings → Account & sync: device-only or an account, and everything about the account. */
export function AccountSettings() {
  const a = useAccount();
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (name: string, action: () => Promise<void>, failed: string) => {
    setBusy(name);
    try {
      await action();
    } catch (e) {
      alert(failed, e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  if (a.status === 'checking') return <Text style={styles.hint}>Checking your account…</Text>;

  if (a.status === 'unavailable')
    return (
      <Card>
        <Choice first title="On this device only" body="Accounts aren’t available here, so your library stays on this device." selected onPress={() => {}} />
      </Card>
    );

  if (a.status === 'signedOut' || !a.account)
    return (
      <>
        <Card>
          <Choice first title="Keep my library on this device only" body="Nothing leaves this device. Export a backup now and then." selected onPress={() => {}} />
          <Choice
            title="Sync with an account"
            body="Create an account or sign in to have your library on all your devices, and share your shelf with friends."
            selected={false}
            onPress={() => router.push('/account')}
          />
        </Card>
        <PrivacyNote />
      </>
    );

  // Signed in, but not syncing until the user says what happens to the books on this device.
  if (a.pendingLink)
    return (
      <Card>
        <View style={styles.choice}>
          <LinkChoice />
        </View>
      </Card>
    );

  const { account, sync } = a;
  const passkeyHere = account.passkeys.some((p) => p.here);
  const status = !a.syncEnabled
    ? 'Sync is off on this device'
    : sync.busy
      ? 'Syncing…'
      : a.offline
        ? 'Offline. Changes will sync when you’re back online.'
        : sync.problem ?? syncedAgo(sync.lastSyncedAt);

  const confirmDelete = () =>
    alert(
      'Delete your account?',
      'Your account, its copy of your library, your passkeys and your friends are deleted from Bookie’s servers straight away. The books on this device stay. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: () => act('delete', a.deleteAccount, 'Couldn’t delete your account') },
      ],
    );

  return (
    <>
      <Card>
        <View style={styles.firstRow}>
          <Text style={styles.rowText}>
            Signed in as <Text style={styles.strong}>{account.username}</Text>
          </Text>
          <Text style={[styles.rowHint, sync.problem && a.syncEnabled && !sync.busy && { color: Colors.danger }]}>{status}</Text>
        </View>
        <SwitchRow
          title="Sync this device’s library"
          body="Off keeps the books here as they are and stops sending or fetching changes. You stay signed in for friends."
          value={a.syncEnabled}
          onChange={(on) => act('sync', () => a.setSyncEnabled(on), 'Couldn’t change sync')}
        />
        {a.syncEnabled && (
          <Row title={busy === 'syncnow' || sync.busy ? 'Syncing…' : 'Sync now'} disabled={sync.busy} onPress={() => act('syncnow', a.syncNow, 'Couldn’t sync')} />
        )}
        <SwitchRow
          title="Show my shelf to friends"
          body="Friends see your books, whether you’ve read them, your ratings and reading dates. Your notes stay private."
          value={account.shelfVisible}
          onChange={(on) => act('shelf', () => a.setShelfVisible(on), 'Couldn’t change that')}
        />
        <Row title="Friends" onPress={() => router.push('/friends')} />
      </Card>

      <Card>
        {a.passkeys && !passkeyHere && <Row first title="Add a passkey" disabled={busy === 'passkey'} onPress={() => act('passkey', a.addPasskey, 'Couldn’t add a passkey')} />}
        <Row first={!a.passkeys || passkeyHere} title={account.hasPassword ? 'Change password' : 'Add a password'} onPress={() => router.push({ pathname: '/account', params: { mode: 'password' } })} />
        <Row title="Download my data" disabled={busy === 'export'} onPress={() => act('export', a.exportData, 'Couldn’t download your data')} />
        <Row title="Sign out" onPress={() => act('signout', a.signOut, 'Couldn’t sign out')} />
        <Row title="Delete account" danger disabled={busy === 'delete'} onPress={confirmDelete} />
      </Card>
      <Text style={styles.hint}>
        Signing out or turning sync off keeps your library on this device. {account.passkeys.length ? `Passkeys: ${account.passkeys.length}. ` : ''}
        {account.hasPassword ? 'You have a password.' : 'No password yet.'}
      </Text>
      <PrivacyNote />
    </>
  );
}

function Row({ title, onPress, first, danger, disabled }: { title: string; onPress: () => void; first?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable style={first ? styles.firstRow : styles.row} onPress={onPress} disabled={disabled} accessibilityRole="button">
      <Text style={[styles.rowText, danger && { color: Colors.danger }, disabled && { color: Colors.border }]}>{title}</Text>
    </Pressable>
  );
}

function SwitchRow({ title, body, value, onChange }: { title: string; body: string; value: boolean; onChange: (on: boolean) => void }) {
  return (
    <View style={[styles.row, styles.switchRow]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowText}>{title}</Text>
        <Text style={styles.rowHint}>{body}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: Colors.accent, false: Colors.border }} accessibilityLabel={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  firstRow: { paddingVertical: 14, paddingHorizontal: 16 },
  row: { paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { color: Colors.text, fontSize: 16, fontWeight: '500' },
  strong: { fontWeight: '700' },
  rowHint: { color: Colors.textMuted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  hint: { color: Colors.textMuted, fontSize: 13, paddingHorizontal: 4 },
  choice: { padding: 16 },
});
