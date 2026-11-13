import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeScreenGuide } from '@/components/HomeScreenGuide';
import { Colors, Fonts } from '@/constants/theme';
import { useLibrary } from '@/library/LibraryProvider';
import { asMoveMessage, OLD_ORIGIN, type MoveMessage } from '@/library/move';
import { markOnboardingSeen } from '@/library/onboarding';
import { onlyNewBooks, parseBackup } from '@/services/backup';
import { useUi } from '@/store/uiStore';

type State =
  | { kind: 'waiting' }
  | { kind: 'nothing' }
  | { kind: 'done'; added: number; skipped: number }
  | { kind: 'failed'; message: string };

/**
 * Where the old web address sends its library (see `src/library/move.ts`). The old site opens this screen in a new
 * window; it asks the old site for the books, adds the ones that aren't here yet, and says how it went.
 */
export default function MoveInScreen() {
  const insets = useSafeAreaInsets();
  const { books, loaded, addBooks } = useLibrary();
  const setLayoutMode = useUi((s) => s.setLayoutMode);
  // Only the old site's banner opens this screen in a window it can talk to.
  const [opener] = useState<Window | null>(() => (Platform.OS === 'web' && OLD_ORIGIN ? window.opener : null));
  const [state, setState] = useState<State>(opener ? { kind: 'waiting' } : { kind: 'nothing' });
  const booksRef = useRef(books);
  useEffect(() => {
    booksRef.current = books;
  }, [books]);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (!loaded || !opener || !OLD_ORIGIN) return;
    const oldOrigin = OLD_ORIGIN;
    const reply = (msg: MoveMessage) => opener.postMessage(msg, oldOrigin);
    let received = false;

    const onMessage = async (e: MessageEvent) => {
      if (received || e.origin !== oldOrigin || e.source !== opener) return;
      const msg = asMoveMessage(e.data);
      if (msg?.type !== 'bookie-move:library') return;
      received = true;
      try {
        const incoming = parseBackup(msg.backup);
        const fresh = onlyNewBooks(incoming, booksRef.current);
        await addBooks(fresh);
        if (msg.layoutMode) setLayoutMode(msg.layoutMode);
        // They've used Bookie already; the tour would only get in the way of their shelves.
        await markOnboardingSeen();
        const result = { added: fresh.length, skipped: incoming.length - fresh.length };
        reply({ type: 'bookie-move:done', ...result });
        setState({ kind: 'done', ...result });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        reply({ type: 'bookie-move:failed', message });
        setState({ kind: 'failed', message });
      }
    };

    window.addEventListener('message', onMessage);
    // postMessage to the old origin only: if this window was opened by any other site, nothing is sent.
    const ready = () => !received && reply({ type: 'bookie-move:ready' });
    ready();
    const again = setInterval(ready, 1000);
    return () => {
      window.removeEventListener('message', onMessage);
      clearInterval(again);
    };
  }, [loaded, opener, addBooks, setLayoutMode]);

  const openShelves = () => router.replace('/');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 48 }]}>
      <Text style={styles.title}>Welcome to Bookie’s new home</Text>

      {state.kind === 'waiting' && (
        <View style={styles.row}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={styles.body}>Bringing your books over…</Text>
        </View>
      )}

      {state.kind === 'nothing' && (
        <>
          <Text style={styles.body}>
            There’s nothing to move here. To bring your books over, open Bookie at its old address and tap Move my books.
          </Text>
          <Pressable style={styles.primary} onPress={openShelves}>
            <Text style={styles.primaryText}>Go to my shelves</Text>
          </Pressable>
        </>
      )}

      {state.kind === 'failed' && (
        <>
          <Text style={styles.body}>Your books couldn’t be moved: {state.message}</Text>
          <Text style={styles.body}>
            Nothing was changed at the old address. Go back to that tab and try again, or use Settings → Export backup there and
            Restore from backup here.
          </Text>
        </>
      )}

      {state.kind === 'done' && (
        <>
          <Text style={styles.body}>
            {state.added} {state.added === 1 ? 'book is' : 'books are'} now on your shelves here
            {state.skipped ? `, and ${state.skipped} ${state.skipped === 1 ? 'was' : 'were'} here already` : ''}.
          </Text>
          <Pressable style={styles.primary} onPress={openShelves}>
            <Text style={styles.primaryText}>See my shelves</Text>
          </Pressable>
          <Text style={[styles.body, styles.spaced]}>
            Had Bookie on your home screen? That icon still opens the old address. Add this one, then remove the old icon:
          </Text>
          <HomeScreenGuide />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 24, gap: 14, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: { color: Colors.text, fontSize: 26, fontFamily: Fonts.serif, fontWeight: '700', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { color: Colors.textMuted, fontSize: 15, lineHeight: 21 },
  primary: { backgroundColor: Colors.accent, paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  primaryText: { color: Colors.accentText, fontWeight: '700', fontSize: 16 },
  spaced: { marginTop: 18 },
});
