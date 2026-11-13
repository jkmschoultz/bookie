import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { checkYear, digitsOnly } from '@/library/fields';

import { Sheet } from './Sheet';

const ROW = 46;

interface Props {
  label: string;
  /** A year as text, or '' for none. */
  value: string;
  onChange: (year: string) => void;
  error?: string | null;
}

/** Newest first: next year (for preorders) back to year 1. */
export function yearOptions(now = new Date()): number[] {
  const latest = now.getFullYear() + 1;
  return Array.from({ length: latest }, (_, i) => latest - i);
}

/** A field that opens a sheet of years to pick from, scrolled to the chosen one. A year can also be typed. */
export function YearPicker({ label, value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const { height } = useWindowDimensions();
  const years = useMemo(() => yearOptions(), []);
  const selectedIndex = value ? years.indexOf(Number(value)) : -1;
  const typedError = typed.length === 4 ? checkYear(typed) : null;

  const choose = (year: string) => {
    onChange(year);
    setOpen(false);
    setTyped('');
  };

  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || 'not set'}`}
        style={[styles.field, error && { borderColor: Colors.danger }]}>
        <Text style={[styles.value, !value && styles.placeholder]}>{value || 'Choose'}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}

      <Sheet visible={open} onClose={() => setOpen(false)} accessibilityLabel={label}>
        <Text style={styles.title}>{label}</Text>
        <View style={styles.typeRow}>
          <TextInput
            value={typed}
            onChangeText={(t) => setTyped(digitsOnly(t, 4))}
            onSubmitEditing={() => typed && !typedError && choose(typed)}
            placeholder="Type a year"
            placeholderTextColor={Colors.border}
            keyboardType="number-pad"
            returnKeyType="done"
            accessibilityLabel="Type a year"
            style={[styles.typeInput, typedError && { borderColor: Colors.danger }]}
          />
          <Pressable
            onPress={() => choose(typed)}
            disabled={typed.length === 0 || !!typedError}
            accessibilityRole="button"
            style={[styles.use, (typed.length === 0 || !!typedError) && { opacity: 0.4 }]}>
            <Text style={styles.useText}>Use</Text>
          </Pressable>
        </View>
        {typedError && <Text style={styles.error}>{typedError}</Text>}
        <FlatList
          data={years}
          keyExtractor={String}
          style={{ height: Math.min(height * 0.45, 380) }}
          getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })}
          // Open on the chosen year, a few rows down so the ones around it show too.
          initialScrollIndex={Math.max(0, selectedIndex - 3)}
          initialNumToRender={20}
          ListHeaderComponent={
            <Pressable onPress={() => choose('')} style={[styles.row, !value && styles.selectedRow]} accessibilityRole="button">
              <Text style={[styles.rowText, styles.none, !value && styles.selectedText]}>No year</Text>
            </Pressable>
          }
          renderItem={({ item }) => {
            const selected = String(item) === value;
            return (
              <Pressable
                onPress={() => choose(String(item))}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.row, selected && styles.selectedRow]}>
                <Text style={[styles.rowText, selected && styles.selectedText]}>{item}</Text>
                {selected && <Text style={styles.check}>✓</Text>}
              </Pressable>
            );
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 4 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  value: { color: Colors.text, fontSize: 16 },
  placeholder: { color: Colors.border },
  chevron: { color: Colors.textMuted, fontSize: 14 },
  error: { color: Colors.danger, fontSize: 12 },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeInput: {
    flex: 1,
    color: Colors.text,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  use: { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  useText: { color: Colors.accentText, fontWeight: '700' },
  row: { height: ROW, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderRadius: 10 },
  selectedRow: { backgroundColor: Colors.surfaceRaised },
  rowText: { color: Colors.text, fontSize: 17 },
  none: { color: Colors.textMuted, fontStyle: 'italic' },
  selectedText: { color: Colors.accent, fontWeight: '700' },
  check: { color: Colors.accent, fontSize: 16, fontWeight: '700' },
});
