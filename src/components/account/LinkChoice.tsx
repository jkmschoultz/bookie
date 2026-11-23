import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAccount } from '@/account/AccountProvider';
import { alert } from '@/components/alert';
import { Colors, Fonts } from '@/constants/theme';

import { formStyles, LinkButton } from './Form';

/**
 * What to do with the books on this device when an account signs in that doesn't have them yet: add them to the
 * account, or replace them with the account's. Nothing syncs until one is chosen. Shown after signing in, and in
 * Settings until it's answered.
 */
export function LinkChoice({ onDone }: { onDone?: () => void }) {
  const { pendingLink, chooseLink } = useAccount();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!pendingLink) return null;
  const { account, switching, books } = pendingLink;
  const name = account.username;
  const count = `${books} ${books === 1 ? 'book' : 'books'}`;

  const choose = async (choice: 'add' | 'replace' | 'cancel') => {
    setBusy(true);
    setProblem(null);
    try {
      await chooseLink(choice);
      onDone?.();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const replace = () =>
    alert(`Remove the ${count} on this device?`, `They’re replaced with ${name}’s library. This can’t be undone here, so export a backup first if you might want them.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace', style: 'destructive', onPress: () => choose('replace') },
    ]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{switching ? 'These books belong to another account' : 'This device already has books'}</Text>
      <Text style={styles.body}>
        {switching
          ? `The ${count} here were synced with a different account. Choose what happens to them now that you’re signed in as ${name}. Nothing is sent until you do.`
          : `There ${books === 1 ? 'is' : 'are'} ${count} on this device. Choose what happens to them now that you’re signed in as ${name}. Nothing is sent until you do.`}
      </Text>
      <Option title={`Add this device’s books to ${name}`} body="They’re merged with the account’s books. Nothing is replaced." onPress={() => choose('add')} disabled={busy} />
      <Option title={`Replace this device’s library with ${name}’s`} body="The books here are removed from this device, and the account’s books take their place." onPress={replace} disabled={busy} />
      {problem && <Text style={formStyles.error}>{problem}</Text>}
      <LinkButton title="Cancel and sign out" onPress={() => choose('cancel')} />
    </View>
  );
}

function Option({ title, body, onPress, disabled }: { title: string; body: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable style={[styles.option, disabled && { opacity: 0.6 }]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={title}>
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.optionBody}>{body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: { color: Colors.text, fontSize: 21, fontFamily: Fonts.serif, fontWeight: '700' },
  body: { color: Colors.textMuted, fontSize: 15, lineHeight: 21 },
  option: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 4 },
  optionTitle: { color: Colors.accent, fontSize: 16, fontWeight: '700' },
  optionBody: { color: Colors.textMuted, fontSize: 13, lineHeight: 18 },
});
