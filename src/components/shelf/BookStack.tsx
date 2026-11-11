import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { hashUnit } from '@/shelf/hash';
import { STACK_JITTER, type StackItem } from '@/shelf/layout';
import { UNOWNED_OPACITY } from '@/shelf/spineStyle';
import { LINE_HEIGHT } from '@/shelf/spineText';
import type { Book } from '@/types';

interface Props {
  item: StackItem;
  onOpen: (book: Book) => void;
  onLongPress: (book: Book) => void;
}

const SHADING = ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.35)'] as const;

/** Books lying flat, largest at the bottom, slightly out of line like a real pile. */
function BookStackComponent({ item, onOpen, onLongPress }: Props) {
  // Render top-down; item.books is ordered bottom-first.
  const books = [...item.books].reverse();
  return (
    <View style={{ width: item.width, height: item.height, justifyContent: 'flex-end' }}>
      {books.map(({ book, style: s }) => {
        const offset = (hashUnit(String(book.id), 'offset') - 0.5) * STACK_JITTER;
        return (
          <Pressable
            key={book.id}
            onPress={() => onOpen(book)}
            onLongPress={() => onLongPress(book)}
            accessibilityRole="button"
            accessibilityLabel={`${book.title} by ${book.authors.join(', ')}`}
            style={{ width: s.height, height: s.width, marginLeft: STACK_JITTER / 2 + offset, opacity: book.owned ? 1 : UNOWNED_OPACITY }}>
            <View style={[styles.book, { backgroundColor: s.color }]}>
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
      })}
    </View>
  );
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
