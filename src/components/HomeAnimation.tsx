import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Spine } from '@/components/shelf/Spine';
import { exampleBook } from '@/components/TourShelf';
import { Shelf, Wood } from '@/constants/theme';
import { getSpineStyle } from '@/shelf/spineStyle';
import type { Book } from '@/types';

const SCALE = 0.5;
const BOOKS_HEIGHT = 110;
const SHELF_HEIGHT = BOOKS_HEIGHT + Shelf.plankTop + Shelf.plankFront;
const FRAME_HEIGHT = Math.round(SHELF_HEIGHT * 1.75);
const LOOP_MS = 9000;
/** How far the top shelf slides sideways, and how far the bookcase slides up. */
const SIDEWAYS = 150;
const UP = SHELF_HEIGHT;

const PALETTES = [
  ['#2f6b5e', '#e8c875'],
  ['#b3202a', '#e9dcc0'],
  ['#2b3a67', '#d9a441'],
  ['#6b2f3a', '#d9c7a0'],
  ['#c9792b', '#2b2a33'],
  ['#3d5a3a', '#e3d9b8'],
  ['#4a3b6b', '#c9b6e4'],
  ['#8a6a3c', '#2b2013'],
];
const TITLES = ['Dune', 'Emma', 'Hyperion', 'The Hobbit', 'Neuromancer', 'Persuasion', 'Kim', 'Ulysses', 'Beloved', 'Middlemarch'];

function shelfBooks(shelf: number): Book[] {
  return Array.from({ length: 22 }, (_, i) => {
    const n = shelf * 22 + i;
    return exampleBook({
      id: -100 - n,
      title: TITLES[(n * 3) % TITLES.length],
      author: 'Author',
      palette: PALETTES[(n * 5 + shelf) % PALETTES.length],
      pageCount: 140 + ((n * 97) % 520),
      heightMm: 170 + ((n * 13) % 80),
    });
  });
}

const SHELVES = [0, 1, 2, 3].map(shelfBooks);
const noop = () => {};

const ease = Easing.inOut(Easing.quad);
/** 0 before `from`, 1 after `to`, eased in between. */
function step(t: number, from: number, to: number) {
  'worklet';
  return ease(Math.min(1, Math.max(0, (t - from) / (to - from))));
}

/** Only the books slide along a shelf; the plank stays put. */
function ShelfRow({ books, slide }: { books: Book[]; slide?: object }) {
  return (
    <View style={{ height: SHELF_HEIGHT }}>
      <Animated.View style={[styles.books, slide]}>
        {books.map((book) => (
          <Spine key={book.id} book={book} style={getSpineStyle(book, SCALE)} onOpen={noop} onLongPress={noop} />
        ))}
      </Animated.View>
      <LinearGradient colors={Wood.plankTop} style={{ height: Shelf.plankTop }} />
      <LinearGradient colors={Wood.plankFront} style={{ height: Shelf.plankFront }} />
    </View>
  );
}

/**
 * A looping picture of the bookshelf for the welcome tour: a shelf slides sideways, then the whole bookcase slides up,
 * with a fingertip showing the swipes. One shared clock drives everything, so it all stays in step.
 */
export function HomeAnimation() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [t]);

  // Swipe left along the top shelf and let go, then swipe up the bookcase and let go.
  const caseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -UP * (step(t.value, 0.52, 0.72) - step(t.value, 0.86, 0.96)) }],
  }));
  const topShelf = useAnimatedStyle(() => ({
    transform: [{ translateX: -SIDEWAYS * (step(t.value, 0.08, 0.3) - step(t.value, 0.42, 0.5)) }],
  }));
  const finger = useAnimatedStyle(() => {
    const v = t.value;
    const sideways = v < 0.45;
    const x = sideways ? 250 - 150 * step(v, 0.08, 0.3) : 160;
    const y = sideways ? 50 : 150 - 90 * step(v, 0.52, 0.72);
    const shown = (v > 0.06 && v < 0.33) || (v > 0.5 && v < 0.75);
    return { opacity: withTiming(shown ? 1 : 0, { duration: 160 }), transform: [{ translateX: x }, { translateY: y }] };
  });

  return (
    <View style={styles.frame} pointerEvents="none" accessible accessibilityLabel="Animation: swiping sideways along a shelf, then up the bookcase">
      <LinearGradient colors={Wood.backPanel} style={StyleSheet.absoluteFill} />
      <Animated.View style={caseStyle}>
        {SHELVES.map((books, i) => (
          <ShelfRow key={i} books={books} slide={i === 0 ? topShelf : undefined} />
        ))}
      </Animated.View>
      <Animated.View style={[styles.finger, finger]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center', width: '100%', maxWidth: 320, height: FRAME_HEIGHT, borderRadius: 10, overflow: 'hidden', marginTop: 4 },
  books: { height: BOOKS_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', paddingLeft: Shelf.gutter },
  finger: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -17,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
});
