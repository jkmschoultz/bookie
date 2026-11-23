import * as Haptics from 'expo-haptics';
import { router, useIsFocused } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccount } from '@/account/AccountProvider';
import { alert } from '@/components/alert';
import { BringBooksNote } from '@/components/BringBooksNote';
import { FriendsIcon } from '@/components/FriendsIcon';
import { MovedBanner } from '@/components/MovedBanner';
import { QuickActions } from '@/components/QuickActions';
import { SortBar } from '@/components/SortBar';
import { Bookcase } from '@/components/shelf/Bookcase';
import { TOUR_STEPS, inBrowserTab } from '@/components/tourSteps';
import { Colors, Fonts } from '@/constants/theme';
import { PULL_OUT_MS, useBookFlight, type SpineRect } from '@/library/bookFlight';
import { useLibrary } from '@/library/LibraryProvider';
import {
  markOnboardingSeen,
  markWhatsToComeSeen,
  recordAppOpen,
  seenTourVersion,
  shouldShowWhatsToCome,
  tourSteps,
  whatsNewMessage,
  whatsToComeSeen,
} from '@/library/onboarding';
import { sampleBooks } from '@/library/sampleBooks';
import { filterBooks } from '@/shelf/filter';
import { useUi } from '@/store/uiStore';
import type { Book } from '@/types';

/** "Friends, 1 request waiting, 2 friends with news". */
function friendsLabel({ requests, updated }: { requests: number; updated: number }): string {
  const parts = ['Friends'];
  if (requests) parts.push(`${requests} ${requests === 1 ? 'request' : 'requests'} waiting`);
  if (updated) parts.push(`${updated} ${updated === 1 ? 'friend' : 'friends'} with news`);
  return parts.join(', ');
}

export default function BookshelfScreen() {
  const insets = useSafeAreaInsets();
  const { books, loaded, addBooks } = useLibrary();
  const { sortMode, layoutMode, statusFilter, ownedFilter } = useUi();
  const [actionBook, setActionBook] = useState<Book | null>(null);
  const { friendBadge } = useAccount();
  const badge = friendBadge.requests + friendBadge.updated;

  // Read once the checks below are done, so "What's to come" never opens over another screen or sheet.
  const focused = useIsFocused();
  const now = useRef({ focused, books: books.length });
  useEffect(() => {
    now.current = { focused, books: books.length };
  }, [focused, books.length]);

  useEffect(() => {
    if (!loaded) return;
    SplashScreen.hideAsync();
    (async () => {
      const opens = await recordAppOpen();
      const seen = await seenTourVersion();
      const fresh = seen == null ? [] : tourSteps(TOUR_STEPS, seen, { web: inBrowserTab() });
      if (seen == null) router.push('/welcome');
      else if (fresh.length) {
        // Asked once per tour version, whichever way they answer.
        await markOnboardingSeen();
        alert('Psst, Bookie has been updated', whatsNewMessage(fresh.map((s) => s.title)), [
          { text: 'Not now', style: 'cancel' },
          { text: 'Show me', onPress: () => router.push({ pathname: '/welcome', params: { since: String(seen) } }) },
        ]);
      }
      const tourOffered = seen == null || fresh.length > 0;
      if (!shouldShowWhatsToCome({ opens, books: now.current.books, seen: await whatsToComeSeen(), tourOffered }) || !now.current.focused) return;
      // Shown once, however it's closed.
      await markWhatsToComeSeen();
      router.push('/whats-to-come');
    })();
  }, [loaded]);

  const visible = useMemo(
    () => filterBooks(books, { statuses: statusFilter, owned: ownedFilter }),
    [books, statusFilter, ownedFilter],
  );

  const reduceMotion = useReducedMotion();
  const startFlight = useBookFlight((f) => f.start);
  const openBook = useCallback(
    (book: Book, from?: SpineRect) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // The book flies from its shelf to its page on web, where the page opens in place under it. On phones the page
      // slides up as a native sheet, which would cover the flying book, so it opens as before.
      const open = () => router.push({ pathname: '/book/[id]', params: { id: String(book.id) } });
      if (from && Platform.OS === 'web' && !reduceMotion) {
        startFlight(book, from);
        // Let it come out of the shelf first, with the shelf still there behind it.
        setTimeout(open, PULL_OUT_MS);
      } else open();
    },
    [reduceMotion, startFlight],
  );

  const showActions = useCallback((book: Book) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionBook(book);
  }, []);

  const read = books.filter((b) => b.status === 'read').length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Bookie</Text>
          {books.length > 0 && (
            <Text style={styles.subtitle}>
              {books.length} books · {read} read
            </Text>
          )}
        </View>
        <View style={styles.headerButtons}>
          <Pressable
            onPress={() => router.push('/friends')}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={friendsLabel(friendBadge)}>
            <FriendsIcon />
            {/* Red with a request waiting; gold when it's only friends' news. */}
            {badge > 0 && (
              <View style={[styles.badge, !friendBadge.requests && styles.newsBadge]}>
                <Text style={[styles.badgeText, !friendBadge.requests && styles.newsBadgeText]}>{badge > 9 ? '9+' : badge}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Settings">
            <Text style={styles.iconText}>⚙</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/add')} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Add books">
            <Text style={styles.addText}>＋</Text>
          </Pressable>
        </View>
      </View>

      <MovedBanner />
      <BringBooksNote />

      {loaded && books.length === 0 ? (
        <EmptyLibrary onSample={() => addBooks(sampleBooks())} />
      ) : (
        <>
          <SortBar />
          {visible.length ? (
            <Bookcase
              books={visible}
              sortMode={sortMode}
              layoutMode={layoutMode}
              onOpen={openBook}
              onLongPress={showActions}
              bottomInset={insets.bottom}
            />
          ) : (
            <Text style={styles.noMatch}>No books match these filters.</Text>
          )}
        </>
      )}

      <QuickActions book={actionBook} onClose={() => setActionBook(null)} onOpen={openBook} />
    </View>
  );
}

function EmptyLibrary({ onSample }: { onSample: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Your shelves are empty</Text>
      <Text style={styles.emptyBody}>Add books by searching, scanning a barcode, or importing your Goodreads library.</Text>
      <Pressable style={styles.primary} onPress={() => router.push('/add')}>
        <Text style={styles.primaryText}>Add books</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={onSample}>
        <Text style={styles.secondaryText}>Fill with a sample library</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: { color: Colors.text, fontSize: 30, fontFamily: Fonts.serif, fontWeight: '700' },
  subtitle: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: Colors.textMuted, fontSize: 22 },
  badge: {
    position: 'absolute',
    top: 3,
    right: 1,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Colors.ribbon,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  newsBadge: { backgroundColor: Colors.accent },
  newsBadgeText: { color: Colors.accentText },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: Colors.accentText, fontSize: 24, fontWeight: '700', marginTop: -2 },
  noMatch: { color: Colors.textMuted, textAlign: 'center', marginTop: 60 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { color: Colors.text, fontSize: 22, fontFamily: Fonts.serif, fontWeight: '700' },
  emptyBody: { color: Colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 21, marginBottom: 12 },
  primary: { backgroundColor: Colors.accent, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12 },
  primaryText: { color: Colors.accentText, fontWeight: '700', fontSize: 16 },
  secondary: { paddingHorizontal: 20, paddingVertical: 10 },
  secondaryText: { color: Colors.accent, fontWeight: '600', fontSize: 15 },
});
