import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useUi } from '@/store/uiStore';

const OPTIONS: { href: Href; icon: string; title: string; body: string }[] = [
  { href: '/add/search', icon: '⌕', title: 'Search', body: 'Find a book by title or author' },
  { href: '/add/scan', icon: '▥', title: 'Scan barcode', body: 'Point your camera at the ISBN on the back cover' },
  { href: '/add/manual', icon: '✎', title: 'Enter manually', body: 'Type in the details yourself' },
  { href: '/add/import', icon: '⇪', title: 'Import from Goodreads', body: 'Bring in your whole library from a CSV export' },
];

export default function AddScreen() {
  const setDraft = useUi((s) => s.setDraft);
  return (
    <View style={styles.list}>
      {OPTIONS.map((o) => (
        <Pressable
          key={o.title}
          style={({ pressed }) => [styles.option, pressed && { backgroundColor: Colors.surfaceRaised }]}
          onPress={() => {
            setDraft(null);
            router.push(o.href);
          }}>
          <Text style={styles.icon}>{o.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{o.title}</Text>
            <Text style={styles.body}>{o.body}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  icon: { fontSize: 26, color: Colors.accent, width: 32, textAlign: 'center' },
  title: { color: Colors.text, fontSize: 17, fontWeight: '600' },
  body: { color: Colors.textMuted, fontSize: 14, marginTop: 2 },
});
