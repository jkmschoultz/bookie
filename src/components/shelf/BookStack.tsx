import { memo, useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LYING_TILT, registerSpine, standUp, useBookFlight, type SpineRect } from '@/library/bookFlight';
import { hashUnit } from '@/shelf/hash';
import { STACK_JITTER, type StackItem } from '@/shelf/layout';
import { spineCues } from '@/shelf/spineCues';
import type { SpineStyle } from '@/shelf/spineStyle';
import type { Book } from '@/types';

import { SpineFace } from './Spine';

interface Props {
  item: StackItem;
  onOpen: (book: Book, from?: SpineRect) => void;
  onLongPress: (book: Book) => void;
}

/** Books lying flat, largest at the bottom, slightly out of line like a real pile. */
function BookStackComponent({ item, onOpen, onLongPress }: Props) {
  // Render top-down; item.books is ordered bottom-first.
  const books = [...item.books].reverse();
  return (
    <View style={{ width: item.width, height: item.height, paddingLeft: item.markerRoom, justifyContent: 'flex-end' }}>
      {books.map(({ book, style }) => (
        <LyingBook key={book.id} book={book} style={style} onOpen={onOpen} onLongPress={onLongPress} />
      ))}
    </View>
  );
}

/**
 * One book in the pile: its upright spine (`SpineFace`) on its side, so it looks just like the book flying to its page.
 * Like an upright spine, it leaves the pile for its page and comes back to it (see BookFlight).
 */
function LyingBook({ book, style: s, onOpen, onLongPress }: { book: Book; style: SpineStyle } & Pick<Props, 'onOpen' | 'onLongPress'>) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const offset = (hashUnit(String(book.id), 'offset') - 0.5) * STACK_JITTER;
  // While this book is flying to or from its page it isn't in the pile.
  const away = useBookFlight((f) => f.flight?.book.id === book.id);
  // Let a book coming back from its page find where to land.
  useEffect(() => registerSpine(book.id, () => measure(ref.current, s)), [book.id, s]);

  // The upright spine, tipped over about its middle, exactly as the flight starts out (see `standUp` and `lyingTilt`).
  const upright = standUp({ x: 0, y: 0, width: s.height, height: s.width });

  return (
    <Pressable
      onPress={() => measure(ref.current, s).then((from) => onOpen(book, from ?? undefined))}
      onLongPress={() => onLongPress(book)}
      accessibilityRole="button"
      accessibilityLabel={`${book.title} by ${book.authors.join(', ')}`}
      style={{ width: s.height, height: s.width, marginLeft: STACK_JITTER / 2 + offset, opacity: away ? 0 : spineCues(book).opacity }}>
      <View ref={ref} style={StyleSheet.absoluteFill}>
        <View style={[styles.upright, { left: upright.x, top: upright.y, width: upright.width, height: upright.height }]}>
          <SpineFace book={book} style={s} />
        </View>
      </View>
    </Pressable>
  );
}

/** Where a lying book is on screen, for its flight to start from or land on. */
function measure(view: ComponentRef<typeof View> | null, style: SpineStyle): Promise<SpineRect | null> {
  return new Promise((resolve) => {
    if (!view) resolve(null);
    else view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height, style, lying: true }));
  });
}

export const BookStack = memo(BookStackComponent);

const styles = StyleSheet.create({
  upright: { position: 'absolute', transform: [{ rotate: `${LYING_TILT}deg` }] },
});
