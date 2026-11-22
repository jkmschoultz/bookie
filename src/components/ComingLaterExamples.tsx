import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { COVER_ASPECT, Cover } from '@/components/Cover';
import { TourShelf, exampleBook } from '@/components/TourShelf';
import { Colors } from '@/constants/theme';
import { sampleBooks } from '@/library/sampleBooks';
import type { Book, ReadStatus } from '@/types';

/** A made-up book for these pictures. Ids are negative and unused elsewhere, so they never clash with real books. */
const book = (id: number, title: string, author: string, palette: string[], pageCount: number, heightMm: number, status: ReadStatus = 'read', owned = true) =>
  exampleBook({ id, title, author, palette, pageCount, heightMm, status, owned });

/** The same made-up book under another id, so no id is drawn twice while every page of the preview is mounted. */
const again = (b: Book, id: number): Book => ({ ...b, id });

const EXAMPLE_SHELVES = [
  { books: [book(-101, 'Piranesi', 'Clarke', ['#2b3a67', '#e8c875'], 272, 216), book(-102, 'Circe', 'Miller', ['#c4622d', '#1c1c1c'], 400, 203, 'reading'), book(-103, 'Middlemarch', 'Eliot', ['#7d5a3c', '#e3c27a'], 880, 198, 'owned'), book(-104, 'Normal People', 'Rooney', ['#6b8f5e', '#e8e0cf'], 270, 198), book(-105, 'Rebecca', 'du Maurier', ['#3a3a3a', '#d9a441'], 430, 178, 'want')] },
  { books: [book(-111, 'Dune', 'Herbert', ['#b3202a', '#e9dcc0'], 688, 175), book(-112, 'Neuromancer', 'Gibson', ['#1f3a5f', '#5b7fa6'], 271, 175), book(-113, 'Foundation', 'Asimov', ['#264653', '#e3c27a'], 255, 172, 'reading'), book(-114, 'Hyperion', 'Simmons', ['#3b2f5c', '#c9b6e4'], 482, 175, 'owned'), book(-115, 'Solaris', 'Lem', ['#4d6d73', '#e8e0cf'], 204, 198)] },
  { books: [book(-121, 'Emma', 'Austen', ['#2f6b5e', '#e8c875'], 474, 198), book(-122, 'Jane Eyre', 'Brontë', ['#7a1f1f', '#e9dcc0'], 532, 198, 'reading'), book(-123, 'Beloved', 'Morrison', ['#8c3b6b', '#e8e0cf'], 324, 203), book(-124, 'Persuasion', 'Austen', ['#a07850', '#2b2a33'], 249, 178, 'want'), book(-125, 'Stoner', 'Williams', ['#bb3e03', '#1c1c1c'], 288, 203, 'owned')] },
];

/** A record sleeve facing out, with the record half pulled out of its side. */
function RecordSleeve({ colors }: { colors: readonly [string, string] }) {
  return <View style={styles.sleeveSlot}><View style={styles.record}><View style={[styles.recordLabel, { backgroundColor: colors[1] }]} /></View><LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sleeve} /></View>;
}
function RecordSpines({ colors }: { colors: string[] }) { return colors.map((c, i) => <View key={`${c}-${i}`} style={[styles.recordSpine, { backgroundColor: c }]} />); }
function DvdCases({ colors }: { colors: string[] }) { return colors.map((c, i) => <View key={`${c}-${i}`} style={styles.dvd}><View style={[styles.dvdInsert, { backgroundColor: c }]}><View style={styles.dvdBand} /></View></View>); }

/** Books, records and films side by side on one shelf. */
export function VinylAndDvdExample() {
  return <TourShelf height={118} scale={0.55} label="Example shelf: two books, then record sleeves with one record half out of its sleeve, then DVD cases" slots={[{ books: [again(EXAMPLE_SHELVES[0].books[0], -141), again(EXAMPLE_SHELVES[1].books[0], -142)], caption: 'Books' }, { extras: <><RecordSleeve colors={['#d89a3b', '#7a1f1f']} /><RecordSpines colors={['#1f3a5f', '#e8e0cf', '#2f4a3a']} /></>, caption: 'Vinyl' }, { extras: <DvdCases colors={['#9b2226', '#1c1c1c', '#2e5c8a', '#e3c27a']} />, caption: 'DVDs' }]} />;
}

const CLUB = ['M', 'T', 'E', 'S'];
export function BookClubExample() {
  return <View style={styles.club}><View style={styles.members}>{CLUB.map((initial, i) => <View key={`${initial}-${i}`} style={styles.member}><Text style={styles.memberText}>{initial}</Text></View>)}<Text style={styles.clubName}>Thursday club · 4 members</Text></View><TourShelf height={150} scale={0.75} label="Example shelf: a book club's shared shelf, the same for all four members" slots={[{ books: [again(EXAMPLE_SHELVES[2].books[1], -151), again(EXAMPLE_SHELVES[0].books[1], -152), again(EXAMPLE_SHELVES[1].books[4], -153), again(EXAMPLE_SHELVES[0].books[3], -154)], caption: 'Club shelf', note: 'Synced: everyone sees the same books' }]} /></View>;
}

export function SuggestedReadingExample() {
  return <TourShelf height={150} scale={0.7} label="Example shelf: three books you've read, and two suggested books drawn as outlines" slots={[{ books: [again(EXAMPLE_SHELVES[0].books[0], -161), again(EXAMPLE_SHELVES[2].books[2], -162), again(EXAMPLE_SHELVES[1].books[1], -163)], caption: 'Your shelf' }, { books: [book(-131, 'Jonathan Strange', 'Clarke', ['#2f4a3a', '#e3c27a'], 1006, 190, 'want', false), book(-132, 'The Night Circus', 'Morgenstern', ['#1c1c1c', '#e8e0cf'], 400, 203, 'want', false)], caption: 'Suggested', note: 'Because you read Piranesi' }]} />;
}

/** Two sample books, drawn with their real covers when online and the app's cloth covers when not. */
const SAMPLES = sampleBooks();
const sample = (title: string, id: number): Book => ({ ...SAMPLES.find((b) => b.title === title)!, id });
const PLAN = [
  { book: sample('Piranesi', -171), from: 2, to: 13 },
  { book: sample('Dune', -172), from: 15, to: 28 },
];
const DAYS = 30;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Covers are drawn at a normal size and shrunk, so a tiny one still looks just like the app's cover (image or cloth). */
const COVER_DRAWN = 120;
function SmallCover({ book: b, width }: { book: Book; width: number }) {
  const height = width * COVER_ASPECT;
  return (
    <View style={{ width, height }}>
      <View style={{ position: 'absolute', left: (width - COVER_DRAWN) / 2, top: (height - COVER_DRAWN * COVER_ASPECT) / 2, transform: [{ scale: width / COVER_DRAWN }] }}>
        <Cover book={b} width={COVER_DRAWN} />
      </View>
    </View>
  );
}

/** A month's reading plan: each book's cover sits on the days set aside for it. */
export function ReadingCalendarExample() {
  const weeks = Array.from({ length: Math.ceil(DAYS / 7) }, (_, w) => Array.from({ length: 7 }, (_, d) => w * 7 + d + 1));
  return (
    <View style={styles.calendar} accessible accessibilityLabel="Example reading calendar: the cover of Piranesi on days 2 to 13, and the cover of Dune on days 15 to 28">
      <View style={styles.monthHeading}><Text style={styles.monthName}>A READING MONTH</Text></View>
      <View style={styles.week}>{WEEKDAYS.map((d, i) => <Text key={i} style={[styles.weekday, { flex: 1 }]}>{d}</Text>)}</View>
      {weeks.map((week) => <View key={week[0]} style={styles.week}>{week.map((day) => {
        const plan = PLAN.find((p) => day >= p.from && day <= p.to);
        return <View key={day} style={styles.calendarCell}>
          {day <= DAYS && <Text style={styles.day}>{day}</Text>}
          {plan && <SmallCover book={plan.book} width={22} />}
        </View>;
      })}</View>)}
      <View style={styles.legend}>{PLAN.map(({ book: b, from, to }) => <View key={b.id} style={styles.legendRow}><SmallCover book={b} width={18} /><Text style={styles.legendText}>{b.title} · {Math.round((b.pageCount ?? 0) / (to - from + 1))} pages a day</Text></View>)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  week: { flexDirection: 'row' },
  weekday: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', textAlign: 'center', height: 18 },
  calendarCell: { flex: 1, height: 52, alignItems: 'center', paddingTop: 1 },
  day: { color: Colors.text, fontSize: 9, alignSelf: 'flex-start', marginLeft: 2 },
  legend: { marginTop: 7, gap: 5 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendText: { color: Colors.textMuted, fontSize: 11 },
});
