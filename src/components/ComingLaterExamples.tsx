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
  {
    name: 'Maja',
    books: [
      book(-101, 'Piranesi', 'Clarke', ['#2b3a67', '#e8c875'], 272, 216),
      book(-102, 'Circe', 'Miller', ['#c4622d', '#1c1c1c'], 400, 203, 'reading'),
      book(-103, 'Middlemarch', 'Eliot', ['#7d5a3c', '#e3c27a'], 880, 198, 'owned'),
      book(-104, 'Normal People', 'Rooney', ['#6b8f5e', '#e8e0cf'], 270, 198),
      book(-105, 'Rebecca', 'du Maurier', ['#3a3a3a', '#d9a441'], 430, 178, 'want'),
    ],
  },
  {
    name: 'Tom',
    books: [
      book(-111, 'Dune', 'Herbert', ['#b3202a', '#e9dcc0'], 688, 175),
      book(-112, 'Neuromancer', 'Gibson', ['#1f3a5f', '#5b7fa6'], 271, 175),
      book(-113, 'Foundation', 'Asimov', ['#264653', '#e3c27a'], 255, 172, 'reading'),
      book(-114, 'Hyperion', 'Simmons', ['#3b2f5c', '#c9b6e4'], 482, 175, 'owned'),
      book(-115, 'Solaris', 'Lem', ['#4d6d73', '#e8e0cf'], 204, 198),
    ],
  },
  {
    name: 'Elin',
    books: [
      book(-121, 'Emma', 'Austen', ['#2f6b5e', '#e8c875'], 474, 198),
      book(-122, 'Jane Eyre', 'Brontë', ['#7a1f1f', '#e9dcc0'], 532, 198, 'reading'),
      book(-123, 'Beloved', 'Morrison', ['#8c3b6b', '#e8e0cf'], 324, 203),
      book(-124, 'Persuasion', 'Austen', ['#a07850', '#2b2a33'], 249, 178, 'want'),
      book(-125, 'Stoner', 'Williams', ['#bb3e03', '#1c1c1c'], 288, 203, 'owned'),
    ],
  },
];

/** A room of shelves, one per friend, with their name on the plate. */
export function FriendsLibraryExample() {
  return (
    <View style={styles.room}>
      {FRIENDS.map((f) => (
        <TourShelf key={f.name} height={84} scale={0.5} label={`Example shelf: ${f.name}'s books`} slots={[{ books: f.books, caption: f.name }]} />
      ))}
    </View>
  );
}

/** A record sleeve facing out, with the record half pulled out of its side. */
function RecordSleeve({ colors }: { colors: readonly [string, string] }) {
  return (
    <View style={styles.sleeveSlot}>
      <View style={styles.record}>
        <View style={[styles.recordLabel, { backgroundColor: colors[1] }]} />
      </View>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sleeve} />
    </View>
  );
}

/** Thin spines of record sleeves, standing next to the one facing out. */
function RecordSpines({ colors }: { colors: string[] }) {
  return colors.map((c) => <View key={c} style={[styles.recordSpine, { backgroundColor: c }]} />);
}

/** Plastic DVD cases with a coloured insert and a pale band at the top. */
function DvdCases({ colors }: { colors: string[] }) {
  return colors.map((c) => (
    <View key={c} style={styles.dvd}>
      <View style={[styles.dvdInsert, { backgroundColor: c }]}>
        <View style={styles.dvdBand} />
      </View>
    </View>
  ));
}

/** Books, records and films side by side on one shelf. */
export function VinylAndDvdExample() {
  return (
    <TourShelf
      height={118}
      scale={0.55}
      label="Example shelf: two books, then record sleeves with one record half out of its sleeve, then DVD cases"
      slots={[
        { books: [again(FRIENDS[0].books[0], -141), again(FRIENDS[1].books[0], -142)], caption: 'Books' },
        {
          extras: (
            <>
              <RecordSleeve colors={['#d89a3b', '#7a1f1f']} />
              <RecordSpines colors={['#1f3a5f', '#e8e0cf', '#2f4a3a']} />
            </>
          ),
          caption: 'Vinyl',
        },
        { extras: <DvdCases colors={['#9b2226', '#1c1c1c', '#2e5c8a', '#e3c27a']} />, caption: 'DVDs' },
      ]}
    />
  );
}

const CLUB = ['M', 'T', 'E', 'S'];

/** A club's members over the one shelf they all share. */
export function BookClubExample() {
  return (
    <View style={styles.club}>
      <View style={styles.members}>
        {CLUB.map((initial) => (
          <View key={initial} style={styles.member}>
            <Text style={styles.memberText}>{initial}</Text>
          </View>
        ))}
        <Text style={styles.clubName}>Thursday club · 4 members</Text>
      </View>
      <TourShelf
        height={150}
        scale={0.75}
        label="Example shelf: a book club's shared shelf, the same for all four members"
        slots={[{ books: [again(FRIENDS[2].books[1], -151), again(FRIENDS[0].books[1], -152), again(FRIENDS[1].books[4], -153), again(FRIENDS[0].books[3], -154)], caption: 'Club shelf', note: 'Synced: everyone sees the same books' }]}
      />
    </View>
  );
}

/** Books you've read, and ones suggested because of them, drawn as outlines because they aren't yours yet. */
export function SuggestedReadingExample() {
  return (
    <TourShelf
      height={150}
      scale={0.7}
      label="Example shelf: three books you've read, and two suggested books drawn as outlines"
      slots={[
        { books: [again(FRIENDS[0].books[0], -161), again(FRIENDS[2].books[2], -162), again(FRIENDS[1].books[1], -163)], caption: 'Your shelf' },
        {
          books: [book(-131, 'Jonathan Strange', 'Clarke', ['#2f4a3a', '#e3c27a'], 1006, 190, 'want', false), book(-132, 'The Night Circus', 'Morgenstern', ['#1c1c1c', '#e8e0cf'], 400, 203, 'want', false)],
          caption: 'Suggested',
          note: 'Because you read Piranesi',
        },
      ]}
    />
  );
}

/** A plan across one month: one book after another, a few pages a day. */
const PLAN = [
  { title: 'Piranesi', color: '#2b3a67', pages: 272, from: 2, to: 13 },
  { title: 'Dune', color: '#b3202a', pages: 688, from: 15, to: 28 },
];
const DAYS = 30;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** A month view with each book's days marked, and how many pages a day that comes to. */
export function ReadingCalendarExample() {
  const weeks = Array.from({ length: Math.ceil(DAYS / 7) }, (_, w) => Array.from({ length: 7 }, (_, d) => w * 7 + d + 1));
  return (
    <View
      style={styles.calendar}
      accessible
      accessibilityLabel="Example calendar: Piranesi spread over days 2 to 13 of a month, then Dune over days 15 to 28">
      <View style={styles.week}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[styles.cell, styles.weekday]}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]} style={styles.week}>
          {week.map((day) => {
            const plan = PLAN.find((p) => day >= p.from && day <= p.to);
            return (
              <View key={day} style={styles.cell}>
                {day <= DAYS && <Text style={styles.day}>{day}</Text>}
                <View style={[styles.bar, plan && { backgroundColor: plan.color }]} />
              </View>
            );
          })}
        </View>
      ))}
      <View style={styles.legend}>
        {PLAN.map((p) => (
          <View key={p.title} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: p.color }]} />
            <Text style={styles.legendText}>
              {p.title} · {Math.round(p.pages / (p.to - p.from + 1))} pages a day
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  room: { gap: 4 },
  sleeveSlot: { width: 84, height: 60, marginRight: 3 },
  record: {
    position: 'absolute',
    top: 3,
    left: 30,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#111',
    borderWidth: 6,
    borderColor: '#1d1d1d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordLabel: { width: 16, height: 16, borderRadius: 8 },
  sleeve: { position: 'absolute', bottom: 0, left: 0, width: 60, height: 60, borderRadius: 2 },
  recordSpine: { width: 4, height: 60, marginRight: 1, borderRadius: 1 },
  dvd: { width: 9, height: 80, marginRight: 1, padding: 1, borderRadius: 2, backgroundColor: '#15171a' },
  dvdInsert: { flex: 1, borderRadius: 1, overflow: 'hidden' },
  dvdBand: { height: 8, backgroundColor: 'rgba(255,255,255,0.75)' },
  club: { gap: 10 },
  members: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  member: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberText: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  clubName: { color: Colors.textMuted, fontSize: 13, marginLeft: 4 },
  calendar: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 320,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  week: { flexDirection: 'row' },
  cell: { flex: 1, height: 30, alignItems: 'center', justifyContent: 'center' },
  weekday: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center', height: 20 },
  day: { color: Colors.text, fontSize: 12 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 2, height: 4 },
  legend: { marginTop: 10, gap: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 12, height: 4, borderRadius: 1 },
  legendText: { color: Colors.textMuted, fontSize: 13 },
});
