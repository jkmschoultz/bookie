import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { alert } from '@/components/alert';
import { SupportNote } from '@/components/SupportNote';
import { Colors } from '@/constants/theme';
import { findDuplicates } from '@/library/duplicates';
import { useLibrary } from '@/library/LibraryProvider';
import { sampleBooks } from '@/library/sampleBooks';
import { backupFileName, parseBackup, toBackup } from '@/services/backup';
import { readPickedText, saveJsonFile } from '@/services/files';
import type { LayoutMode } from '@/shelf/layout';
import { useUi } from '@/store/uiStore';
import { bookKey } from '@/types';

const LAYOUTS: { mode: LayoutMode; title: string; body: string }[] = [
  { mode: 'row', title: 'Swipe', body: 'Each group keeps to its own shelf. Swipe sideways along the long ones.' },
  { mode: 'wrap', title: 'Wrap', body: 'Books flow along the shelves to fit the screen, like a real bookcase. Nothing scrolls sideways.' },
];

export default function SettingsScreen() {
  const { books, addBooks, eraseLibrary, mergeDuplicates } = useLibrary();
  const resetUi = useUi((s) => s.reset);
  const layoutMode = useUi((s) => s.layoutMode);
  const setLayoutMode = useUi((s) => s.setLayoutMode);

  const erase = () =>
    alert('Erase library?', `All ${books.length} books, ratings, notes and cover photos will be deleted. This can’t be undone.`, [
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

  const removeDuplicates = () => {
    const merges = findDuplicates(books);
    if (!merges.length) {
      alert('No duplicates', 'Every book on your shelves is only there once.');
      return;
    }
    const copies = merges.reduce((n, m) => n + m.remove.length, 0);
    const titles = merges.slice(0, 5).map((m) => `• ${m.keep.title}`);
    if (merges.length > 5) titles.push(`• and ${merges.length - 5} more`);
    alert(
      `Remove ${copies} duplicate ${copies === 1 ? 'copy' : 'copies'}?`,
      `${titles.join('\n')}\n\nEach book keeps the copy with the most details, filled in from the others: ratings, notes, genres, and the newest reading dates.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove duplicates',
          style: 'destructive',
          onPress: async () => {
            const removed = await mergeDuplicates(merges);
            alert('Duplicates removed', `${removed} ${removed === 1 ? 'copy' : 'copies'} merged into the remaining books.`);
          },
        },
      ],
    );
  };

  const exportBackup = async () => {
    try {
      await saveJsonFile(backupFileName(), toBackup(books));
    } catch (e) {
      alert('Couldn’t save the backup', e instanceof Error ? e.message : undefined);
    }
  };

  const restoreBackup = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
    if (picked.canceled) return;
    try {
      const restored = parseBackup(await readPickedText(picked.assets[0]));
      const known = new Set(books.map(bookKey));
      const fresh = restored.filter((b) => !known.has(bookKey(b)));
      await addBooks(fresh);
      const skipped = restored.length - fresh.length;
      alert('Backup restored', `${fresh.length} added${skipped ? `, ${skipped} already on your shelves` : ''}.`);
    } catch (e) {
      alert('Couldn’t restore', e instanceof Error ? e.message : undefined);
    }
  };

  const loadSample = async () => {
    await addBooks(sampleBooks());
    router.dismissTo('/');
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" alwaysBounceVertical contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Library</Text>
      <View style={styles.card}>
        <Text style={styles.body}>
          {books.length} {books.length === 1 ? 'book' : 'books'} on your shelves, stored on this device.
        </Text>
        <Pressable style={styles.row} onPress={loadSample}>
          <Text style={styles.rowText}>Add the sample library</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={removeDuplicates} disabled={books.length < 2}>
          <Text style={[styles.rowText, books.length < 2 && { color: Colors.border }]}>Remove duplicates</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={erase} disabled={!books.length}>
          <Text style={[styles.rowText, { color: books.length ? Colors.danger : Colors.border }]}>Erase library</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        Duplicates are books with the same title and author. Erasing returns Bookie to how it was on first launch.
      </Text>

      <Text style={[styles.sectionTitle, styles.spaced]}>Shelves</Text>
      <View style={styles.card}>
        {LAYOUTS.map((l, i) => (
          <Pressable
            key={l.mode}
            style={i ? styles.row : styles.firstRow}
            onPress={() => setLayoutMode(l.mode)}
            accessibilityRole="radio"
            accessibilityState={{ checked: layoutMode === l.mode }}>
            <View style={styles.choice}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowText}>{l.title}</Text>
                <Text style={styles.rowHint}>{l.body}</Text>
              </View>
              {layoutMode === l.mode && <Text style={styles.check}>✓</Text>}
            </View>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.sectionTitle, styles.spaced]}>Help</Text>
      <View style={styles.card}>
        <Pressable style={styles.firstRow} onPress={() => router.push('/welcome')}>
          <Text style={styles.rowText}>Show the welcome tour</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, styles.spaced]}>Backup</Text>
      <View style={styles.card}>
        <Pressable style={styles.firstRow} onPress={exportBackup} disabled={!books.length}>
          <Text style={[styles.rowText, !books.length && { color: Colors.border }]}>Export backup</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={restoreBackup}>
          <Text style={styles.rowText}>Restore from backup</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        Your library only lives on this device. Export a backup now and then, and keep it somewhere safe like Files or Drive.
        Restoring adds the books from a backup and skips any already on your shelves. Photos you took for covers aren’t included.
      </Text>

      <View style={styles.spaced}>
        <SupportNote />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 10 },
  sectionTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  body: { color: Colors.textMuted, fontSize: 15, padding: 16 },
  firstRow: { paddingVertical: 14, paddingHorizontal: 16 },
  row: { paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowHint: { color: Colors.textMuted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  check: { color: Colors.accent, fontSize: 18, fontWeight: '700' },
  rowText: { color: Colors.text, fontSize: 16, fontWeight: '500' },
  spaced: { marginTop: 18 },
  hint: { color: Colors.textMuted, fontSize: 13, paddingHorizontal: 4 },
});
