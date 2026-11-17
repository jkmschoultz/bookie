import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { registerSpine, useBookFlight, type SpineRect } from '@/library/bookFlight';
import { hashUnit } from '@/shelf/hash';
import { STACK_JITTER, type StackItem } from '@/shelf/layout';
import { UNOWNED_OPACITY, type SpineStyle } from '@/shelf/spineStyle';
import { LINE_HEIGHT } from '@/shelf/spineText';
import type { Book } from '@/types';

interface Props {
  item: StackItem;
  onOpen: (book: Book, from?: SpineRect) => void;
  onLongPress: (book: Book) => void;
}

const SHADING = ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.35)'] as const;

/** Books lying flat, largest at the bottom, slightly out of line like a real pile. */
function BookStackComponent({ item, onOpen, onLongPress }: Props) {
  // Render top-down; item.books is ordered bottom-first.
  const books = [...item.books].reverse();
  return (
    <View style={{ width: item.width, height: item.height, justifyContent: 'flex-end' }}>
      {books.map(({ book, style }) => (
        <LyingBook key={book.id} book={book} style={style} onOpen={onOpen} onLongPress={onLongPress} />
      ))}
    </View>
  );
}

/** One book in the pile. Like an upright spine, it leaves the pile for its page and comes back to it (see BookFlight). */
function LyingBook({ book, style: s, onOpen, onLongPress }: { book: Book; style: SpineStyle } & Pick<Props, 'onOpen' | 'onLongPress'>) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const offset = (hashUnit(String(book.id), 'offset') - 0.5) * STACK_JITTER;
  // While this book is flying to or from its page it isn't in the pile.
  const away = useBookFlight((f) => f.flight?.book.id === book.id);
  // Let a book coming back from its page find where to land.
  useEffect(() => registerSpine(book.id, () => measure(ref.current, s)), [book.id, s]);

  return (
    <Pressable
      onPress={() => measure(ref.current, s).then((from) => onOpen(book, from ?? undefined))}
      onLongPress={() => onLongPress(book)}
      accessibilityRole="button"
      accessibilityLabel={`${book.title} by ${book.authors.join(', ')}`}
      style={{ width: s.height, height: s.width, marginLeft: STACK_JITTER / 2 + offset, opacity: away ? 0 : book.owned ? 1 : UNOWNED_OPACITY }}>
      <View ref={ref} style={[styles.book, { backgroundColor: s.color }]}>
        <LinearGradient colors={SHADING} style={StyleSheet.absoluteFill} />
        {/* Same fitted lines as the upright spine: a book on its side has the same spine. */}
        {s.width >= 12 && (
          <Text
            numberOfLines={s.text.numberOfLines}
            style={{
              color: s.textColor,
              fontFamily: s.font === 'serif' ? Fonts.serif : Fonts.sans,
              fontSize: s.text.fontSize,
              lineHeight: s.text.fontSize * LINE_HEIGHT,
              textAlign: 'center',
              letterSpacing: s.uppercase ? 0.8 : 0.2,
              paddingHorizontal: 8,
            }}>
            {s.text.lines.join('\n')}
          </Text>
        )}
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
  book: {
    flex: 1,
    borderRadius: 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.4)',
  },
});
