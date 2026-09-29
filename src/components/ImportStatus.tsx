import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import type { ImportPhase } from '@/library/useGoodreadsImport';

/** Progress and result of a Goodreads import. Renders nothing while idle. */
export function ImportStatus({ phase }: { phase: ImportPhase }) {
  switch (phase.kind) {
    case 'idle':
      return null;
    case 'error':
      return <Text style={styles.error}>{phase.message}</Text>;
    case 'reading':
      return <ActivityIndicator color={Colors.accent} />;
    case 'enriching':
      return (
        <View style={styles.box}>
          <Text style={styles.body}>
            Added {phase.added} books{phase.duplicates ? ` (${phase.duplicates} already here)` : ''}. Finding covers and genres…{' '}
            {phase.done}/{phase.total}
          </Text>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${phase.total ? (phase.done / phase.total) * 100 : 100}%` }]} />
          </View>
          <Pressable onPress={() => router.dismissTo('/')}>
            <Text style={styles.link}>Go to shelves (keeps working)</Text>
          </Pressable>
        </View>
      );
    case 'done':
      return (
        <View style={styles.box}>
          <Text style={styles.heading}>Imported {phase.added} books</Text>
          {phase.duplicates > 0 && <Text style={styles.body}>{phase.duplicates} were already on your shelves.</Text>}
          <Pressable style={styles.button} onPress={() => router.dismissTo('/')}>
            <Text style={styles.buttonText}>View shelves</Text>
          </Pressable>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  box: { gap: 12 },
  heading: { color: Colors.text, fontSize: 19, fontWeight: '700' },
  body: { color: Colors.textMuted, fontSize: 15, lineHeight: 22 },
  error: { color: Colors.danger, fontSize: 15 },
  track: { height: 8, borderRadius: 4, backgroundColor: Colors.surfaceRaised, overflow: 'hidden' },
  bar: { height: '100%', backgroundColor: Colors.accent },
  link: { color: Colors.accent, fontWeight: '600', textDecorationLine: 'underline' },
  button: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: Colors.accentText, fontSize: 16, fontWeight: '700' },
});
