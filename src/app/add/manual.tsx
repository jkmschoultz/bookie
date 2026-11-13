import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LayoutAnimationConfig, LinearTransition, ZoomIn } from 'react-native-reanimated';

import { alert } from '@/components/alert';
import { Chip } from '@/components/Chip';
import { CoverChoices } from '@/components/CoverChoices';
import { CoverEditor } from '@/components/CoverEditor';
import { YearPicker } from '@/components/YearPicker';
import { Colors } from '@/constants/theme';
import {
  checkHeight,
  checkIsbn,
  checkPageCount,
  checkSeriesIndex,
  checkYear,
  cleanGenre,
  decimalOnly,
  digitsOnly,
  GENRE_MAX_LENGTH,
  isbnChars,
} from '@/library/fields';
import { useLibrary } from '@/library/LibraryProvider';
import { findCoverOptions } from '@/services/metadata/covers';
import { GENRES, cleanIsbn, isbn10to13 } from '@/services/metadata/normalize';
import { useUi } from '@/store/uiStore';
import { emptyDraft, STATUS_LABELS, today, type Book, type BookDraft, type ReadStatus } from '@/types';

const STATUSES: ReadStatus[] = ['owned', 'reading', 'read', 'want'];
const SPINE_COLORS = [null, '#7a1f1f', '#c4622d', '#d89a3b', '#2f4a3a', '#6b8f5e', '#1f3a5f', '#5b7fa6', '#6a4c93', '#1c1c1c', '#e8e0cf'];

/** Form fields are strings while editing. */
interface Form {
  title: string;
  subtitle: string;
  authors: string;
  series: string;
  seriesIndex: string;
  pageCount: string;
  publishedYear: string;
  publisher: string;
  isbn: string;
  heightMm: string;
  coverUrl: string | null;
  spineColor: string | null;
  genres: string[];
}

function toForm(d: BookDraft): Form {
  const str = (v: unknown) => (v == null ? '' : String(v));
  return {
    title: d.title,
    subtitle: str(d.subtitle),
    authors: d.authors.join(', '),
    series: str(d.series),
    seriesIndex: str(d.seriesIndex),
    pageCount: str(d.pageCount),
    publishedYear: str(d.publishedYear),
    publisher: str(d.publisher),
    isbn: str(d.isbn13 ?? d.isbn10),
    heightMm: str(d.heightMm),
    coverUrl: d.coverUrl,
    spineColor: d.spineColor,
    genres: d.genres,
  };
}

function fromForm(f: Form, base: BookDraft): BookDraft {
  const num = (v: string) => (v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
  const text = (v: string) => v.trim() || null;
  const isbn = cleanIsbn(f.isbn);
  return {
    ...base,
    title: f.title.trim(),
    subtitle: text(f.subtitle),
    authors: f.authors.split(',').map((a) => a.trim()).filter(Boolean),
    series: text(f.series),
    seriesIndex: num(f.seriesIndex),
    pageCount: num(f.pageCount),
    publishedYear: num(f.publishedYear),
    publisher: text(f.publisher),
    isbn13: isbn ? (isbn.length === 10 ? isbn10to13(isbn) : isbn) : null,
    isbn10: isbn?.length === 10 ? isbn : base.isbn10,
    heightMm: num(f.heightMm),
    coverUrl: f.coverUrl,
    spineColor: f.spineColor,
    genres: f.genres,
  };
}

/** Copy a picked photo out of the cache so it survives. On web the picker gives a data: URI, which is stored as is. */
async function persistPhoto(uri: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  const dir = new Directory(Paths.document, 'covers');
  dir.create({ idempotent: true });
  const dest = new File(dir, `${Date.now()}.jpg`);
  await new File(uri).copy(dest);
  return dest.uri;
}

export default function BookFormScreen() {
  // `work` is the Open Library work a search result came from, for finding its other covers.
  const { id, work } = useLocalSearchParams<{ id?: string; work?: string }>();
  const { books, getBook, addBook, updateBook, findByIsbn } = useLibrary();
  const draft = useUi((s) => s.draft);
  const setDraft = useUi((s) => s.setDraft);

  const editing: Book | undefined = id ? getBook(Number(id)) : undefined;
  const base = editing ?? draft ?? emptyDraft();
  const [form, setForm] = useState<Form>(() => toForm(base));
  const [status, setStatus] = useState<ReadStatus>('owned');
  // Whether you own it follows the status ("Want to read" starts as not owned) until you choose either way.
  const [ownedChoice, setOwnedChoice] = useState<boolean | null>(null);
  const owned = ownedChoice ?? status !== 'want';

  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const errors = formErrors(form);

  // The usual genres, any of the reader's own from other books, and any this book already has.
  const genreChoices = [...new Set([...GENRES, ...books.flatMap((b) => b.genres), ...form.genres])].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
  const [newGenre, setNewGenre] = useState<string | null>(null);
  const addGenre = () => {
    const genre = cleanGenre(newGenre ?? '', genreChoices);
    if (genre && !form.genres.includes(genre)) set('genres')([...form.genres, genre]);
    setNewGenre(null);
  };

  const preview: Book = {
    ...fromForm(form, base),
    id: editing?.id ?? -1,
    status,
    rating: null,
    owned,
    dateAdded: today(),
    dateStarted: null,
    dateFinished: null,
    notes: null,
  };

  // Other covers for this book (other editions), to choose from. Looked up once, from what the form started with.
  const [found, setFound] = useState<string[]>([]);
  const [findingCovers, setFindingCovers] = useState(() => !!(work || base.isbn13 || base.isbn10 || base.title));
  const [uploads, setUploads] = useState<string[]>([]);
  useEffect(() => {
    const ctrl = new AbortController();
    const lookup = { workKey: work, isbn: base.isbn13 ?? base.isbn10, title: base.title, author: base.authors[0] };
    if (!lookup.workKey && !lookup.isbn && !lookup.title) return;
    findCoverOptions(lookup, ctrl.signal).then((urls) => {
      if (ctrl.signal.aborted) return;
      setFound(urls);
      setFindingCovers(false);
    });
    return () => ctrl.abort();
    // Only when the screen opens: typing a new title shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const coverOptions = [...new Set([...uploads, ...(base.coverUrl ? [base.coverUrl] : []), ...found])];

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [2, 3], quality: 0.8 });
    if (res.canceled) return;
    const photo = await persistPhoto(res.assets[0].uri);
    setUploads((u) => [photo, ...u]);
    set('coverUrl')(photo);
  };

  const save = async () => {
    const book = fromForm(form, base);
    if (!book.title) {
      alert('A title is needed');
      return;
    }
    const problems = Object.values(errors).filter(Boolean);
    if (problems.length) {
      alert('Check the highlighted fields', problems.join('\n'));
      return;
    }
    if (editing) {
      await updateBook(editing.id, book);
      router.back();
      return;
    }
    const dupe = book.isbn13 ? findByIsbn(book.isbn13) : undefined;
    if (dupe && !(await confirmDuplicate(dupe.title))) return;
    await addBook({
      ...book,
      source: book.source,
      status,
      rating: null,
      owned,
      dateAdded: today(),
      dateStarted: status === 'reading' ? today() : null,
      dateFinished: status === 'read' ? today() : null,
      notes: null,
    });
    setDraft(null);
    router.dismissTo('/');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: editing ? 'Edit book' : 'Add book',
          headerRight: () => (
            <Pressable onPress={save} hitSlop={8}>
              <Text style={styles.headerAction}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" alwaysBounceVertical contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <CoverEditor
          key={form.coverUrl ?? 'plain'}
          book={preview}
          width={150}
          title={form.title}
          authors={form.authors}
          onChangeTitle={set('title')}
          onChangeAuthors={set('authors')}
        />

        <Text style={styles.label}>Cover</Text>
        <CoverChoices
          book={preview}
          selected={form.coverUrl}
          options={coverOptions}
          loading={findingCovers}
          onChoose={set('coverUrl')}
          onUpload={pickPhoto}
        />

        <Field label="Subtitle" value={form.subtitle} onChange={set('subtitle')} />
        <View style={styles.pair}>
          <Field label="Series" value={form.series} onChange={set('series')} flex={3} />
          <Field label="#" value={form.seriesIndex} onChange={set('seriesIndex')} filter={decimalOnly} error={errors.seriesIndex} flex={1} />
        </View>
        <View style={styles.pair}>
          <Field label="Pages" value={form.pageCount} onChange={set('pageCount')} numeric filter={(v) => digitsOnly(v, 5)} error={errors.pageCount} />
          <YearPicker label="Year published" value={form.publishedYear} onChange={set('publishedYear')} error={errors.publishedYear} />
        </View>
        <Field label="Publisher" value={form.publisher} onChange={set('publisher')} />
        <View style={styles.pair}>
          <Field label="ISBN" value={form.isbn} onChange={set('isbn')} filter={isbnChars} error={errors.isbn} flex={2} />
          <Field label="Height (mm)" value={form.heightMm} onChange={set('heightMm')} numeric filter={(v) => digitsOnly(v, 3)} error={errors.heightMm} />
        </View>

        <Text style={styles.label}>Genres</Text>
        {/* Chips zoom in only when added, not all at once when the form opens. */}
        <LayoutAnimationConfig skipEntering>
          <View style={styles.wrap}>
            {genreChoices.map((g) => (
              // A genre you add slides into its place in the alphabet, nudging the others along.
              <Animated.View key={g} entering={ZoomIn.duration(220)} layout={LinearTransition.duration(220)}>
                <Chip
                  small
                  label={g}
                  selected={form.genres.includes(g)}
                  onPress={() => set('genres')(form.genres.includes(g) ? form.genres.filter((x) => x !== g) : [...form.genres, g])}
                />
              </Animated.View>
            ))}
            {newGenre == null && (
              <Animated.View layout={LinearTransition.duration(220)}>
                <Chip small label="＋ New genre" selected={false} onPress={() => setNewGenre('')} />
              </Animated.View>
            )}
          </View>
        </LayoutAnimationConfig>
        {newGenre != null && (
          <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(120)} style={styles.genreRow}>
            <TextInput
              value={newGenre}
              onChangeText={setNewGenre}
              onSubmitEditing={addGenre}
              placeholder="e.g. Cosy Mystery"
              placeholderTextColor={Colors.border}
              maxLength={GENRE_MAX_LENGTH}
              autoFocus
              returnKeyType="done"
              accessibilityLabel="New genre"
              style={[styles.input, { flex: 1 }]}
            />
            <Pressable style={styles.addGenre} onPress={addGenre} accessibilityRole="button">
              <Text style={styles.addGenreText}>Add</Text>
            </Pressable>
          </Animated.View>
        )}
        <Text style={styles.hint}>
          {form.genres.length
            ? `Shelved under ${form.genres[0]}: the first genre chosen decides which shelf it sits on.`
            : 'The first genre chosen decides which shelf it sits on.'}
        </Text>

        <Text style={styles.label}>Spine colour</Text>
        <View style={styles.wrap}>
          {SPINE_COLORS.map((c) => (
            <Pressable
              key={c ?? 'auto'}
              onPress={() => set('spineColor')(c)}
              style={[styles.swatch, { backgroundColor: c ?? Colors.surface }, form.spineColor === c && styles.swatchSelected]}>
              {c == null && <Text style={styles.auto}>auto</Text>}
            </Pressable>
          ))}
        </View>

        {!editing && (
          <>
            <Text style={styles.label}>Shelf it as</Text>
            <View style={styles.wrap}>
              {STATUSES.map((s) => (
                <Chip key={s} label={STATUS_LABELS[s]} selected={status === s} onPress={() => setStatus(s)} />
              ))}
            </View>
            <Text style={styles.label}>Do you own it?</Text>
            <View style={styles.wrap}>
              <Chip label="On my shelf" selected={owned} onPress={() => setOwnedChoice(true)} />
              <Chip label="Not owned" selected={!owned} onPress={() => setOwnedChoice(false)} />
            </View>
            <Text style={styles.hint}>Books you don’t own are shown faded on the shelf.</Text>
          </>
        )}

        <Pressable style={styles.save} onPress={save}>
          <Text style={styles.saveText}>{editing ? 'Save changes' : 'Add to shelf'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formErrors(f: Form) {
  return {
    seriesIndex: checkSeriesIndex(f.seriesIndex),
    pageCount: checkPageCount(f.pageCount),
    publishedYear: checkYear(f.publishedYear),
    isbn: checkIsbn(f.isbn),
    heightMm: checkHeight(f.heightMm),
  };
}

function confirmDuplicate(title: string): Promise<boolean> {
  return new Promise((resolve) =>
    alert('Already on your shelves', `“${title}” has the same ISBN. Add another copy?`, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Add anyway', onPress: () => resolve(true) },
    ]),
  );
}

function Field({
  label,
  value,
  onChange,
  numeric,
  filter,
  error,
  flex = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  /** Tidies what's typed, e.g. dropping anything but digits. */
  filter?: (v: string) => string;
  /** Shown under the field, which turns red. */
  error?: string | null;
  flex?: number;
}) {
  return (
    <View style={{ flex, gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(filter ? filter(v) : v)}
        keyboardType={numeric ? 'number-pad' : 'default'}
        accessibilityLabel={label}
        placeholderTextColor={Colors.border}
        style={[styles.input, error && { borderColor: Colors.danger }]}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 60 },
  pair: { flexDirection: 'row', gap: 12 },
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 4 },
  hint: { color: Colors.textMuted, fontSize: 12 },
  error: { color: Colors.danger, fontSize: 12 },
  genreRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addGenre: { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  addGenreText: { color: Colors.accentText, fontWeight: '700' },
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  swatchSelected: { borderColor: Colors.accent, borderWidth: 3 },
  auto: { color: Colors.textMuted, fontSize: 9 },
  save: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveText: { color: Colors.accentText, fontSize: 16, fontWeight: '700' },
  headerAction: { color: Colors.accent, fontSize: 16, fontWeight: '600' },
});
