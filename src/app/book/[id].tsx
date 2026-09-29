import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/Chip';
import { Cover } from '@/components/Cover';
import { StarRating } from '@/components/StarRating';
import { Colors, Fonts } from '@/constants/theme';
import { useLibrary } from '@/library/LibraryProvider';
import { STATUS_LABELS, type Book, type ReadStatus } from '@/types';

const STATUSES: ReadStatus[] = ['reading', 'read', 'owned', 'want', 'dnf'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getBook } = useLibrary();
  const book = getBook(Number(id));

  if (!book) {
    return (
      <View style={styles.missing}>
        <Text style={styles.muted}>This book is no longer on your shelves.</Text>
      </View>
    );
  }
  return <BookDetails book={book} />;
}

function BookDetails({ book }: { book: Book }) {
  const insets = useSafeAreaInsets();
  const { updateBook, setStatus, removeBook } = useLibrary();

  const meta = [
    book.pageCount && `${book.pageCount} pages`,
    book.publishedYear && String(book.publishedYear),
    book.publisher,
  ].filter(Boolean);

  const remove = () =>
    Alert.alert('Remove book?', `“${book.title}” will be taken off your shelves.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          router.back();
          await removeBook(book.id);
        },
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push({ pathname: '/add/manual', params: { id: String(book.id) } })} hitSlop={8}>
              <Text style={styles.headerAction}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.coverWrap}>
          <Cover book={book} width={170} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80)} style={styles.center}>
          <Text style={styles.title}>{book.title}</Text>
          {book.subtitle && <Text style={styles.subtitle}>{book.subtitle}</Text>}
          <Text style={styles.authors}>{book.authors.join(', ') || 'Unknown author'}</Text>
          {book.series && (
            <Text style={styles.muted}>
              {book.series}
              {book.seriesIndex != null && ` · Book ${book.seriesIndex}`}
            </Text>
          )}
          {meta.length > 0 && <Text style={styles.muted}>{meta.join(' · ')}</Text>}
          {book.genres.length > 0 && (
            <View style={styles.genres}>
              {book.genres.map((g) => (
                <Text key={g} style={styles.genre}>
                  {g}
                </Text>
              ))}
            </View>
          )}
        </Animated.View>

        <Section title="Status">
          <View style={styles.wrap}>
            {STATUSES.map((s) => (
              <Chip key={s} label={STATUS_LABELS[s]} selected={book.status === s} onPress={() => setStatus(book.id, s)} />
            ))}
          </View>
        </Section>

        <Section title="Your rating">
          <StarRating value={book.rating} onChange={(rating) => updateBook(book.id, { rating })} />
        </Section>

        <Section title="Dates">
          <View style={styles.dates}>
            <DateField key={`s${book.dateStarted}`} label="Started" value={book.dateStarted} onChange={(dateStarted) => updateBook(book.id, { dateStarted })} />
            <DateField key={`f${book.dateFinished}`} label="Finished" value={book.dateFinished} onChange={(dateFinished) => updateBook(book.id, { dateFinished })} />
          </View>
          <Text style={styles.hint}>Added {book.dateAdded}</Text>
        </Section>

        <Section title="Notes">
          <NotesField value={book.notes} onSave={(notes) => updateBook(book.id, { notes })} />
        </Section>

        <View style={styles.wrap}>
          <Chip label={book.owned ? 'On my shelf' : 'Not owned'} selected={book.owned} onPress={() => updateBook(book.id, { owned: !book.owned })} />
        </View>

        <Pressable onPress={remove} style={styles.remove}>
          <Text style={styles.removeText}>Remove from library</Text>
        </Pressable>
        {book.isbn13 && <Text style={styles.hint}>ISBN {book.isbn13}</Text>}
      </ScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const [text, setText] = useState(value ?? '');
  const invalid = text !== '' && !DATE_RE.test(text);
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={styles.hint}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        onEndEditing={() => !invalid && onChange(text || null)}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={Colors.border}
        keyboardType="numbers-and-punctuation"
        style={[styles.input, invalid && { borderColor: Colors.danger }]}
      />
    </View>
  );
}

function NotesField({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [text, setText] = useState(value ?? '');
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onEndEditing={() => text !== (value ?? '') && onSave(text.trim() || null)}
      placeholder="Thoughts, quotes, where you bought it…"
      placeholderTextColor={Colors.border}
      multiline
      style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 22 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverWrap: { alignItems: 'center', marginTop: 8 },
  center: { alignItems: 'center', gap: 4 },
  title: { color: Colors.text, fontSize: 24, fontWeight: '700', fontFamily: Fonts.serif, textAlign: 'center' },
  subtitle: { color: Colors.textMuted, fontSize: 16, textAlign: 'center' },
  authors: { color: Colors.accent, fontSize: 17, marginTop: 2, textAlign: 'center' },
  muted: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 8 },
  genre: {
    color: Colors.textMuted,
    fontSize: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  section: { gap: 10 },
  sectionTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dates: { flexDirection: 'row', gap: 12 },
  input: {
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  hint: { color: Colors.textMuted, fontSize: 12 },
  headerAction: { color: Colors.accent, fontSize: 16, fontWeight: '600' },
  remove: { alignItems: 'center', paddingVertical: 12 },
  removeText: { color: Colors.danger, fontWeight: '600' },
});
