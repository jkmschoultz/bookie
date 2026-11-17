import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo } from 'react';
import { FlatList, Platform, StyleSheet, View, useWindowDimensions, type ListRenderItem } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Wood } from '@/constants/theme';
import { combineRanges, groupBooks, type ShelfGroup, type SortMode } from '@/shelf/grouping';
import { layoutShelves, type LayoutMode, type ShelfRow as Row } from '@/shelf/layout';
import { spineWidth } from '@/shelf/spineStyle';
import { shelfMetrics, shelfZoom } from '@/shelf/zoom';
import type { SpineRect } from '@/library/bookFlight';
import type { Book } from '@/types';

import { ShelfRow } from './ShelfRow';

interface Props {
  books: Book[];
  sortMode: SortMode;
  layoutMode: LayoutMode;
  onOpen: (book: Book, from?: SpineRect) => void;
  onLongPress: (book: Book) => void;
  bottomInset?: number;
}

/**
 * The whole bookcase: a vertical list of shelves (swipe up/down), each shelf
 * a horizontal list of books (swipe left/right). Side panels frame it all.
 * In a wide window everything in it is drawn bigger (see shelfZoom); the rest of the screen is not.
 */
export function Bookcase({ books, sortMode, layoutMode, onOpen, onLongPress, bottomInset = 0 }: Props) {
  const { width } = useWindowDimensions();
  const zoom = shelfZoom(width);
  const m = shelfMetrics(zoom);
  const shelfWidth = width - 2 * (m.gutter + m.sidePanel);

  const rows = useMemo(() => {
    // Letters and decades are combined into ranges of about a screen of books each ("A–D", "1960s–1980s").
    const widthOf = (g: ShelfGroup) => g.books.reduce((w, b) => w + spineWidth(b.pageCount) * zoom + m.gap, 0);
    const groups = combineRanges(groupBooks(books, sortMode), shelfWidth, widthOf);
    return layoutShelves(groups, { mode: layoutMode, shelfWidth, gap: m.gap, zoom });
  }, [books, sortMode, layoutMode, shelfWidth, zoom, m.gap]);

  const renderRow = useCallback<ListRenderItem<Row>>(
    ({ item }) => <ShelfRow row={item} scrollable={item.width > shelfWidth} zoom={zoom} onOpen={onOpen} onLongPress={onLongPress} />,
    [onOpen, onLongPress, shelfWidth, zoom],
  );

  return (
    <View style={styles.container}>
      {/* Remount on sort change so the new arrangement fades in. */}
      <Animated.View key={`${sortMode}-${layoutMode}`} entering={FadeIn.duration(260)} style={styles.container}>
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderRow}
          getItemLayout={(_, index) => ({ length: m.rowHeight, offset: m.rowHeight * index, index })}
          snapToInterval={m.rowHeight}
          // react-native-web ignores snapToInterval; its pagingEnabled is CSS scroll-snap on each row, which matches it.
          pagingEnabled={Platform.OS === 'web'}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomInset }}
          ListFooterComponent={<LinearGradient colors={Wood.backPanel} style={{ height: 60 * zoom }} />}
          windowSize={7}
        />
      </Animated.View>
      <LinearGradient colors={Wood.side} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.side, { left: 0, width: m.sidePanel }]} pointerEvents="none" />
      <LinearGradient colors={Wood.side} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.side, { right: 0, width: m.sidePanel }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  side: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 8,
  },
});
