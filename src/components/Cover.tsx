import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { Fonts } from '@/constants/theme';
import { getSpineStyle } from '@/shelf/spineStyle';
import type { Book } from '@/types';

interface Props {
  book: Book;
  width: number;
}

/** Covers are 2:3, like most paperbacks. */
export const COVER_ASPECT = 1.5;

/** The book's cover image, or a generated cloth cover in the spine's colours. */
export function Cover({ book, width }: Props) {
  const [failed, setFailed] = useState(false);
  const height = width * COVER_ASPECT;

  if (book.coverUrl && !failed) {
    return (
      <Image
        source={book.coverUrl}
        style={[styles.cover, { width, height }]}
        contentFit="cover"
        transition={200}
        onError={() => setFailed(true)}
        // Open Library returns a 1x1 GIF for unknown covers.
        onLoad={(e) => e.source.width < 10 && setFailed(true)}
      />
    );
  }
  const text = plainCoverText(book, width);
  return (
    <PlainCover
      book={book}
      width={width}
      title={
        <Text style={text.title} numberOfLines={4}>
          {book.title}
        </Text>
      }
      author={
        <Text style={text.author} numberOfLines={2}>
          {book.authors.join(', ')}
        </Text>
      }
    />
  );
}

/** Title and author type for a plain cover of this width, in the book's colours. */
export function plainCoverText(book: Book, width: number): { title: TextStyle; author: TextStyle } {
  const s = getSpineStyle(book);
  return {
    title: { ...styles.title, color: s.textColor, fontFamily: Fonts.serif, fontSize: width / 9 },
    author: { ...styles.author, color: s.textColor, fontSize: width / 15 },
  };
}

/** A cloth cover in the spine's colours, with whatever title and author nodes it's given between two rules. */
export function PlainCover({ book, width, title, author }: { book: Book; width: number; title: ReactNode; author: ReactNode }) {
  const s = getSpineStyle(book);
  return (
    <View style={[styles.cover, styles.generated, { width, height: width * COVER_ASPECT, backgroundColor: s.color }]}>
      <View style={[styles.rule, { backgroundColor: s.accentColor }]} />
      {title}
      {author}
      <View style={[styles.rule, { backgroundColor: s.accentColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    borderRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  generated: { alignItems: 'center', justifyContent: 'center', padding: 14, gap: 12 },
  rule: { height: 2, width: '60%' },
  title: { textAlign: 'center', fontWeight: '700' },
  author: { textAlign: 'center', fontStyle: 'italic', opacity: 0.9 },
});
