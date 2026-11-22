import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { SpineFace } from '@/components/shelf/Spine';
import { exampleBook } from '@/components/TourShelf';
import { Colors } from '@/constants/theme';
import { spineCues } from '@/shelf/spineCues';
import { getSpineStyle } from '@/shelf/spineStyle';

/** A wood style: the face of the wood, its lit and shaded sides, the inside back, and the grain lines (none when painted). */
interface Finish {
  name: string;
  face: string;
  top: string;
  side: string;
  back: readonly [string, string];
  grain: string | null;
}

const FINISHES: Finish[] = [
  { name: 'Oak', face: '#c08a52', top: '#d9a96f', side: '#946234', back: ['#4a3019', '#5c3d21'], grain: 'rgba(110,62,24,0.32)' },
  { name: 'Walnut', face: '#6e4529', top: '#8a5a38', side: '#4a2c18', back: ['#1f130a', '#2b1b0f'], grain: 'rgba(28,14,5,0.45)' },
  { name: 'Painted', face: '#e9e3d6', top: '#f7f3ea', side: '#c4bba9', back: ['#8fa597', '#a2b6a8'], grain: null },
];
const SELECTED = 'Walnut';

/** The same few made-up books on every bookcase, so only the wood differs. */
const BOOKS = [
  exampleBook({ id: -301, title: 'Piranesi', author: 'Clarke', palette: ['#2b3a67', '#e8c875'], pageCount: 272, heightMm: 216 }),
  exampleBook({ id: -302, title: 'Circe', author: 'Miller', palette: ['#c4622d', '#1c1c1c'], pageCount: 400, heightMm: 203, status: 'reading' }),
  exampleBook({ id: -303, title: 'Dune', author: 'Herbert', palette: ['#b3202a', '#e9dcc0'], pageCount: 688, heightMm: 175 }),
  exampleBook({ id: -304, title: 'Emma', author: 'Austen', palette: ['#2f6b5e', '#e8c875'], pageCount: 474, heightMm: 198 }),
  exampleBook({ id: -305, title: 'Solaris', author: 'Lem', palette: ['#4d6d73', '#e8e0cf'], pageCount: 204, heightMm: 198 }),
  exampleBook({ id: -306, title: 'Beloved', author: 'Morrison', palette: ['#8c3b6b', '#e8e0cf'], pageCount: 324, heightMm: 203 }),
  exampleBook({ id: -307, title: 'Stoner', author: 'Williams', palette: ['#bb3e03', '#1c1c1c'], pageCount: 288, heightMm: 203 }),
  exampleBook({ id: -308, title: 'Hyperion', author: 'Simmons', palette: ['#3b2f5c', '#c9b6e4'], pageCount: 482, heightMm: 175, status: 'owned' }),
];
const BOOK_SCALE = 0.24;

const CASE = { width: 88, height: 150, depth: 11, post: 6, crown: 8, base: 10, plank: 5 };
const ROW_HEIGHT = (CASE.height - CASE.crown - CASE.base) / 2;

function Books({ from, to }: { from: number; to: number }) {
  return BOOKS.slice(from, to).map((book) => {
    const style = getSpineStyle(book, BOOK_SCALE);
    return (
      <View key={book.id} style={{ width: style.width, height: style.height, opacity: spineCues(book).opacity }}>
        <SpineFace book={book} style={style} />
      </View>
    );
  });
}

/** Thin, slightly uneven lines along a plank or post. */
function Grain({ color, vertical }: { color: string; vertical?: boolean }) {
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {[0.18, 0.37, 0.52, 0.71, 0.86].map((at, i) => (
        <View
          key={at}
          style={[
            { position: 'absolute', backgroundColor: color, borderRadius: 1 },
            vertical
              ? { top: `${i * 9}%`, bottom: `${(4 - i) * 6}%`, left: `${at * 100}%`, width: i % 2 ? 0.6 : 1 }
              : { left: `${i * 11}%`, right: `${(4 - i) * 7}%`, top: `${at * 100}%`, height: i % 2 ? 0.6 : 1 },
          ]}
        />
      ))}
    </View>
  );
}

/** A plank or post of this finish, with its grain. */
function Wood({ finish, style, vertical }: { finish: Finish; style: object; vertical?: boolean }) {
  return (
    <View style={[{ backgroundColor: finish.face }, style]}>
      {finish.grain && <Grain color={finish.grain} vertical={vertical} />}
    </View>
  );
}

function Plant() {
  const leaves = [-62, -34, -8, 16, 42, 66];
  return (
    <View style={decor.plant}>
      {leaves.map((deg, i) => (
        <View key={deg} style={[decor.leaf, { backgroundColor: i % 2 ? '#4f8a4a' : '#3d7339', height: 15 + (i % 3) * 3, transform: [{ rotate: `${deg}deg` }, { translateY: -7 }] }]} />
      ))}
      <View style={decor.potRim} />
      <View style={decor.pot} />
    </View>
  );
}

function Frame() {
  return (
    <View style={decor.frame}>
      <LinearGradient colors={['#9cc3d9', '#e6d3a3']} style={decor.picture}>
        <View style={decor.sun} />
        <View style={decor.hill} />
      </LinearGradient>
    </View>
  );
}

function Bookend() {
  return (
    <View style={decor.bookend}>
      <LinearGradient colors={['#5b5e63', '#a7adb3', '#4a4d52']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={decor.bookendPlate} />
      <View style={decor.bookendFoot} />
    </View>
  );
}

function Candle() {
  return (
    <View style={decor.candle}>
      <View style={decor.flameGlow} />
      <View style={decor.flame} />
      <View style={decor.wax} />
      <View style={decor.holder} />
    </View>
  );
}

function Globe() {
  return (
    <View style={decor.globe}>
      <View style={decor.ball}>
        <View style={[decor.land, { top: 4, left: 3, width: 8, height: 6 }]} />
        <View style={[decor.land, { top: 11, left: 10, width: 7, height: 5 }]} />
      </View>
      <View style={decor.stand} />
      <View style={decor.standBase} />
    </View>
  );
}

/**
 * One small bookcase in a wood finish, drawn at a slight angle: the front, with its top and right side running back,
 * and the same books and ornaments on its two shelves.
 */
function SmallBookcase({ finish }: { finish: Finish }) {
  const { width, height, depth, post, crown, base, plank } = CASE;
  return (
    <View style={{ width: width + depth, height: height + depth }}>
      {/* The top and the side, sheared back to give the case depth. */}
      <View style={{ position: 'absolute', left: depth / 2, top: 0, width, height: depth, backgroundColor: finish.top, transform: [{ skewX: '-45deg' }] }} />
      <View style={{ position: 'absolute', left: width, top: depth / 2, width: depth, height, backgroundColor: finish.side, transform: [{ skewY: '-45deg' }] }} />
      {/* A globe on top. */}
      <View style={{ position: 'absolute', left: width / 2 - 8, top: -20 }}>
        <Globe />
      </View>
      <View style={{ position: 'absolute', left: 0, top: depth, width, height }}>
        <Wood finish={finish} style={{ height: crown }} />
        <View style={{ flex: 1, paddingHorizontal: post }}>
          {[0, 1].map((row) => (
            <View key={row} style={{ height: ROW_HEIGHT }}>
              <LinearGradient colors={finish.back} style={StyleSheet.absoluteFill} />
              {/* Shade under the shelf above and down the left side, where the inside is darker. */}
              <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']} style={decor.insideTop} />
              <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={decor.insideLeft} />
              <View style={decor.shelfItems}>
                {row === 0 ? (
                  <>
                    <Books from={0} to={5} />
                    <Plant />
                  </>
                ) : (
                  <>
                    <Frame />
                    <Bookend />
                    <Books from={5} to={8} />
                    <Candle />
                  </>
                )}
              </View>
              <View style={{ height: 2, backgroundColor: finish.top }} />
              <Wood finish={finish} style={{ height: plank - 2 }} />
            </View>
          ))}
        </View>
        <Wood finish={finish} style={{ height: base }} />
        <Wood finish={finish} vertical style={[decor.post, { left: 0, width: post }]} />
        <Wood finish={finish} vertical style={[decor.post, { right: 0, width: post }]} />
      </View>
    </View>
  );
}

/** The same small bookcase in three wood finishes, with ornaments between the books, and the chosen finish marked. */
export function CustomShelvesExample() {
  return (
    <View
      style={styles.row}
      pointerEvents="none"
      accessible
      accessibilityLabel={`The same bookcase in oak, walnut and painted wood, with a plant, a framed picture, a bookend, a candle and a globe among the books. ${SELECTED} is chosen.`}>
      {FINISHES.map((finish) => {
        const chosen = finish.name === SELECTED;
        return (
          <View key={finish.name} style={styles.choice}>
            <SmallBookcase finish={finish} />
            <View style={[styles.pill, chosen && styles.pillChosen]}>
              <Text style={[styles.pillText, chosen && styles.pillTextChosen]}>{chosen ? `✓ ${finish.name}` : finish.name}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 24 },
  choice: { alignItems: 'center', gap: 10 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  pillChosen: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  pillText: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  pillTextChosen: { color: Colors.accentText },
});

const decor = StyleSheet.create({
  insideTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 12 },
  insideLeft: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 8 },
  shelfItems: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1, paddingHorizontal: 2 },
  post: { position: 'absolute', top: 0, bottom: 0 },
  plant: { width: 22, height: 40, alignItems: 'center', justifyContent: 'flex-end', marginLeft: 3 },
  leaf: { position: 'absolute', bottom: 15, width: 7, borderRadius: 6 },
  potRim: { width: 17, height: 3, backgroundColor: '#c4704a', borderRadius: 1 },
  pot: { width: 13, height: 11, backgroundColor: '#b05f3c', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  frame: { width: 20, height: 25, padding: 3, backgroundColor: '#3a2412', borderRadius: 1, transform: [{ rotate: '-4deg' }], marginRight: 2 },
  picture: { flex: 1, overflow: 'hidden' },
  sun: { position: 'absolute', top: 2, right: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: '#f3c45a' },
  hill: { position: 'absolute', bottom: -6, left: -4, width: 20, height: 12, borderRadius: 10, backgroundColor: '#5f8f4e' },
  bookend: { width: 8, height: 30, justifyContent: 'flex-end', alignItems: 'flex-end' },
  bookendPlate: { flex: 1, width: 3, borderTopLeftRadius: 1, borderTopRightRadius: 1 },
  bookendFoot: { width: 8, height: 2, backgroundColor: '#6f7378' },
  candle: { width: 10, height: 30, alignItems: 'center', justifyContent: 'flex-end', marginLeft: 2 },
  flameGlow: { position: 'absolute', top: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,200,90,0.3)' },
  flame: { width: 4, height: 6, borderRadius: 3, borderTopLeftRadius: 1, backgroundColor: '#ffb53c', transform: [{ rotate: '45deg' }], marginBottom: 1 },
  wax: { width: 5, height: 15, backgroundColor: '#f3ead2' },
  holder: { width: 10, height: 3, borderRadius: 1, backgroundColor: '#b88a36' },
  globe: { width: 20, height: 28, alignItems: 'center' },
  ball: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#3f7fae', overflow: 'hidden', borderWidth: 1, borderColor: '#2a5878' },
  land: { position: 'absolute', borderRadius: 3, backgroundColor: '#7aa860' },
  stand: { width: 3, height: 6, backgroundColor: '#8a6a2c' },
  standBase: { width: 12, height: 3, borderRadius: 1, backgroundColor: '#b88a36' },
});
