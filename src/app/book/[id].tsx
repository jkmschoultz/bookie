import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { alert } from '@/components/alert';
import { BookPageCover, BookTitle, Section } from '@/components/BookPage';
import { Chip } from '@/components/Chip';
import { DateInput } from '@/components/DateInput';
import { StarRating } from '@/components/StarRating';
import { Colors } from '@/constants/theme';
import { useLibrary } from '@/library/LibraryProvider';
import { checkReadingDates } from '@/library/fields';
import { useChangeStatus } from '@/library/useChangeStatus';
import { STATUS_LABELS, today, type Book, type ReadStatus } from '@/types';

const STATUSES: ReadStatus[] = ['reading', 'read', 'owned', 'want', 'dnf'];

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
  const { updateBook, removeBook } = useLibrary();
  const changeStatus = useChangeStatus();
  const scrollY = useRef(0);

  const remove = () =>
    alert('Remove book?', `“${book.title}” will be taken off your shelves.`, [
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
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        alwaysBounceVertical
        onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={32}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <BookPageCover book={book} scrollY={scrollY} />
        <BookTitle book={book} />

        <Section title="Status">
          <View style={styles.wrap}>
            {STATUSES.map((s) => (
              <Chip key={s} label={STATUS_LABELS[s]} selected={book.status === s} onPress={() => changeStatus(book, s)} />
            ))}
          </View>
        </Section>

        <Section title="Ownership">
          <View style={styles.wrap}>
            <Chip label="On my shelf" selected={book.owned} onPress={() => updateBook(book.id, { owned: true })} />
            <Chip label="Not owned" selected={!book.owned} onPress={() => updateBook(book.id, { owned: false })} />
          </View>
        </Section>

        <Section title="Your rating">
          <StarRating value={book.rating} onChange={(rating) => updateBook(book.id, { rating })} />
        </Section>

        <Section title="Dates">
          <ReadingDates
            key={`${book.dateStarted}|${book.dateFinished}`}
            started={book.dateStarted}
            finished={book.dateFinished}
            onSave={(patch) => updateBook(book.id, patch)}
          />
          <Text style={styles.hint}>Added {book.dateAdded}</Text>
        </Section>

        <Section title="Notes">
          <NotesField value={book.notes} onSave={(notes) => updateBook(book.id, { notes })} />
        </Section>

        <Pressable onPress={remove} style={styles.remove}>
          <Text style={styles.removeText}>Remove from library</Text>
        </Pressable>
        {book.isbn13 && <Text style={styles.hint}>ISBN {book.isbn13}</Text>}
      </ScrollView>
    </>
  );
}

/** Started and finished, each a real date or empty, not in the future, and finished no earlier than started. */
function ReadingDates({
  started,
  finished,
  onSave,
}: {
  started: string | null;
  finished: string | null;
  onSave: (patch: { dateStarted?: string | null; dateFinished?: string | null }) => void;
}) {
  const [text, setText] = useState({ started: started ?? '', finished: finished ?? '' });
  const now = today();
  const errors = checkReadingDates(text.started, text.finished, now);

  const commit = (next: typeof text) => {
    const problems = checkReadingDates(next.started, next.finished, now);
    if (problems.started || problems.finished) return;
    const patch: { dateStarted?: string | null; dateFinished?: string | null } = {};
    if ((next.started || null) !== started) patch.dateStarted = next.started || null;
    if ((next.finished || null) !== finished) patch.dateFinished = next.finished || null;
    if (Object.keys(patch).length) onSave(patch);
  };

  const field = (key: 'started' | 'finished', label: string) => (
    <View style={{ flex: 1, gap: 4 }}>
      <View style={styles.dateLabel}>
        <Text style={styles.hint}>{label}</Text>
        {text[key] !== '' && (
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label.toLowerCase()} date`}
            onPress={() => {
              const next = { ...text, [key]: '' };
              setText(next);
              commit(next);
            }}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        )}
      </View>
      <DateInput
        value={text[key]}
        max={now}
        invalid={!!errors[key]}
        accessibilityLabel={`${label} date`}
        onChange={(v) => setText((t) => ({ ...t, [key]: v }))}
        onCommit={(v) => commit({ ...text, [key]: v })}
      />
      {errors[key] && <Text style={styles.error}>{errors[key]}</Text>}
    </View>
  );

  return (
    <View style={styles.dates}>
      {field('started', 'Started')}
      {field('finished', 'Finished')}
    </View>
  );
}

function NotesField({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [text, setText] = useState(value ?? '');
  const save = () => text !== (value ?? '') && onSave(text.trim() || null);
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onBlur={save}
      onEndEditing={save}
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
  muted: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dates: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dateLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clear: { color: Colors.accent, fontSize: 12, fontWeight: '600' },
  error: { color: Colors.danger, fontSize: 12 },
  input: {
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  hint: { color: Colors.textMuted, fontSize: 12 },
  headerAction: { color: Colors.accent, fontSize: 16, fontWeight: '600' },
  remove: { alignItems: 'center', paddingVertical: 12 },
  removeText: { color: Colors.danger, fontWeight: '600' },
});
