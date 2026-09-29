import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { ImportStatus } from '@/components/ImportStatus';
import { Colors } from '@/constants/theme';
import { useGoodreadsImport } from '@/library/useGoodreadsImport';

export default function ImportScreen() {
  const { phase, importCsv, setReading, fail } = useGoodreadsImport();
  const busy = phase.kind === 'reading' || phase.kind === 'enriching';

  const pickFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    setReading();
    try {
      await importCsv(await new File(picked.assets[0].uri).text());
    } catch (e) {
      fail(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Bring in your Goodreads library</Text>
      <Text style={styles.body}>
        Sign in to Goodreads here and tap “Export Library”. Bookie picks up the export as soon as it’s ready, so there’s no file to
        download.
      </Text>
      <Text style={styles.body}>
        Shelves, ratings and read dates come across. Books already on your shelves are skipped. Covers and genres are then looked up
        online, which takes a moment for big libraries.
      </Text>

      {!busy && phase.kind !== 'done' && (
        <>
          <Pressable style={styles.button} onPress={() => router.push('/add/goodreads')}>
            <Text style={styles.buttonText}>Sign in to Goodreads</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={pickFile}>
            <Text style={styles.secondaryText}>I already have the CSV file</Text>
          </Pressable>
        </>
      )}
      <ImportStatus phase={phase} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  heading: { color: Colors.text, fontSize: 19, fontWeight: '700' },
  body: { color: Colors.textMuted, fontSize: 15, lineHeight: 22 },
  button: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: Colors.accentText, fontSize: 16, fontWeight: '700' },
  secondary: { paddingVertical: 10, alignItems: 'center' },
  secondaryText: { color: Colors.accent, fontSize: 15, fontWeight: '600' },
});
