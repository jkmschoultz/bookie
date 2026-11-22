import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

const BOOKCASES = [
  { friend: 'Maja', initials: 'M', tint: '#b66b4b', books: ['#2b3a67', '#c4622d', '#7d5a3c', '#6b8f5e', '#3a3a3a'] },
  { friend: 'Tom', initials: 'T', tint: '#557d83', books: ['#b3202a', '#1f3a5f', '#264653', '#3b2f5c', '#4d6d73'] },
  { friend: 'Elin', initials: 'E', tint: '#7b6e9a', books: ['#2f6b5e', '#7a1f1f', '#8c3b6b', '#a07850', '#bb3e03'] },
];

function Bookcase({ friend, initials, tint, books }: (typeof BOOKCASES)[number]) {
  return (
    <View style={styles.bookcase}>
      <View style={styles.friendLabel}>
        <View style={[styles.avatar, { backgroundColor: tint }]}><Text style={styles.avatarText}>{initials}</Text></View>
        <Text style={styles.friendName}>{friend}</Text>
      </View>
      {/* From above: two banks of book spines with a shared center back, like a double-sided library stack. */}
      <View style={styles.shelfFace}>
        <View style={styles.booksRow}>{books.slice(0, 3).map((color, i) => <View key={`a-${i}`} style={[styles.book, { backgroundColor: color }]} />)}</View>
        <View style={styles.centerRail} />
        <View style={[styles.booksRow, styles.otherSide]}>{books.slice(2).map((color, i) => <View key={`b-${i}`} style={[styles.book, { backgroundColor: color }]} />)}</View>
      </View>
      <View style={styles.shelfEnd} />
    </View>
  );
}

/** An overhead view into a library room, with double-sided bookcases and a central entrance aisle. */
export function FriendsLibraryRoom() {
  return (
    <View style={styles.room} accessible accessibilityLabel="Overhead view from the library entrance: three double-sided bookcases, one each for Maja, Tom and Elin, arranged in two columns around a central aisle">
      <View style={styles.backWall}><Text style={styles.roomTitle}>FRIENDS’ LIBRARY</Text><Text style={styles.roomSubtitle}>A room of books, shared by friends</Text></View>
      <View style={styles.roomInterior}>
        <View style={styles.leftColumn}>
          <Bookcase {...BOOKCASES[0]} />
          <Bookcase {...BOOKCASES[2]} />
        </View>
        <View style={styles.aisle}>
          <View style={styles.aisleLine} />
          <Text style={styles.aisleText}>AISLE</Text>
          <View style={styles.aisleLine} />
        </View>
        <View style={styles.rightColumn}><Bookcase {...BOOKCASES[1]} /></View>
      </View>
      <View style={styles.entry}>
        <View style={styles.doorGap} />
        <Text style={styles.entryText}>ENTRANCE</Text>
        <View style={styles.doorArc} />
      </View>
      <Text style={styles.roomNote}>Each double-sided bookcase belongs to a friend</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  room: { width: '100%', maxWidth: 330, alignSelf: 'center', padding: 10, borderRadius: 16, backgroundColor: '#e8dfd1', borderWidth: 2, borderColor: '#b9a58b', overflow: 'hidden' },
  backWall: { alignItems: 'center', paddingVertical: 8, backgroundColor: '#d8c8b3', borderRadius: 7, borderWidth: 1, borderColor: '#c4b197' },
  roomTitle: { color: '#65503b', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  roomSubtitle: { color: '#8b755d', fontSize: 10, marginTop: 2 },
  roomInterior: { minHeight: 208, flexDirection: 'row', justifyContent: 'center', gap: 7, paddingHorizontal: 2, paddingVertical: 11 },
  leftColumn: { flex: 1, justifyContent: 'space-between', gap: 9 },
  rightColumn: { flex: 1, justifyContent: 'center' },
  aisle: { width: 32, alignItems: 'center', justifyContent: 'center', gap: 5 },
  aisleLine: { width: 1, flex: 1, backgroundColor: '#c7b69e' },
  aisleText: { color: '#927d63', fontSize: 8, fontWeight: '800', letterSpacing: 1, transform: [{ rotate: '-90deg' }] },
  bookcase: { flex: 1, minHeight: 88, padding: 5, borderRadius: 6, backgroundColor: '#a77a52', borderWidth: 2, borderColor: '#795438', shadowColor: '#493728', shadowOpacity: 0.18, shadowRadius: 3, elevation: 2 },
  friendLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingBottom: 4 },
  avatar: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  friendName: { color: '#fff7eb', fontSize: 10, fontWeight: '800' },
  shelfFace: { flex: 1, backgroundColor: '#d8bb91', borderRadius: 3, overflow: 'hidden', justifyContent: 'center', paddingVertical: 3 },
  booksRow: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch', gap: 2, paddingHorizontal: 3 },
  otherSide: { transform: [{ rotate: '180deg' }] },
  book: { flex: 1, maxWidth: 20, borderRadius: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  centerRail: { height: 4, backgroundColor: '#8e6342', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#724c32' },
  shelfEnd: { height: 3, marginTop: 3, backgroundColor: '#80583a', borderRadius: 2 },
  entry: { height: 25, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderColor: '#c7b69e', position: 'relative' },
  doorGap: { position: 'absolute', top: -2, width: 48, height: 5, backgroundColor: '#e8dfd1' },
  doorArc: { position: 'absolute', top: -7, width: 48, height: 15, borderTopWidth: 1, borderColor: '#aa9377', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  entryText: { color: '#806b54', fontSize: 8, fontWeight: '800', letterSpacing: 1.5 },
  roomNote: { color: '#806b54', fontSize: 10, textAlign: 'center', paddingTop: 2 },
});
