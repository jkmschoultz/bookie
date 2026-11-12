import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { ImportStatus } from '@/components/ImportStatus';
import { Colors } from '@/constants/theme';
import { useGoodreadsImport } from '@/library/useGoodreadsImport';
import { readPickedText } from '@/services/files';
import { GOODREADS_EXPORT_PAGE, looksLikeGoodreadsExport } from '@/services/import/goodreadsCsv';

// Signing in happens in a WebView, which only exists in the native app. On web, browsers don't let one site read
// another's pages or downloads, so the export comes in by hand: pasted (phones show the CSV as a page of text) or as a file.
const CAN_SIGN_IN = Platform.OS !== 'web';

export default function ImportScreen() {
  const { phase, importCsv, setReading, fail } = useGoodreadsImport();
  const busy = phase.kind === 'reading' || phase.kind === 'enriching';
  // Shown when the browser won't hand over the clipboard, so the export can be pasted in by hand.
  const [pasteBox, setPasteBox] = useState<string | null>(null);
  const [pasteNote, setPasteNote] = useState<string | null>(null);

  const pickFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    setReading();
    try {
      await importCsv(await readPickedText(picked.assets[0]));
    } catch (e) {
      fail(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  };

  const importText = async (text: string) => {
    setReading();
    try {
      await importCsv(text);
      setPasteBox(null);
    } catch (e) {
      fail(e instanceof Error ? e.message : "Couldn't read that text.");
    }
  };

  const pasteFromClipboard = async () => {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      // Not allowed or not supported: paste into a text box instead.
      setPasteNote('Your browser didn’t hand over the clipboard, so paste it here instead.');
      setPasteBox('');
      return;
    }
    if (looksLikeGoodreadsExport(text.trimStart())) {
      await importText(text);
      return;
    }
    // Keep whatever was read so it can be checked or fixed, rather than silently throwing it away.
    setPasteNote(
      text.trim()
        ? 'The clipboard doesn’t look like a Goodreads export (it should start with “Book Id,Title,Author…”). Copy the whole export page and paste it here.'
        : 'The clipboard is empty. Copy the export first, then paste it here.',
    );
    setPasteBox(text);
  };

  // Pasting straight into the box imports it, so there's no second button to press.
  const onPasteBoxChange = (text: string) => {
    const pasted = pasteBox !== null && text.length - pasteBox.length > 100;
    setPasteBox(text);
    if (pasted && looksLikeGoodreadsExport(text.trimStart())) importText(text);
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" alwaysBounceVertical contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Bring in your Goodreads library</Text>
      {CAN_SIGN_IN ? (
        <Text style={styles.body}>
          Sign in to Goodreads here and tap “Export Library”. Bookie picks up the export as soon as it’s ready, so there’s no file to
          download.
        </Text>
      ) : (
        <Text style={styles.body}>
          Open Goodreads below, sign in, and tap “Export Library”, then tap the export link when it appears. On a phone the export
          opens as a page of text: tap and hold it, choose Select All, then Copy, and come back here to paste it. On a computer it
          downloads as a file you can choose instead.
        </Text>
      )}
      <Text style={styles.body}>
        Shelves, ratings and read dates come across. Books already on your shelves are skipped. Covers and genres are then looked up
        online, which takes a moment for big libraries.
      </Text>

      {!busy && phase.kind !== 'done' && (
        <>
          {CAN_SIGN_IN ? (
            <>
              <Pressable style={styles.button} onPress={() => router.push('/add/goodreads')}>
                <Text style={styles.buttonText}>Sign in to Goodreads</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={pickFile}>
                <Text style={styles.secondaryText}>I already have the CSV file</Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* A popup window on desktop; phones open it in a new tab. */}
              <Pressable style={styles.button} onPress={() => window.open(GOODREADS_EXPORT_PAGE, 'goodreads', 'popup,width=520,height=760')}>
                <Text style={styles.buttonText}>1. Open Goodreads</Text>
              </Pressable>
              {pasteBox === null ? (
                <Pressable style={styles.button} onPress={pasteFromClipboard}>
                  <Text style={styles.buttonText}>2. Paste the export</Text>
                </Pressable>
              ) : (
                <>
                  {pasteNote && <Text style={styles.body}>{pasteNote}</Text>}
                  <TextInput
                    value={pasteBox}
                    onChangeText={onPasteBoxChange}
                    multiline
                    autoFocus
                    placeholder="Tap and hold here, then Paste"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.pasteBox}
                  />
                  <Pressable style={[styles.button, !pasteBox.trim() && styles.disabled]} disabled={!pasteBox.trim()} onPress={() => importText(pasteBox)}>
                    <Text style={styles.buttonText}>Import pasted export</Text>
                  </Pressable>
                </>
              )}
              <Pressable style={styles.secondary} onPress={pickFile}>
                <Text style={styles.secondaryText}>Or choose a downloaded CSV file</Text>
              </Pressable>
            </>
          )}
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
  disabled: { opacity: 0.4 },
  pasteBox: {
    minHeight: 120,
    maxHeight: 220,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
