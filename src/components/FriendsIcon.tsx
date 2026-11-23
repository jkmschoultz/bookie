import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

/** Two people, drawn in the header's muted colour to sit beside the ⚙ button. */
export function FriendsIcon({ color = Colors.textMuted }: { color?: string }) {
  return (
    <View style={styles.icon} accessible={false}>
      <View style={[styles.person, styles.back]}>
        <View style={[styles.head, { backgroundColor: color }]} />
        <View style={[styles.body, { backgroundColor: color }]} />
      </View>
      <View style={[styles.person, styles.front]}>
        <View style={[styles.frontHead, { backgroundColor: color }]} />
        <View style={[styles.frontBody, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 26, height: 20 },
  person: { position: 'absolute', alignItems: 'center', width: 16 },
  back: { right: 0, top: 0, opacity: 0.6 },
  front: { left: -1.5, top: -0.5, width: 19 },
  head: { width: 8, height: 8, borderRadius: 4 },
  body: { width: 15, height: 9, marginTop: 1.5, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  // The front person has a rim in the background colour, so there's a gap where it overlaps the one behind.
  frontHead: { width: 11, height: 11, borderRadius: 5.5, borderWidth: 1.5, borderColor: Colors.background },
  frontBody: { width: 18, height: 12, marginTop: -1.5, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderWidth: 1.5, borderColor: Colors.background },
});
