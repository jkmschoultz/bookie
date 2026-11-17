import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { bringBooksDismissed, dismissBringBooks, isAppleHomeScreenApp, shouldShowBringBooks } from '@/library/bringBooks';
import { useLibrary } from '@/library/LibraryProvider';
import { movedTo } from '@/library/move';

/**
 * Shown in the iPhone or iPad home-screen app while its library is empty, because it can't see the books saved in
 * Safari (see `src/library/bringBooks.ts`). Points to Settings, where the backup is restored.
 */
export function BringBooksNote() {
  const [homeScreenApp] = useState(isAppleHomeScreenApp);
  if (!homeScreenApp) return null;
  return <Note />;
}

function Note() {
  const { books, loaded } = useLibrary();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [moved] = useState(() => movedTo() != null);

  useEffect(() => {
    bringBooksDismissed().then(setDismissed);
  }, []);

  if (!shouldShowBringBooks({ homeScreenApp: true, loaded, bookCount: books.length, dismissed, moved })) return null;

  const dismiss = () => {
    setDismissed(true);
    dismissBringBooks().catch(() => {});
  };

  return (
    <View style={styles.note} accessibilityRole="summary">
      <Text style={styles.title}>Bring your books over from Safari</Text>
      <Text style={styles.text}>
        Your home-screen app has its own library. In Safari, open Bookie → Settings → Export backup, then come back here and use
        Restore from backup.
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={() => router.push('/settings')} style={styles.primary} accessibilityRole="button">
          <Text style={styles.primaryText}>Open Settings</Text>
        </Pressable>
        <Pressable onPress={dismiss} style={styles.secondary} accessibilityRole="button">
          <Text style={styles.secondaryText}>Don’t show again</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Same look as MovedBanner.
const styles = StyleSheet.create({
  note: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    gap: 10,
    borderRadius: 14,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  title: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  text: { color: Colors.text, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  primary: { backgroundColor: Colors.accent, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  primaryText: { color: Colors.accentText, fontWeight: '700', fontSize: 14 },
  secondary: { paddingHorizontal: 12, paddingVertical: 9 },
  secondaryText: { color: Colors.accent, fontWeight: '600', fontSize: 14 },
});
