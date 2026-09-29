import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
}

/** Tap a star to rate; tap it again for a half star; tap once more to clear. */
export function StarRating({ value, onChange }: Props) {
  const press = (star: number) => {
    if (value === star) onChange(star - 0.5);
    else if (value === star - 0.5) onChange(null);
    else onChange(star);
  };
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const v = value ?? 0;
        return (
          <Pressable key={star} onPress={() => press(star)} hitSlop={6} accessibilityLabel={`Rate ${star} stars`}>
            <Text style={styles.star}>★</Text>
            {v >= star - 0.5 && (
              <View style={[styles.fill, { width: v >= star ? '100%' : '50%' }]}>
                <Text style={[styles.star, styles.filled]}>★</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 30, color: Colors.border },
  filled: { color: Colors.accent },
  fill: { position: 'absolute', top: 0, left: 0, bottom: 0, overflow: 'hidden' },
});
