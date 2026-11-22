import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { TourShelf, exampleBook } from '@/components/TourShelf';
import { Colors } from '@/constants/theme';
import type { Book, ReadStatus } from '@/types';

/** A made-up book for these pictures. Ids are negative and unused elsewhere, so they never clash with real books. */
const book = (id: number, title: string, author: string, palette: string[], pageCount: number, heightMm: number, status: ReadStatus = 'read', owned = true) =>
  exampleBook({ id, title, author, palette, pageCount, heightMm, status, owned });

/** The same made-up book under another id, so no id is drawn twice while every page of the preview is mounted. */
const again = (b: Book, id: number): Book => ({ ...b, id });

const FRIENDS = [
  { name: 'Maja', color: '#b66b4b', books: [book(-101, 'Piranesi', 'Clarke', ['#2b3a67', '#e8c875'], 272, 216), book(-102, 'Circe', 'Miller', ['#c4622d', '#1c1c1c'], 400, 203, 'reading'), book(-103, 'Middlemarch', 'Eliot', ['#7d5a3c', '#e3c27a'], 880, 198, 'owned'), book(-104, 'Normal People', 'Rooney', ['#6b8f5e', '#e8e0cf'], 270, 198), book(-105, 'Rebecca', 'du Maurier', ['#3a3a3a', '#d9a441'], 430, 178, 'want')] },
  { name: 'Tom', color: '#557d83', books: [book(-111, 'Dune', 'Herbert', ['#b3202a', '#e9dcc0'], 688, 175), book(-112, 'Neuromancer', 'Gibson', ['#1f3a5f', '#5b7fa6'], 271, 175), book(-113, 'Foundation', 'Asimov', ['#264653', '#e3c27a'], 255, 172, 'reading'), book(-114, 'Hyperion', 'Simmons', ['#3b2f5c', '#c9b6e4'], 482, 175, 'owned'), book(-115, 'Solaris', 'Lem', ['#4d6d73', '#e8e0cf'], 204, 198)] },
  { name: 'Elin', color: '#7b6e9a', books: [book(-121, 'Emma', 'Austen', ['#2f6b5e', '#e8c875'], 474, 198), book(-122, 'Jane Eyre', 'Brontë', ['#7a1f1f', '#e9dcc0'], 532, 198, 'reading'), book(-123, 'Beloved', 'Morrison', ['#8c3b6b', '#e8e0cf'], 324, 203), book(-124, 'Persuasion', 'Austen', ['#a07850', '#2b2a33'], 249, 178, 'want'), book(-125, 'Stoner', 'Williams', ['#bb3e03', '#1c1c1c'], 288, 203, 'owned')] },
];

/** A bird's-eye library view: separate bookcases laid out on the floor, one for each friend. */
export function FriendsLibraryExample() {
  return (
    <View style={styles.library} accessible accessibilityLabel="Bird's-eye view of a library with a separate bookcase for each friend: Maja, Tom and Elin">
      <View style={styles.libraryHeader}><Text style={styles.libraryCaption}>YOUR FRIENDS’ LIBRARY</Text><Text style={styles.librarySubcaption}>A little room for everyone</Text></View>
      <View style={styles.bookcaseGrid}>
        {FRIENDS.map((friend) => (
          <View key={friend.name} style={styles.bookcase}>
            <View style={styles.caseLabel}><View style={[styles.avatar, { backgroundColor: friend.color }]}><Text style={styles.avatarText}>{friend.name[0]}</Text></View><Text style={styles.friendName}>{friend.name}</Text></View>
            {[0, 1, 2].map((row) => (
              <View key={row} style={styles.topDownShelf}>
                {friend.books.slice(row === 0 ? 0 : row === 1 ? 2 : 4, row === 0 ? 2 : row === 1 ? 4 : 5).map((b, i) => (
                  <View key={b.id} style={[styles.topDownBook, { backgroundColor: b.coverPalette?.[0] ?? '#78634a', transform: [{ rotate: `${(i % 2 ? 2 : -2)}deg` }] }]}>
                    <View style={[styles.bookGilt, { backgroundColor: b.coverPalette?.[1] ?? '#e8c875' }]} />
                  </View>
                ))}
              </View>
            ))}
            <View style={styles.caseFoot}><Text style={styles.caseFootText}>{friend.books.length} BOOKS · SHARED SHELF</Text></View>
          </View>
        ))}
        <View style={[styles.libraryDetail, styles.plantPot]}><Text style={styles.plantEmoji}>🌿</Text></View>
      </View>
      <View style={styles.floorLegend}><View style={styles.legendDot} /><Text style={styles.floorLegendText}>Each bookcase belongs to a friend</Text></View>
    </View>
  );
}

/** Personalize the shelf with different wood finishes and small decorative touches. */
export function CustomBookshelfExample() {
  const woods = [{ name: 'OAK', color: '#bf8b55' }, { name: 'WALNUT', color: '#78513c' }, { name: 'PAINTED', color: '#738477' }];
  return (
    <View style={styles.customWrap} accessible accessibilityLabel="Custom bookshelf preview with oak, walnut and painted wood choices, plus a plant and framed decor">
      <View style={styles.customShelfTop}><View style={styles.frame}><Text style={styles.frameArt}>☀</Text></View><Text style={styles.decorPlant}>🪴</Text></View>
      <TourShelf height={110} scale={0.55} label="Example bookshelf with books and decorative objects" slots={[{ books: [again(FRIENDS[0].books[0], -181), again(FRIENDS[1].books[0], -182), again(FRIENDS[2].books[1], -183), again(FRIENDS[0].books[2], -184)], caption: 'My reading nook' }]} />
      <View style={styles.woodRow}>{woods.map((wood) => <View key={wood.name} style={styles.woodChoice}><View style={[styles.woodSwatch, { backgroundColor: wood.color }]} /><Text style={styles.woodName}>{wood.name}</Text></View>)}</View>
      <Text style={styles.customHint}>Choose your wood. Add the little things that make it yours.</Text>
    </View>
  );
}

/** A record sleeve facing out, with the record half pulled out of its side. */
function RecordSleeve({ colors }: { colors: readonly [string, string] }) {
  return <View style={styles.sleeveSlot}><View style={styles.record}><View style={[styles.recordLabel, { backgroundColor: colors[1] }]} /></View><LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sleeve} /></View>;
}
function RecordSpines({ colors }: { colors: string[] }) { return colors.map((c, i) => <View key={`${c}-${i}`} style={[styles.recordSpine, { backgroundColor: c }]} />); }
function DvdCases({ colors }: { colors: string[] }) { return colors.map((c, i) => <View key={`${c}-${i}`} style={styles.dvd}><View style={[styles.dvdInsert, { backgroundColor: c }]}><View style={styles.dvdBand} /></View></View>); }

/** Books, records and films side by side on one shelf. */
export function VinylAndDvdExample() {
  return <TourShelf height={118} scale={0.55} label="Example shelf: two books, then record sleeves with one record half out of its sleeve, then DVD cases" slots={[{ books: [again(FRIENDS[0].books[0], -141), again(FRIENDS[1].books[0], -142)], caption: 'Books' }, { extras: <><RecordSleeve colors={['#d89a3b', '#7a1f1f']} /><RecordSpines colors={['#1f3a5f', '#e8e0cf', '#2f4a3a']} /></>, caption: 'Vinyl' }, { extras: <DvdCases colors={['#9b2226', '#1c1c1c', '#2e5c8a', '#e3c27a']} />, caption: 'DVDs' }]} />;
}

const CLUB = ['M', 'T', 'E', 'S'];
export function BookClubExample() {
  return <View style={styles.club}><View style={styles.members}>{CLUB.map((initial, i) => <View key={`${initial}-${i}`} style={styles.member}><Text style={styles.memberText}>{initial}</Text></View>)}<Text style={styles.clubName}>Thursday club · 4 members</Text></View><TourShelf height={150} scale={0.75} label="Example shelf: a book club's shared shelf, the same for all four members" slots={[{ books: [again(FRIENDS[2].books[1], -151), again(FRIENDS[0].books[1], -152), again(FRIENDS[1].books[4], -153), again(FRIENDS[0].books[3], -154)], caption: 'Club shelf', note: 'Synced: everyone sees the same books' }]} /></View>;
}

export function SuggestedReadingExample() {
  return <TourShelf height={150} scale={0.7} label="Example shelf: three books you've read, and two suggested books drawn as outlines" slots={[{ books: [again(FRIENDS[0].books[0], -161), again(FRIENDS[2].books[2], -162), again(FRIENDS[1].books[1], -163)], caption: 'Your shelf' }, { books: [book(-131, 'Jonathan Strange', 'Clarke', ['#2f4a3a', '#e3c27a'], 1006, 190, 'want', false), book(-132, 'The Night Circus', 'Morgenstern', ['#1c1c1c', '#e8e0cf'], 400, 203, 'want', false)], caption: 'Suggested', note: 'Because you read Piranesi' }]} />;
}

const PLAN = [{ title: 'Piranesi', short: 'P', color: '#2b3a67', accent: '#e8c875', pages: 272, from: 2, to: 13 }, { title: 'Dune', short: 'D', color: '#b3202a', accent: '#e9dcc0', pages: 688, from: 15, to: 28 }];
const DAYS = 30;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Month plan with miniature book-cover artwork placed directly on the reading days. */
export function ReadingCalendarExample() {
  const weeks = Array.from({ length: Math.ceil(DAYS / 7) }, (_, w) => Array.from({ length: 7 }, (_, d) => w * 7 + d + 1));
  return (
    <View style={styles.calendar} accessible accessibilityLabel="Example reading calendar with miniature Piranesi cover art on days 2 to 13 and Dune cover art on days 15 to 28">
      <View style={styles.monthHeading}><Text style={styles.monthName}>A READING MONTH</Text><Text style={styles.monthNote}>Two books, one page at a time</Text></View>
      <View style={styles.week}>{WEEKDAYS.map((d, i) => <Text key={i} style={[styles.weekday, { flex: 1 }]}>{d}</Text>)}</View>
      {weeks.map((week) => <View key={week[0]} style={styles.week}>{week.map((day) => {
        const plan = PLAN.find((p) => day >= p.from && day <= p.to);
        return <View key={day} style={styles.calendarCell}>
          {day <= DAYS && <Text style={styles.day}>{day}</Text>}
          {plan && <View style={[styles.coverThumb, { backgroundColor: plan.color }]}><View style={[styles.coverSun, { backgroundColor: plan.accent }]} /><Text style={styles.coverInitial}>{plan.short}</Text></View>}
        </View>;
      })}</View>)}
      <View style={styles.legend}>{PLAN.map((p) => <View key={p.title} style={styles.legendRow}><View style={[styles.legendCover, { backgroundColor: p.color }]}><View style={[styles.legendCoverMark, { backgroundColor: p.accent }]} /></View><Text style={styles.legendText}>{p.title} · {Math.round(p.pages / (p.to - p.from + 1))} pages a day</Text></View>)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  library: { width: '100%', maxWidth: 330, alignSelf: 'center', padding: 12, borderRadius: 16, backgroundColor: '#e9dfcf', borderWidth: 1, borderColor: '#d8c8b1' },
  libraryHeader: { alignItems: 'center', marginBottom: 10 },
  libraryCaption: { color: '#66523d', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  librarySubcaption: { color: '#8a755e', fontSize: 11, marginTop: 2 },
  bookcaseGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  bookcase: { width: '47%', padding: 6, backgroundColor: '#a77a52', borderRadius: 8, borderWidth: 2, borderColor: '#795438', gap: 4, shadowColor: '#493728', shadowOpacity: 0.18, shadowRadius: 3, elevation: 2 },
  caseLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingBottom: 3 },
  avatar: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  friendName: { color: '#fff7eb', fontSize: 11, fontWeight: '800' },
  topDownShelf: { height: 19, backgroundColor: '#e1c49d', borderRadius: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: '#9b714a' },
  topDownBook: { height: 12, flex: 1, maxWidth: 31, borderRadius: 2, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 3 },
  bookGilt: { width: 3, height: 7, borderRadius: 1 },
  caseFoot: { alignItems: 'center', paddingTop: 2 },
  caseFootText: { color: '#fff2df', fontSize: 7, fontWeight: '700', letterSpacing: 0.5 },
  libraryDetail: { width: 39, height: 37, borderRadius: 8, backgroundColor: '#d6c3a9', alignItems: 'center', justifyContent: 'center' },
  plantPot: { borderWidth: 1, borderColor: '#c4ae91' },
  plantEmoji: { fontSize: 22 },
  floorLegend: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 9 },
  legendDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9d704d' },
  floorLegendText: { color: '#806b54', fontSize: 10 },
  customWrap: { gap: 5 },
  customShelfTop: { maxWidth: 320, width: '100%', height: 42, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 28 },
  frame: { width: 33, height: 36, backgroundColor: '#d6b77f', borderWidth: 4, borderColor: '#73543b', alignItems: 'center', justifyContent: 'center' },
  frameArt: { color: '#a35f44', fontSize: 20 },
  decorPlant: { fontSize: 28 },
  woodRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 7 },
  woodChoice: { alignItems: 'center', gap: 3 },
  woodSwatch: { width: 38, height: 18, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  woodName: { color: Colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  customHint: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 3 },
  sleeveSlot: { width: 84, height: 60, marginRight: 3 },
  record: { position: 'absolute', top: 3, left: 30, width: 54, height: 54, borderRadius: 27, backgroundColor: '#111', borderWidth: 6, borderColor: '#1d1d1d', alignItems: 'center', justifyContent: 'center' },
  recordLabel: { width: 16, height: 16, borderRadius: 8 },
  sleeve: { position: 'absolute', bottom: 0, left: 0, width: 60, height: 60, borderRadius: 2 },
  recordSpine: { width: 4, height: 60, marginRight: 1, borderRadius: 1 },
  dvd: { width: 9, height: 80, marginRight: 1, padding: 1, borderRadius: 2, backgroundColor: '#15171a' },
  dvdInsert: { flex: 1, borderRadius: 1, overflow: 'hidden' },
  dvdBand: { height: 8, backgroundColor: 'rgba(255,255,255,0.75)' },
  club: { gap: 10 },
  members: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  member: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.surfaceRaised, borderWidth: 1, borderColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  memberText: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  clubName: { color: Colors.textMuted, fontSize: 13, marginLeft: 4 },
  calendar: { alignSelf: 'center', width: '100%', maxWidth: 320, padding: 10, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  monthHeading: { alignItems: 'center', marginBottom: 8 },
  monthName: { color: Colors.text, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  monthNote: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  week: { flexDirection: 'row' },
  weekday: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', textAlign: 'center', height: 18 },
  calendarCell: { flex: 1, height: 41, alignItems: 'center', paddingTop: 1 },
  day: { color: Colors.text, fontSize: 9, alignSelf: 'flex-start', marginLeft: 2 },
  coverThumb: { width: 20, height: 27, borderRadius: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 1, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  coverSun: { position: 'absolute', width: 8, height: 8, borderRadius: 4, top: 4, right: 3, opacity: 0.9 },
  coverInitial: { color: '#fff8e9', fontFamily: 'Georgia', fontWeight: '700', fontSize: 12 },
  legend: { marginTop: 7, gap: 5 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendCover: { width: 13, height: 17, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  legendCoverMark: { width: 6, height: 6, borderRadius: 3 },
  legendText: { color: Colors.textMuted, fontSize: 11 },
});
