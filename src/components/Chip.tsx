import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors } from '@/constants/theme';

interface Props {
  label: string;
  selected?: boolean;
  /** Without it, the chip only shows something (a friend's status) and isn't a button. */
  onPress?: () => void;
  small?: boolean;
}

export function Chip({ label, selected, onPress, small }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected }}
      style={[styles.chip, small && styles.small, selected && styles.selected]}>
      <Text style={[styles.text, small && styles.smallText, selected && styles.selectedText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  small: { paddingHorizontal: 10, paddingVertical: 4 },
  selected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  text: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  smallText: { fontSize: 12 },
  selectedText: { color: Colors.accentText, fontWeight: '700' },
});
