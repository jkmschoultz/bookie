import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useLibrary } from '@/library/LibraryProvider';
import { sampleBooks } from '@/library/sampleBooks';
import { useUi } from '@/store/uiStore';

export default function SettingsScreen() {
  const { books, addBooks, eraseLibrary } = useLibrary();
  const resetUi = useUi((s) => s.reset);

  const erase = () =>
    Alert.alert('Erase library?', `All ${books.length} books, ratings, notes and cover photos will be deleted. This can’t be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase',
        style: 'destructive',
        onPress: async () => {
          await eraseLibrary();
          resetUi();
          router.dismissTo('/');
        },
      },
    ]);

  const loadSample = async () => {
    await addBooks(sampleBooks());
    router.dismissTo('/');
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Library</Text>
      <View style={styles.card}>
        <Text style={styles.body}>
          {books.length} {books.length === 1 ? 'book' : 'books'} on your shelves, stored on this device.
        </Text>
        <Pressable style={styles.row} onPress={loadSample}>
          <Text style={styles.rowText}>Add the sample library</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={erase} disabled={!books.length}>
          <Text style={[styles.rowText, { color: books.length ? Colors.danger : Colors.border }]}>Erase library</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Erasing returns Bookie to how it was on first launch.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 10 },
  sectionTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  body: { color: Colors.textMuted, fontSize: 15, padding: 16 },
  row: { paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  rowText: { color: Colors.text, fontSize: 16, fontWeight: '500' },
  hint: { color: Colors.textMuted, fontSize: 13, paddingHorizontal: 4 },
});
