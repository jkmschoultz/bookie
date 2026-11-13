import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { alert } from '@/components/alert';
import { Chip } from '@/components/Chip';
import { COVER_ASPECT } from '@/components/Cover';
import { CoverEditor, splitAuthors } from '@/components/CoverEditor';
import { DateInput } from '@/components/DateInput';
import { StarRating } from '@/components/StarRating';
import { Colors, Fonts } from '@/constants/theme';
import { useLibrary } from '@/library/LibraryProvider';
import { useBookFlight, type Rect } from '@/library/bookFlight';
import { checkReadingDates } from '@/library/fields';
import { useChangeStatus } from '@/library/useChangeStatus';
import { STATUS_LABELS, today, type Book, type ReadStatus } from '@/types';

const STATUSES: ReadStatus[] = ['reading', 'read', 'owned', 'want', 'dnf'];
const COVER_WIDTH = 170;

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

  // A book opened from its shelf flies here (see BookFlight): keep this cover hidden until it lands on it.
  const landing = useBookFlight((f) => f.flight?.book.id === book.id);
  const [flewIn] = useState(landing);
  const land = useBookFlight((f) => f.land);
  const coverRef = useRef<ComponentRef<typeof View>>(null);
  // Where the cover was last seen on screen, and the scroll position then, for the flight back to the shelf.
  const coverSeen = useRef<{ rect: Rect; scrollY: number } | null>(null);
  const scrollY = useRef(0);
  const reportCover = () =>
    coverRef.current?.measureInWindow((x, y, width) => {
      const rect = { x: x + (width - COVER_WIDTH) / 2, y, width: COVER_WIDTH, height: COVER_WIDTH * COVER_ASPECT };
      coverSeen.current = { rect, scrollY: scrollY.current };
      land(book.id, rect);
    });
  const reduceMotion = useReducedMotion();
  const latest = useRef(book);
  useEffect(() => {
    latest.current = book;
  }, [book]);
  // Leaving the page sends the book back to its shelf, the way it came. A layout effect, so the flight is already
  // underway when the shelf screen shows (and its own screen transition sees it and stays put).
  useLayoutEffect(() => {
    const openedAt = Date.now();
    return () => {
      const { flight, finish, returnToShelf } = useBookFlight.getState();
      // Leaving before it landed (a quick Back) calls the trip here off first.
      if (flight?.book.id === latest.current.id) finish();
      const seen = coverSeen.current;
      // (Development runs effects twice on mount; that isn't leaving.)
      if (Platform.OS !== 'web' || reduceMotion || !seen || Date.now() - openedAt < 300) return;
      const rect = { ...seen.rect, y: seen.rect.y - (scrollY.current - seen.scrollY) };
      if (rect.y + rect.height > 0) returnToShelf(latest.current, rect);
    };
  }, [reduceMotion]);

  // Title and author are typed on the cover and saved when a field is left. An empty title goes back to the old one.
  const [title, setTitle] = useState(book.title);
  const [authors, setAuthors] = useState(book.authors.join(', '));
  const saveTitleAndAuthors = () => {
    const nextTitle = title.trim();
    const nextAuthors = splitAuthors(authors);
    if (!nextTitle) {
      setTitle(book.title);
      return;
    }
    if (nextTitle !== book.title || nextAuthors.join('|') !== book.authors.join('|')) {
      updateBook(book.id, { title: nextTitle, authors: nextAuthors });
    }
  };

  const meta = [
    book.pageCount && `${book.pageCount} pages`,
    book.publishedYear && String(book.publishedYear),
    book.publisher,
  ].filter(Boolean);

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
        <Animated.View
          ref={coverRef}
          onLayout={reportCover}
          entering={flewIn ? undefined : ZoomIn.springify().damping(16)}
          style={[styles.coverWrap, landing && { opacity: 0 }]}>
          <CoverEditor
            book={book}
            width={COVER_WIDTH}
            title={title}
            authors={authors}
            onChangeTitle={setTitle}
            onChangeAuthors={setAuthors}
            onCommit={saveTitleAndAuthors}
          />
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
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
