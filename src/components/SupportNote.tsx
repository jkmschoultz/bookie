import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { SUPPORT_LINKS } from '@/constants/support';

/** A friendly ask at the end of the tour and in Settings: say you'd like more, or chip in. Hidden until a link is set. */
export function SupportNote() {
  const { interest, donate } = SUPPORT_LINKS;
  if (!interest && !donate) return null;
  return (
    <View style={styles.note}>
      <Text style={styles.title}>💛 Help Bookie grow</Text>
      <Text style={styles.body}>
        Bookie is a small project with plans for more, like shelves for vinyl and DVDs. If you’d like to see it keep going, let me
        know you’re interested{donate ? ', or chip in to support its development' : ''}.
      </Text>
      <View style={styles.buttons}>
        {!!interest && (
          <Pressable style={styles.primary} onPress={() => Linking.openURL(interest)} accessibilityRole="link">
            <Text style={styles.primaryText}>I’m interested</Text>
          </Pressable>
        )}
        {!!donate && (
          <Pressable style={styles.secondary} onPress={() => Linking.openURL(donate)} accessibilityRole="link">
            <Text style={styles.secondaryText}>Support development</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { padding: 16, gap: 8, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  title: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  body: { color: Colors.textMuted, fontSize: 15, lineHeight: 22 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  primary: { backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  primaryText: { color: Colors.accentText, fontSize: 15, fontWeight: '700' },
  secondary: { borderRadius: 10, borderWidth: 1, borderColor: Colors.accent, paddingVertical: 10, paddingHorizontal: 16 },
  secondaryText: { color: Colors.accent, fontSize: 15, fontWeight: '600' },
});
