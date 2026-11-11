import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Spine } from '@/components/shelf/Spine';
import { Shelf, Wood } from '@/constants/theme';
import { getSpineStyle } from '@/shelf/spineStyle';
import { emptyDraft, type Book } from '@/types';

function example(id: number, title: string, author: string, owned: boolean, palette: string[]): Book {
  return {
    ...emptyDraft(),
    id,
    title,
    authors: [author],
    pageCount: 420,
    heightMm: 205,
    coverPalette: palette,
    status: 'read',
    rating: null,
    owned,
    dateAdded: '2024-01-01',
    dateStarted: null,
    dateFinished: null,
    notes: null,
  };
}

const OWNED = example(-1, 'The Hobbit', 'Tolkien', true, ['#2f6b5e', '#e8c875']);
const NOT_OWNED = example(-2, 'Dune', 'Herbert', false, ['#b3202a', '#e9dcc0']);

const noop = () => {};

function Slot({ book, caption }: { book: Book; caption: string }) {
  return (
    <View style={styles.slot}>
      <View style={styles.books}>
        {/* The real spine, so the example always matches how the app draws a book. */}
        <Spine book={book} style={getSpineStyle(book)} onOpen={noop} onLongPress={noop} />
      </View>
      <LinearGradient colors={Wood.plankTop} style={{ height: Shelf.plankTop }} />
      <LinearGradient colors={Wood.plankFront} style={styles.plankFront}>
        <LinearGradient colors={Wood.brass} style={styles.plate}>
          <Text style={styles.plateText}>{caption}</Text>
        </LinearGradient>
      </LinearGradient>
    </View>
  );
}

/** Two books on a little shelf: one you own, and one you don't, which is drawn faded. Used in the welcome tour. */
export function OwnershipExample() {
  return (
    <View
      style={styles.shelf}
      pointerEvents="none"
      accessible
      accessibilityLabel="Example shelf: a book on your shelf looks solid, and a book you don't own is faded">
      <LinearGradient colors={Wood.backPanel} style={StyleSheet.absoluteFill} />
      <Slot book={OWNED} caption="On my shelf" />
      <Slot book={NOT_OWNED} caption="Not owned" />
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: { flexDirection: 'row', alignSelf: 'center', width: '100%', maxWidth: 320, borderRadius: 10, overflow: 'hidden', marginTop: 4 },
  slot: { flex: 1 },
  books: { height: 196, alignItems: 'center', justifyContent: 'flex-end' },
  plankFront: { height: Shelf.plankFront + 6, alignItems: 'center', justifyContent: 'center' },
  plate: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 2 },
  plateText: { color: Wood.brassText, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
});
