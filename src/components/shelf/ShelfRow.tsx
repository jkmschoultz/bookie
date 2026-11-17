import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback } from 'react';
import { FlatList, Platform, StyleSheet, Text, View, type ListRenderItem } from 'react-native';

import { Wood } from '@/constants/theme';
import { LABEL_MAX_WIDTH, type ShelfItem, type ShelfRow as Row } from '@/shelf/layout';
import { byZoom, shelfMetrics } from '@/shelf/zoom';
import type { SpineRect } from '@/library/bookFlight';
import type { Book } from '@/types';

import { BookStack } from './BookStack';
import { Spine } from './Spine';

interface Props {
  row: Row;
  scrollable: boolean;
  /** How much bigger than normal the bookcase is drawn (see shelfZoom). */
  zoom: number;
  onOpen: (book: Book, from?: SpineRect) => void;
  onLongPress: (book: Book) => void;
}

function ShelfRowComponent({ row, scrollable, zoom, onOpen, onLongPress }: Props) {
  const m = shelfMetrics(zoom);
  const styles = stylesFor(zoom);
  const renderItem = useCallback<ListRenderItem<ShelfItem>>(
    ({ item }) =>
      item.kind === 'spine' ? (
        <Spine book={item.book} style={item.style} onOpen={onOpen} onLongPress={onLongPress} />
      ) : item.kind === 'stack' ? (
        <BookStack item={item} onOpen={onOpen} onLongPress={onLongPress} />
      ) : item.kind === 'space' ? (
        <View style={{ width: item.width }} />
      ) : (
        <Bookend width={item.width} zoom={zoom} />
      ),
    [onOpen, onLongPress, zoom],
  );
  const Gap = useCallback(() => <View style={{ width: m.gap }} />, [m.gap]);

  return (
    <View style={{ height: m.rowHeight }}>
      {/* Back panel of the bookcase, darker under the shelf above. */}
      <LinearGradient colors={Wood.backPanel} style={styles.back} />
      <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']} style={styles.topShadow} />

      <FlatList
        horizontal
        data={row.items}
        keyExtractor={(it) => it.key}
        renderItem={renderItem}
        // On web a disabled ScrollView gets `touch-action: none`, which also blocks swiping the bookcase up and down from
        // this shelf. A shelf that fits has nothing to scroll sideways anyway, so leave it enabled there.
        scrollEnabled={scrollable || Platform.OS === 'web'}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        initialNumToRender={24}
        windowSize={5}
        style={styles.books}
        contentContainerStyle={styles.booksContent}
        ItemSeparatorComponent={Gap}
      />

      <View style={styles.plank}>
        <LinearGradient colors={Wood.plankTop} style={{ height: m.plankTop }} />
        <LinearGradient colors={Wood.plankFront} style={styles.plankFront}>
          {row.labels.map((l, i) => {
            const next = row.labels[i + 1]?.x ?? Infinity;
            return (
              <View
                key={l.groupKey}
                style={[styles.plateSlot, { left: m.gutter + m.sidePanel + l.x, maxWidth: Math.min(next - l.x - 6 * zoom, LABEL_MAX_WIDTH * zoom) }]}>
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
function Bookend({ width, zoom }: { width: number; zoom: number }) {
  const styles = stylesFor(zoom);
  return (
    <View style={{ width, height: 118 * zoom, justifyContent: 'flex-end', alignItems: 'center' }}>
      <LinearGradient colors={['#5b5e63', '#9aa0a6', '#4a4d52']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bookendPlate} />
      <View style={styles.bookendFoot} />
    </View>
  );
}

export const ShelfRow = memo(ShelfRowComponent);

const stylesFor = byZoom((z) => {
  const m = shelfMetrics(z);
  return StyleSheet.create({
    back: { ...StyleSheet.absoluteFill, bottom: m.plankTop + m.plankFront },
    topShadow: { position: 'absolute', top: 0, left: 0, right: 0, height: 26 * z },
    books: { height: m.innerHeight, flexGrow: 0 },
    booksContent: {
      alignItems: 'flex-end',
      paddingHorizontal: m.gutter + m.sidePanel,
      paddingTop: 16 * z,
    },
    plank: {
      shadowColor: '#000',
      shadowOpacity: 0.6,
      shadowRadius: 6 * z,
      shadowOffset: { width: 0, height: 4 * z },
      elevation: 6,
    },
    plankFront: { height: m.plankFront },
    plateSlot: { position: 'absolute', top: 3 * z },
    plate: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8 * z,
      paddingVertical: z,
      borderRadius: 2 * z,
    },
    bookendPlate: { flex: 1, width: 5 * z, borderTopLeftRadius: 2 * z, borderTopRightRadius: 2 * z },
    bookendFoot: { width: '100%', height: 3 * z, backgroundColor: '#6f7378', borderRadius: z },
    plateText: {
      color: Wood.brassText,
      fontSize: 11 * z,
      fontWeight: '700',
      letterSpacing: 0.6 * z,
    },
    plateCount: { fontWeight: '400', opacity: 0.75 },
  });
});
