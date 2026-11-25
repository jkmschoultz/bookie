import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Spine } from '@/components/shelf/Spine';
import { Colors, Shelf, Wood } from '@/constants/theme';
import { getSpineStyle } from '@/shelf/spineStyle';
import { emptyDraft, type Book, type ReadStatus } from '@/types';

interface ExampleBook {
  id: number;
  title: string;
  author: string;
  palette: string[];
  pageCount?: number;
  heightMm?: number;
  status?: ReadStatus;
  owned?: boolean;
}

/** A made-up book for the welcome tour's pictures. */
export function exampleBook({ id, title, author, palette, pageCount = 420, heightMm = 205, status = 'read', owned = true }: ExampleBook): Book {
  return {
    ...emptyDraft(),
    id,
    title,
    authors: [author],
    pageCount,
    heightMm,
    coverPalette: palette,
    status,
    rating: null,
    owned,
    dateAdded: '2024-01-01',
    dateStarted: null,
    dateFinished: null,
    statusChangedAt: null,
    notes: null,
  };
}

const noop = () => {};

export interface TourSlot {
  books?: Book[];
  /** Anything else standing on the shelf after the books, such as records. */
  extras?: ReactNode;
  /** Printed on the brass plate under the books. */
  caption: string;
  /** A word or two under the shelf about what to look for. */
  note?: string;
}

/**
 * A little shelf for the welcome tour, drawn with the real spines so it always matches how the app draws a book.
 * `scale` draws the books smaller than life, to fit several shelves on one page.
 */
export function TourShelf({ slots, label, height = 196, scale = 1 }: { slots: TourSlot[]; label: string; height?: number; scale?: number }) {
  return (
    <View style={styles.shelf} pointerEvents="none" accessible accessibilityLabel={label}>
      <LinearGradient colors={Wood.backPanel} style={StyleSheet.absoluteFill} />
      {slots.map((slot) => (
        <View key={`${slot.caption}|${slot.note}`} style={styles.slot}>
          <View style={[styles.books, { height }]}>
            {slot.books?.map((book) => (
              <Spine key={book.id} book={book} style={getSpineStyle(book, scale)} onOpen={noop} onLongPress={noop} />
            ))}
            {slot.extras}
          </View>
          <LinearGradient colors={Wood.plankTop} style={{ height: Shelf.plankTop }} />
          <LinearGradient colors={Wood.plankFront} style={styles.plankFront}>
            <LinearGradient colors={Wood.brass} style={styles.plate}>
              <Text style={styles.plateText}>{slot.caption}</Text>
            </LinearGradient>
          </LinearGradient>
          {slot.note && <Text style={styles.note}>{slot.note}</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: { flexDirection: 'row', alignSelf: 'center', width: '100%', maxWidth: 320, borderRadius: 10, overflow: 'hidden', marginTop: 4 },
  slot: { flex: 1 },
  books: { alignItems: 'flex-end', justifyContent: 'center', flexDirection: 'row' },
  plankFront: { height: Shelf.plankFront + 6, alignItems: 'center', justifyContent: 'center' },
  plate: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 2 },
  note: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', paddingVertical: 5, paddingHorizontal: 2 },
  plateText: { color: Wood.brassText, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
});
