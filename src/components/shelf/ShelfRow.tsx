import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback } from 'react';
import { FlatList, StyleSheet, Text, View, type ListRenderItem } from 'react-native';

import { Shelf, Wood } from '@/constants/theme';
import type { ShelfItem, ShelfRow as Row } from '@/shelf/layout';
import type { Book } from '@/types';

import { BookStack } from './BookStack';
import { Spine } from './Spine';

interface Props {
  row: Row;
  scrollable: boolean;
  onOpen: (book: Book) => void;
  onLongPress: (book: Book) => void;
}

const CONTENT_INSET = Shelf.gutter + Shelf.sidePanel;

export const SHELF_ROW_HEIGHT = Shelf.innerHeight + Shelf.plankTop + Shelf.plankFront;

function ShelfRowComponent({ row, scrollable, onOpen, onLongPress }: Props) {
  const renderItem = useCallback<ListRenderItem<ShelfItem>>(
    ({ item }) =>
      item.kind === 'spine' ? (
        <Spine book={item.book} style={item.style} onOpen={onOpen} onLongPress={onLongPress} />
      ) : item.kind === 'stack' ? (
        <BookStack item={item} onOpen={onOpen} onLongPress={onLongPress} />
      ) : (
        <Bookend width={item.width} />
      ),
    [onOpen, onLongPress],
  );

  return (
    <View style={{ height: SHELF_ROW_HEIGHT }}>
      {/* Back panel of the bookcase, darker under the shelf above. */}
      <LinearGradient colors={Wood.backPanel} style={styles.back} />
      <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']} style={styles.topShadow} />

      <FlatList
        horizontal
        data={row.items}
        keyExtractor={(it) => it.key}
        renderItem={renderItem}
        scrollEnabled={scrollable}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        initialNumToRender={24}
        windowSize={5}
        style={styles.books}
        contentContainerStyle={styles.booksContent}
        ItemSeparatorComponent={Gap}
      />

      <View style={styles.plank}>
        <LinearGradient colors={Wood.plankTop} style={{ height: Shelf.plankTop }} />
        <LinearGradient colors={Wood.plankFront} style={styles.plankFront}>
          {row.labels.map((l, i) => {
            const next = row.labels[i + 1]?.x ?? Infinity;
            return (
              <View key={l.groupKey} style={[styles.plateSlot, { left: CONTENT_INSET + l.x, maxWidth: Math.min(next - l.x - 6, 260) }]}>
                <LinearGradient colors={Wood.brass} style={styles.plate}>
                  <Text numberOfLines={1} style={styles.plateText}>
                    {l.label}
                    <Text style={styles.plateCount}>  {l.count}</Text>
                  </Text>
                </LinearGradient>
              </View>
            );
          })}
        </LinearGradient>
      </View>
    </View>
  );
}

/** A metal bookend: an upright plate on a foot. */
function Bookend({ width }: { width: number }) {
  return (
    <View style={{ width, height: 118, justifyContent: 'flex-end', alignItems: 'center' }}>
      <LinearGradient colors={['#5b5e63', '#9aa0a6', '#4a4d52']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bookendPlate} />
      <View style={styles.bookendFoot} />
    </View>
  );
}

function Gap() {
  return <View style={{ width: Shelf.gap }} />;
}

export const ShelfRow = memo(ShelfRowComponent);

const styles = StyleSheet.create({
  back: { ...StyleSheet.absoluteFill, bottom: Shelf.plankTop + Shelf.plankFront },
  topShadow: { position: 'absolute', top: 0, left: 0, right: 0, height: 26 },
  books: { height: Shelf.innerHeight, flexGrow: 0 },
  booksContent: {
    alignItems: 'flex-end',
    paddingHorizontal: CONTENT_INSET,
    paddingTop: 16,
  },
  plank: {
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  plankFront: { height: Shelf.plankFront },
  plateSlot: { position: 'absolute', top: 3 },
  plate: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 2,
  },
  bookendPlate: { flex: 1, width: 5, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  bookendFoot: { width: '100%', height: 3, backgroundColor: '#6f7378', borderRadius: 1 },
  plateText: {
    color: Wood.brassText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  plateCount: { fontWeight: '400', opacity: 0.75 },
});
