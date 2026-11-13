import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useLibrary } from '@/library/LibraryProvider';
import { MoveError, movedTo, sendLibrary, type MoveResult } from '@/library/move';
import { backupFileName, toBackup } from '@/services/backup';
import { saveJsonFile } from '@/services/files';
import { useUi } from '@/store/uiStore';

const MOVED_KEY = 'move.done';

type State =
  | { kind: 'idle' }
  | { kind: 'moving' }
  | { kind: 'done'; result: MoveResult | null }
  | { kind: 'error'; error: MoveError };

const ERRORS: Record<MoveError['kind'], string> = {
  blocked: 'Your browser blocked the new window. Allow pop-ups for this site and try again.',
  closed: 'The new window closed before your books got there. Try again and leave it open until it says they’ve arrived.',
  // Bookie can only have its library open in one tab per address, so a tab already open at the new address blocks it.
  timeout:
    'The new Bookie didn’t answer. If it’s open in another tab, close that tab and try again. Or save a backup here and restore it there.',
  failed: 'The new Bookie couldn’t take your books.',
};

/**
 * Shown at the old web address once Bookie has moved (see `src/library/move.ts`). One tap opens the new address and
 * hands it this browser's library. Nothing here is deleted, so the old address keeps working.
 */
export function MovedBanner() {
  const [target] = useState(movedTo);
  if (!target) return null;
  return <Banner target={target} />;
}

function Banner({ target }: { target: string }) {
  const { books } = useLibrary();
  const layoutMode = useUi((s) => s.layoutMode);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const host = new URL(target).host;

  useEffect(() => {
    Storage.getItem(MOVED_KEY).then((v) => v && setState((s) => (s.kind === 'idle' ? { kind: 'done', result: null } : s)));
  }, []);

  const move = () => {
    // No await before this: the browser only opens the new window while it's still handling the tap.
    const sending = sendLibrary(target, { backup: toBackup(books), layoutMode });
    setState({ kind: 'moving' });
    sending.then(
      (result) => {
        Storage.setItem(MOVED_KEY, new Date().toISOString());
        setState({ kind: 'done', result });
      },
      (e) => setState({ kind: 'error', error: e instanceof MoveError ? e : new MoveError('failed', String(e)) }),
    );
  };

  const open = () => window.location.assign(target);
  const exportBackup = () => saveJsonFile(backupFileName(), toBackup(books)).catch(() => {});

  let message: string;
  let actions: { label: string; onPress: () => void; primary?: boolean }[] = [];
  switch (state.kind) {
    case 'idle':
      message = books.length
        ? `Bookie has moved to ${host}. Your books are saved in this browser, so bring them with you.`
        : `Bookie has moved to ${host}.`;
      actions = books.length ? [{ label: 'Move my books', onPress: move, primary: true }] : [{ label: 'Go there', onPress: open, primary: true }];
      break;
    case 'moving':
      message = `Sending your ${books.length} ${books.length === 1 ? 'book' : 'books'} to ${host}…`;
      break;
    case 'done':
      message = state.result
        ? `Done: ${state.result.added} ${state.result.added === 1 ? 'book' : 'books'} moved to ${host}${state.result.skipped ? ` (${state.result.skipped} already there)` : ''}. Your books here haven’t been touched.`
        : `Your books were moved to ${host}. Anything you add here from now on stays here, unless you move again: books already there are skipped.`;
      actions = [
        { label: `Open ${host}`, onPress: open, primary: true },
        { label: 'Move again', onPress: move },
      ];
      break;
    case 'error':
      message = state.error.kind === 'failed' ? `${ERRORS.failed} ${state.error.message}` : ERRORS[state.error.kind];
      actions = [
        { label: 'Try again', onPress: move, primary: true },
        { label: 'Export backup', onPress: exportBackup },
      ];
      break;
  }

  return (
    <View style={styles.banner} accessibilityRole="summary">
      <Text style={styles.text}>{message}</Text>
      {actions.length > 0 && (
        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable key={a.label} onPress={a.onPress} style={a.primary ? styles.primary : styles.secondary} accessibilityRole="button">
              <Text style={a.primary ? styles.primaryText : styles.secondaryText}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    gap: 10,
    borderRadius: 14,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  text: { color: Colors.text, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  primary: { backgroundColor: Colors.accent, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  primaryText: { color: Colors.accentText, fontWeight: '700', fontSize: 14 },
  secondary: { paddingHorizontal: 12, paddingVertical: 9 },
  secondaryText: { color: Colors.accent, fontWeight: '600', fontSize: 14 },
});
