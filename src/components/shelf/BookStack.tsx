import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { hashUnit } from '@/shelf/hash';
import { STACK_JITTER, type StackItem } from '@/shelf/layout';
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
            style={{ width: s.height, height: s.width, marginLeft: STACK_JITTER / 2 + offset }}>
            <View style={[styles.book, { backgroundColor: s.color }]}>
              <LinearGradient colors={SHADING} style={StyleSheet.absoluteFill} />
              {s.width >= 12 && (
                <Text
                  numberOfLines={1}
                  style={{
                    color: s.textColor,
                    fontFamily: s.font === 'serif' ? Fonts.serif : Fonts.sans,
                    fontSize: Math.max(7, Math.min(12, s.width * 0.42)),
                    paddingHorizontal: 8,
                  }}>
                  {s.uppercase ? book.title.toUpperCase() : book.title}
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
