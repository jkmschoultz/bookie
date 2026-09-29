import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { getSpineStyle } from '@/shelf/spineStyle';
import type { Book } from '@/types';

interface Props {
  book: Book;
  width: number;
}

/** The book's cover image, or a generated cloth cover in the spine's colours. */
export function Cover({ book, width }: Props) {
  const [failed, setFailed] = useState(false);
  const height = width * 1.5;
  const s = getSpineStyle(book);

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
  return (
    <View style={[styles.cover, styles.generated, { width, height, backgroundColor: s.color }]}>
      <View style={[styles.rule, { backgroundColor: s.accentColor }]} />
      <Text style={[styles.title, { color: s.textColor, fontFamily: Fonts.serif, fontSize: width / 9 }]} numberOfLines={4}>
        {book.title}
      </Text>
      <Text style={[styles.author, { color: s.textColor, fontSize: width / 15 }]} numberOfLines={2}>
        {book.authors.join(', ')}
      </Text>
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
