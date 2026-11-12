import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { alert } from '@/components/alert';
import { QuickActions } from '@/components/QuickActions';
import { SortBar } from '@/components/SortBar';
import { Bookcase } from '@/components/shelf/Bookcase';
import { Colors, Fonts } from '@/constants/theme';
import { useLibrary } from '@/library/LibraryProvider';
import { markOnboardingSeen, tourStatus } from '@/library/onboarding';
import { sampleBooks } from '@/library/sampleBooks';
import { filterBooks } from '@/shelf/filter';
import { useUi } from '@/store/uiStore';
import type { Book } from '@/types';

export default function BookshelfScreen() {
  const insets = useSafeAreaInsets();
  const { books, loaded, addBooks } = useLibrary();
  const { sortMode, layoutMode, statusFilter, ownedFilter } = useUi();
  const [actionBook, setActionBook] = useState<Book | null>(null);

  useEffect(() => {
    if (!loaded) return;
    SplashScreen.hideAsync();
    tourStatus().then(async (status) => {
      if (status === 'new') router.push('/welcome');
      else if (status === 'updated') {
        // Asked once per tour version, whichever way they answer.
        await markOnboardingSeen();
        alert('Psst, Bookie has been updated', 'The welcome tour has new things in it, like how book sizes and bookmarks work. Want a look?', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Show me', onPress: () => router.push('/welcome') },
        ]);
      }
    });
  }, [loaded]);

  const visible = useMemo(
    () => filterBooks(books, { statuses: statusFilter, owned: ownedFilter }),
    [books, statusFilter, ownedFilter],
  );

  const openBook = useCallback((book: Book) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/book/[id]', params: { id: String(book.id) } });
  }, []);

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
          <Pressable onPress={() => router.push('/settings')} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Settings">
            <Text style={styles.iconText}>⚙</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/add')} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Add books">
            <Text style={styles.addText}>＋</Text>
          </Pressable>
        </View>
      </View>

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
