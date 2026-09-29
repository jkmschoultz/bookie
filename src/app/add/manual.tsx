import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { Cover } from '@/components/Cover';
import { Colors } from '@/constants/theme';
import { useLibrary } from '@/library/LibraryProvider';
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

/** Copy a picked photo out of the cache so it survives. */
async function persistPhoto(uri: string): Promise<string> {
  const dir = new Directory(Paths.document, 'covers');
  dir.create({ idempotent: true });
  const dest = new File(dir, `${Date.now()}.jpg`);
  await new File(uri).copy(dest);
  return dest.uri;
}

export default function BookFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getBook, addBook, updateBook, findByIsbn } = useLibrary();
  const draft = useUi((s) => s.draft);
  const setDraft = useUi((s) => s.setDraft);

  const editing: Book | undefined = id ? getBook(Number(id)) : undefined;
  const base = editing ?? draft ?? emptyDraft();
  const [form, setForm] = useState<Form>(() => toForm(base));
  const [status, setStatus] = useState<ReadStatus>('owned');

  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const preview: Book = {
    ...fromForm(form, base),
    id: editing?.id ?? -1,
    status,
    rating: null,
    owned: true,
    dateAdded: today(),
    dateStarted: null,
    dateFinished: null,
    notes: null,
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [2, 3], quality: 0.8 });
    if (!res.canceled) set('coverUrl')(await persistPhoto(res.assets[0].uri));
  };

  const save = async () => {
    const book = fromForm(form, base);
    if (!book.title) {
      Alert.alert('A title is needed');
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
      owned: status !== 'want',
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.coverRow}>
          <Cover key={form.coverUrl ?? 'none'} book={preview} width={96} />
          <View style={{ flex: 1, gap: 8 }}>
            <Pressable style={styles.smallButton} onPress={pickPhoto}>
              <Text style={styles.smallButtonText}>Choose cover photo</Text>
            </Pressable>
            {form.coverUrl && (
              <Pressable style={styles.smallButton} onPress={() => set('coverUrl')(null)}>
                <Text style={styles.smallButtonText}>Remove cover</Text>
              </Pressable>
            )}
          </View>
        </View>

        <Field label="Title *" value={form.title} onChange={set('title')} />
        <Field label="Subtitle" value={form.subtitle} onChange={set('subtitle')} />
        <Field label="Authors (comma separated)" value={form.authors} onChange={set('authors')} />
        <View style={styles.pair}>
          <Field label="Series" value={form.series} onChange={set('series')} flex={3} />
          <Field label="#" value={form.seriesIndex} onChange={set('seriesIndex')} numeric flex={1} />
        </View>
        <View style={styles.pair}>
          <Field label="Pages" value={form.pageCount} onChange={set('pageCount')} numeric />
          <Field label="Year published" value={form.publishedYear} onChange={set('publishedYear')} numeric />
        </View>
        <Field label="Publisher" value={form.publisher} onChange={set('publisher')} />
        <View style={styles.pair}>
          <Field label="ISBN" value={form.isbn} onChange={set('isbn')} numeric flex={2} />
          <Field label="Height (mm)" value={form.heightMm} onChange={set('heightMm')} numeric />
        </View>

        <Text style={styles.label}>Genres</Text>
        <View style={styles.wrap}>
          {GENRES.map((g) => (
            <Chip
              key={g}
              small
              label={g}
              selected={form.genres.includes(g)}
              onPress={() => set('genres')(form.genres.includes(g) ? form.genres.filter((x) => x !== g) : [...form.genres, g])}
            />
          ))}
        </View>
        <Text style={styles.hint}>The first genre chosen decides which shelf it sits on.</Text>

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
          </>
        )}

        <Pressable style={styles.save} onPress={save}>
          <Text style={styles.saveText}>{editing ? 'Save changes' : 'Add to shelf'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function confirmDuplicate(title: string): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert('Already on your shelves', `“${title}” has the same ISBN. Add another copy?`, [
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
  flex = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  flex?: number;
}) {
  return (
    <View style={{ flex, gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'numbers-and-punctuation' : 'default'}
        placeholderTextColor={Colors.border}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 60 },
  coverRow: { flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 8 },
  pair: { flexDirection: 'row', gap: 12 },
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 4 },
  hint: { color: Colors.textMuted, fontSize: 12 },
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  swatchSelected: { borderColor: Colors.accent, borderWidth: 3 },
  auto: { color: Colors.textMuted, fontSize: 9 },
  smallButton: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start' },
  smallButtonText: { color: Colors.text, fontSize: 14 },
  save: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveText: { color: Colors.accentText, fontSize: 16, fontWeight: '700' },
  headerAction: { color: Colors.accent, fontSize: 16, fontWeight: '600' },
});
