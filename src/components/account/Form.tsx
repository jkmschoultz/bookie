import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Colors } from '@/constants/theme';

/** A labelled text field, in the same style as the book form. */
export function Field({ label, hint, error, ...input }: { label: string; hint?: string | null; error?: string | null } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={Colors.border}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, error && { borderColor: Colors.danger }]}
        {...input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ title, onPress, busy, disabled }: { title: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      style={[styles.primary, (disabled || busy) && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}>
      {busy ? <ActivityIndicator color={Colors.accentText} /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable style={styles.link} onPress={onPress} accessibilityRole="button" hitSlop={6}>
      <Text style={styles.linkText}>{title}</Text>
    </Pressable>
  );
}

/** One of a few choices, as in Settings → Shelves. */
export function Choice({ title, body, selected, onPress, first }: { title: string; body: string; selected: boolean; onPress: () => void; first?: boolean }) {
  return (
    <Pressable style={first ? styles.firstRow : styles.row} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
      <View style={styles.choice}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowText}>{title}</Text>
          <Text style={styles.rowHint}>{body}</Text>
        </View>
        {selected && <Text style={styles.check}>✓</Text>}
      </View>
    </Pressable>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export const formStyles = StyleSheet.create({
  error: { color: Colors.danger, fontSize: 14, lineHeight: 20 },
  note: { color: Colors.textMuted, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
});

const styles = StyleSheet.create({
  field: { gap: 4 },
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 4 },
  hint: { color: Colors.textMuted, fontSize: 12 },
  error: { color: Colors.danger, fontSize: 12 },
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
  primary: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8, minHeight: 50, justifyContent: 'center' },
  primaryText: { color: Colors.accentText, fontSize: 16, fontWeight: '700' },
  link: { alignSelf: 'center', paddingVertical: 10 },
  linkText: { color: Colors.accent, fontSize: 15, fontWeight: '600' },
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  firstRow: { paddingVertical: 14, paddingHorizontal: 16 },
  row: { paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { color: Colors.text, fontSize: 16, fontWeight: '500' },
  rowHint: { color: Colors.textMuted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  check: { color: Colors.accent, fontSize: 18, fontWeight: '700' },
});
