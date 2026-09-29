import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { completeSearchResult, searchOpenLibrary, type OLSearchDoc } from '@/services/metadata/lookup';
import { coverUrl } from '@/services/metadata/openLibrary';
import { useUi } from '@/store/uiStore';

export default function SearchScreen() {
  const setDraft = useUi((s) => s.setDraft);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OLSearchDoc[]>([]);
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    const timer = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setSearching(true);
      setError(null);
      try {
        setResults(await searchOpenLibrary(q, ctrl.signal));
      } catch {
        if (!ctrl.signal.aborted) setError('Search failed. Check your connection.');
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const tooShort = query.trim().length < 3;

  const choose = async (doc: OLSearchDoc) => {
    setOpening(doc.key);
    try {
      setDraft(await completeSearchResult(doc));
      router.push('/add/manual');
    } finally {
      setOpening(null);
    }
  };

  return (
    <View style={styles.screen}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Title, author or ISBN"
        placeholderTextColor={Colors.textMuted}
        autoFocus
        returnKeyType="search"
        style={styles.input}
      />
      {searching && !tooShort && <ActivityIndicator color={Colors.accent} style={{ marginTop: 12 }} />}
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={tooShort ? [] : results}
        keyExtractor={(d) => d.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [styles.result, pressed && { backgroundColor: Colors.surface }]} onPress={() => choose(item)} disabled={!!opening}>
            {item.cover_i ? (
              <Image source={coverUrl(item.cover_i, 'S')} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: Colors.surfaceRaised }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[item.author_name?.join(', '), item.first_publish_year].filter(Boolean).join(' · ')}
              </Text>
              {item.number_of_pages_median && <Text style={styles.meta}>{item.number_of_pages_median} pages</Text>}
            </View>
            {opening === item.key && <ActivityIndicator color={Colors.accent} />}
          </Pressable>
        )}
        ListEmptyComponent={
          !searching && !tooShort && !error ? <Text style={styles.empty}>No books found.</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  input: {
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  result: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 8 },
  thumb: { width: 44, height: 66, borderRadius: 3 },
  title: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  meta: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  error: { color: Colors.danger, marginTop: 12 },
});
