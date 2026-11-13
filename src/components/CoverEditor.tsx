import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FlipInEasyY } from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import type { Book } from '@/types';

import { Cover, PlainCover, plainCoverText } from './Cover';

interface Props {
  /** For the cover's colours and photo; title and author come from the props below while editing. */
  book: Book;
  width: number;
  title: string;
  /** Comma separated. */
  authors: string;
  onChangeTitle: (title: string) => void;
  onChangeAuthors: (authors: string) => void;
  /** When an edit is finished: a field loses focus, or Done is tapped. */
  onCommit?: () => void;
}

/**
 * The cover, with the title and author typed straight onto it. A plain cover is always editable. A photo cover shows
 * the photo until it's tapped, then turns into a plain cover with fields until Done.
 */
export function CoverEditor({ book, width, title, authors, onChangeTitle, onChangeAuthors, onCommit }: Props) {
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [titleHeight, setTitleHeight] = useState<number | undefined>(undefined);
  const hasPhoto = !!book.coverUrl;

  if (hasPhoto && !editingPhoto) {
    return (
      <View style={styles.wrap}>
        <Pressable
          onPress={() => setEditingPhoto(true)}
          accessibilityRole="button"
          accessibilityLabel="Edit title and author"
          accessibilityHint="Shows the title and author fields on the cover">
          <Animated.View key="photo" entering={FadeIn.duration(180)}>
            <Cover book={{ ...book, title, authors: splitAuthors(authors) }} width={width} />
          </Animated.View>
        </Pressable>
        <Text style={styles.caption}>Tap the cover to edit the title and author</Text>
      </View>
    );
  }

  const text = plainCoverText(book, width);
  const line = { borderBottomColor: text.title.color as string };
  const done = () => {
    onCommit?.();
    setEditingPhoto(false);
  };

  return (
    <View style={styles.wrap}>
      <Animated.View key="plain" entering={hasPhoto ? FlipInEasyY.duration(320) : undefined}>
        <PlainCover
          book={book}
          width={width}
          title={
            <TextInput
              value={title}
              // A title is one line of text, even if it wraps; Return finishes it.
              onChangeText={(t) => onChangeTitle(t.replace(/\n/g, ' '))}
              onContentSizeChange={(e) => setTitleHeight(e.nativeEvent.contentSize.height)}
              onBlur={onCommit}
              submitBehavior="blurAndSubmit"
              multiline
              placeholder="Title"
              placeholderTextColor={withAlpha(text.title.color as string)}
              accessibilityLabel="Title"
              autoFocus={editingPhoto}
              style={[text.title, styles.field, line, titleHeight != null && { height: Math.min(titleHeight, width * 0.7) }]}
            />
          }
          author={
            <TextInput
              value={authors}
              onChangeText={onChangeAuthors}
              onBlur={onCommit}
              onSubmitEditing={hasPhoto ? done : undefined}
              placeholder="Author"
              placeholderTextColor={withAlpha(text.author.color as string)}
              accessibilityLabel="Authors, comma separated"
              returnKeyType="done"
              style={[text.author, styles.field, line]}
            />
          }
        />
      </Animated.View>
      {hasPhoto ? (
        <Pressable onPress={done} hitSlop={8} accessibilityRole="button">
          <Text style={styles.done}>Done · show the photo</Text>
        </Pressable>
      ) : (
        <Text style={styles.caption}>Type the title and author on the cover</Text>
      )}
    </View>
  );
}

export function splitAuthors(text: string): string[] {
  return text
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
}

/** The cover's text colour, faded, for placeholders. */
function withAlpha(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}80` : color;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10 },
  field: {
    alignSelf: 'stretch',
    padding: 0,
    paddingBottom: 2,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderStyle: 'dashed',
  },
  caption: { color: Colors.textMuted, fontSize: 12 },
  done: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
});
