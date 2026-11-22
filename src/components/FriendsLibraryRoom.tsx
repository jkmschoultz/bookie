import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TransformsStyle } from 'react-native';

import { SpineFace } from '@/components/shelf/Spine';
import { Fonts, Wood } from '@/constants/theme';
import { sampleBooks } from '@/library/sampleBooks';
import { spineCues } from '@/shelf/spineCues';
import { getSpineStyle } from '@/shelf/spineStyle';
import type { Book } from '@/types';

/*
 * The room is drawn in one-point perspective, looking in at eye level. Everything is laid out in "world" units around the
 * eye: x to the right, y down, z towards the viewer (so the room lies at negative z). Walls, floor, ceiling and the side
 * bookcases are flat views turned into place with perspective + rotateX/rotateY, all centred on the vanishing point so
 * they share it. Things that face the viewer (back wall, back bookcases, end panels, name plaques) are simply scaled by
 * their depth. Drawn far to near, so nearer things cover farther ones.
 */

/** The picture's size before it is scaled to the page. */
const W = 340;
const H = 330;
/** The vanishing point, at eye level. */
const VX = W / 2;
const VY = 150;
/** Distance from the eye to the picture, in world units. */
const EYE = 320;
const HALF_WIDTH = W / 2;
const FLOOR = H - VY;
const CEILING = -VY;
const DEPTH = 300;

const CASE_HEIGHT = 230;
const CASE_TOP = FLOOR - CASE_HEIGHT;
/** How far a bookcase stands out from the wall. */
const CASE_DEPTH = 36;
const SIDE_CASE = { near: -50, far: -262 };
const BACK_CASE = { width: 96, spacing: 108 };
const SHELVES = 4;
const BOOK_SCALE = 0.19;

/** How much smaller something at depth z (negative, away from the eye) is drawn. */
const depthScale = (z: number) => EYE / (EYE - z);

/** A flat view turned into place in the room. `transform` is applied about the vanishing point. */
function Plane({ width, height, transform, children }: { width: number; height: number; transform: TransformsStyle['transform']; children?: ReactNode }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: VX - width / 2,
        top: VY - height / 2,
        width,
        height,
        transform: [{ perspective: EYE }, ...(transform as object[])] as TransformsStyle['transform'],
      }}>
      {children}
    </View>
  );
}

/** Something facing the viewer, centred on (x, y) at depth z. */
function Facing({ x, y, z, width, height, children }: { x: number; y: number; z: number; width: number; height: number; children?: ReactNode }) {
  const s = depthScale(z);
  return (
    <View style={{ position: 'absolute', left: VX + x * s - width / 2, top: VY + y * s - height / 2, width, height, transform: [{ scale: s }] }}>
      {children}
    </View>
  );
}

interface Friend {
  name: string;
  /** Behind the stand-in silhouette, until a real profile picture takes its place. */
  color: string;
  genres: string[];
  books: Book[];
}

/** Sample books lent to each friend: their favourite genres first, then the rest. Ids are negative and unused elsewhere. */
const SAMPLES = sampleBooks();
function friend(index: number, name: string, color: string, genres: string[]): Friend {
  const mine = SAMPLES.filter((b) => genres.includes(b.genres[0]));
  const rest = SAMPLES.filter((b) => !genres.includes(b.genres[0]));
  const books = [...mine, ...mine, ...rest].map((b, i) => ({
    ...b,
    id: -2000 - index * 200 - i,
    // A friend's shelves only hold books they own.
    status: b.status === 'want' ? 'owned' : b.status,
    owned: true,
  }));
  return { name, color, genres, books };
}

const MAJA = friend(0, 'Maja', '#b66b4b', ['Literary Fiction', 'Classics', 'Poetry']);
const TOM = friend(1, 'Tom', '#557d83', ['Science Fiction']);
const ELIN = friend(2, 'Elin', '#7b6e9a', ['Fantasy', 'Graphic Novels']);
const SAM = friend(3, 'Sam', '#6b8f5e', ['History', 'Science & Nature', 'Psychology', 'Philosophy']);
const NOOR = friend(4, 'Noor', '#a5713a', ['Mystery & Thriller', 'Biography & Memoir', 'Cooking']);

/** The books on one shelf: a shuffled run from the friend's books, as many as fit, with a little room left at the end. */
function shelfBooks(f: Friend, shelf: number, width: number) {
  let seed = (f.books[0].id * 31 + shelf * 977) >>> 0;
  const next = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  const room = width * (0.86 + next() * 0.12);
  const out = [];
  let used = 0;
  for (let n = 0; n < 200; n++) {
    const book = f.books[Math.floor(next() * f.books.length)];
    const style = getSpineStyle(book, BOOK_SCALE);
    if (used + style.width > room) break;
    out.push({ key: `${shelf}-${n}`, book, style });
    used += style.width + 1;
  }
  return out;
}

const POST = 7;
const CROWN = 12;
const BASE = 12;
const PLANK = 6;

/** The front of one friend's bookcase, drawn flat: posts, a crown, and shelves of the app's own spines. */
function CaseFront({ friend: f, width, shade }: { friend: Friend; width: number; shade?: { from: number; to: number; reverse?: boolean } }) {
  const rowHeight = (CASE_HEIGHT - CROWN - BASE) / SHELVES;
  return (
    <View style={{ width, height: CASE_HEIGHT, backgroundColor: Wood.side[1] }}>
      <LinearGradient colors={Wood.plankTop} style={{ height: CROWN }} />
      <View style={{ flex: 1, paddingHorizontal: POST }}>
        {Array.from({ length: SHELVES }, (_, shelf) => (
          <View key={shelf} style={{ height: rowHeight }}>
            <LinearGradient colors={Wood.backPanel} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']} style={styles.shelfShadow} />
            <View style={styles.books}>
              {shelfBooks(f, shelf, width - 2 * POST - 4).map(({ key, book, style }) => (
                <View key={key} style={{ width: style.width, height: style.height, opacity: spineCues(book).opacity }}>
                  <SpineFace book={book} style={style} />
                </View>
              ))}
            </View>
            <LinearGradient colors={Wood.plankTop} style={{ height: 2 }} />
            <LinearGradient colors={Wood.plankFront} style={{ height: PLANK - 2 }} />
          </View>
        ))}
      </View>
      <LinearGradient colors={Wood.plankFront} style={{ height: BASE }} />
      <LinearGradient colors={Wood.side} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.post, { left: 0 }]} />
      <LinearGradient colors={Wood.side} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.post, { right: 0 }]} />
      {shade && (
        <LinearGradient
          colors={[`rgba(10,6,3,${shade.from})`, `rgba(10,6,3,${shade.to})`]}
          start={{ x: shade.reverse ? 1 : 0, y: 0 }}
          end={{ x: shade.reverse ? 0 : 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

const PLAQUE = { width: 98, height: 44 };

/**
 * A friend's name plaque on top of their bookcase, with a framed round picture. There are no profile pictures yet, so a
 * plain silhouette stands in for one.
 */
function Plaque({ friend: f }: { friend: Friend }) {
  return (
    <View style={styles.plaqueWrap}>
      <LinearGradient colors={Wood.brass} style={styles.plaque}>
        <View style={styles.photoFrame}>
          <View style={[styles.photo, { backgroundColor: f.color }]}>
            <View style={styles.head} />
            <View style={styles.shoulders} />
          </View>
        </View>
        <Text numberOfLines={1} style={styles.name}>
          {f.name}
        </Text>
      </LinearGradient>
      <View style={styles.plaqueFeet}>
        <View style={styles.plaqueFoot} />
        <View style={styles.plaqueFoot} />
      </View>
    </View>
  );
}

const SIDE_LENGTH = SIDE_CASE.near - SIDE_CASE.far;
const SIDE_MID = (SIDE_CASE.near + SIDE_CASE.far) / 2;
const CASE_MID_Y = CASE_TOP + CASE_HEIGHT / 2;
const FRONT_X = HALF_WIDTH - CASE_DEPTH;

/** A bookcase along a side wall: its front turned to face the aisle, the end panel facing us, and a plaque on top. */
function SideCase({ friend: f, side }: { friend: Friend; side: -1 | 1 }) {
  const left = side === -1;
  const endZ = SIDE_CASE.near;
  return (
    <>
      <Plane
        width={SIDE_LENGTH}
        height={CASE_HEIGHT}
        // On the left wall the near end is the view's left edge; on the right wall it is the right edge.
        transform={[{ translateX: side * FRONT_X }, { translateY: CASE_MID_Y }, { rotateY: left ? '90deg' : '-90deg' }, { translateX: left ? -SIDE_MID : SIDE_MID }]}>
        <CaseFront friend={f} width={SIDE_LENGTH} shade={{ from: 0, to: 0.5, reverse: !left }} />
      </Plane>
      <Facing x={side * (HALF_WIDTH - CASE_DEPTH / 2)} y={CASE_MID_Y} z={endZ} width={CASE_DEPTH} height={CASE_HEIGHT}>
        <LinearGradient colors={left ? ['#7a4f2d', '#5a381f'] : ['#5a381f', '#7a4f2d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.endPanel}>
          <View style={styles.endTrim} />
        </LinearGradient>
      </Facing>
      <Facing x={side * (FRONT_X + 6)} y={CASE_TOP - PLAQUE.height / 2 - 6} z={endZ - 4} width={PLAQUE.width} height={PLAQUE.height + 6}>
        <Plaque friend={f} />
      </Facing>
    </>
  );
}

/** A bookcase against the back wall, facing us, with its plaque on top. */
function BackCase({ friend: f, x }: { friend: Friend; x: number }) {
  const z = -DEPTH + CASE_DEPTH;
  return (
    <>
      <Facing x={x} y={CASE_MID_Y} z={z} width={BACK_CASE.width} height={CASE_HEIGHT}>
        <View style={styles.backCaseShadow} />
        <CaseFront friend={f} width={BACK_CASE.width} shade={{ from: 0.28, to: 0.28 }} />
      </Facing>
      <Facing x={x} y={CASE_TOP - PLAQUE.height / 2 - 6} z={z} width={PLAQUE.width} height={PLAQUE.height + 6}>
        <Plaque friend={f} />
      </Facing>
    </>
  );
}

const BOARDS = 10;

function Floor() {
  const board = (2 * HALF_WIDTH) / BOARDS;
  return (
    <Plane width={2 * HALF_WIDTH} height={DEPTH} transform={[{ translateY: FLOOR }, { rotateX: '90deg' }, { translateY: -DEPTH / 2 }]}>
      {/* Boards run away from us, so their seams meet at the vanishing point. */}
      <View style={styles.boards}>
        {Array.from({ length: BOARDS }, (_, i) => (
          <View key={i} style={[styles.board, { width: board, backgroundColor: i % 3 === 0 ? '#7d522f' : i % 3 === 1 ? '#8a5c35' : '#734a2a' }]}>
            {[0.18, 0.47, 0.79].map((at, j) => (
              <View key={j} style={[styles.boardJoint, { top: `${((at + i * 0.137) % 1) * 100}%` }]} />
            ))}
          </View>
        ))}
      </View>
      {/* A rug down the aisle, and the bookcases' shadows on the floor. */}
      <View style={styles.rug}>
        <View style={styles.rugInner} />
      </View>
      <LinearGradient colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.caseShadow, { left: CASE_DEPTH }]} />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.caseShadow, { right: CASE_DEPTH }]} />
      <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']} style={styles.backShadow} />
      {/* Darker farther away, lit warmly near the lamp. */}
      <LinearGradient colors={['rgba(12,7,3,0.62)', 'rgba(12,7,3,0.15)', 'rgba(12,7,3,0)']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
    </Plane>
  );
}

function Ceiling() {
  return (
    <Plane width={2 * HALF_WIDTH} height={DEPTH} transform={[{ translateY: CEILING }, { rotateX: '-90deg' }, { translateY: DEPTH / 2 }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2a1c13' }]} />
      {[0.12, 0.38, 0.64, 0.9].map((at) => (
        <View key={at} style={[styles.beam, { top: `${at * 100}%` }]} />
      ))}
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFill} />
    </Plane>
  );
}

function SideWall({ side }: { side: -1 | 1 }) {
  const left = side === -1;
  return (
    <Plane
      width={DEPTH}
      height={FLOOR - CEILING}
      transform={[{ translateX: side * HALF_WIDTH }, { translateY: (FLOOR + CEILING) / 2 }, { rotateY: left ? '90deg' : '-90deg' }, { translateX: left ? DEPTH / 2 : -DEPTH / 2 }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#4b3526' }]} />
      <View style={styles.wallRail} />
      <View style={styles.baseboard} />
      <LinearGradient colors={['rgba(10,6,3,0.05)', 'rgba(10,6,3,0.6)']} start={{ x: left ? 0 : 1, y: 0 }} end={{ x: left ? 1 : 0, y: 0 }} style={StyleSheet.absoluteFill} />
    </Plane>
  );
}

function BackWall() {
  return (
    <Facing x={0} y={(FLOOR + CEILING) / 2} z={-DEPTH} width={2 * HALF_WIDTH} height={FLOOR - CEILING}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#3a291d' }]} />
      <View style={styles.wallRail} />
      <View style={styles.baseboard} />
    </Facing>
  );
}

/** A pendant lamp hanging over the aisle, with a soft glow. */
function Lamp() {
  return (
    <Facing x={0} y={-112} z={-140} width={140} height={120}>
      <View style={styles.glow} />
      <View style={styles.cord} />
      <View style={styles.shade} />
      <View style={styles.bulb} />
    </Facing>
  );
}

/** Looking into a library room at eye level: a bookcase for each friend, each with their name and picture on top. */
export function FriendsLibraryRoom() {
  const [width, setWidth] = useState(W);
  const k = width / W;
  return (
    <View
      style={[styles.frame, { height: H * k }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      pointerEvents="none"
      accessible
      accessibilityLabel="A library room seen from the doorway: five bookcases full of books, two along the side walls and three against the back wall. Each bookcase belongs to a friend and has a name plaque with a round photo on top: Maja, Tom, Elin, Sam and Noor.">
      <View style={[styles.room, { left: (width - W) / 2, top: (H * k - H) / 2, transform: [{ scale: k }] }]}>
        <Ceiling />
        <BackWall />
        <Floor />
        <SideWall side={-1} />
        <SideWall side={1} />
        <BackCase friend={TOM} x={-BACK_CASE.spacing} />
        <BackCase friend={ELIN} x={0} />
        <BackCase friend={SAM} x={BACK_CASE.spacing} />
        <SideCase friend={MAJA} side={-1} />
        <SideCase friend={NOOR} side={1} />
        <Lamp />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', maxWidth: 432, alignSelf: 'center', borderRadius: 14, overflow: 'hidden', backgroundColor: '#1a120c' },
  room: { position: 'absolute', width: W, height: H },
  shelfShadow: { position: 'absolute', top: 0, left: 0, right: 0, height: 10 },
  books: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1, paddingHorizontal: 2 },
  post: { position: 'absolute', top: 0, bottom: 0, width: POST },
  endPanel: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  endTrim: { position: 'absolute', left: 4, right: 4, top: CROWN, bottom: BASE, borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)', borderRadius: 2 },
  backCaseShadow: { position: 'absolute', left: -6, right: -6, bottom: -4, height: 14, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.45)' },
  plaqueWrap: { flex: 1, alignItems: 'center' },
  plaque: {
    width: PLAQUE.width,
    height: PLAQUE.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 5,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#7a5a22',
  },
  photoFrame: { width: 34, height: 34, borderRadius: 17, padding: 2.5, backgroundColor: '#4f311b' },
  photo: { flex: 1, borderRadius: 15, overflow: 'hidden', alignItems: 'center' },
  head: { width: 11, height: 11, borderRadius: 6, marginTop: 5, backgroundColor: 'rgba(255,245,228,0.85)' },
  shoulders: { width: 22, height: 16, borderRadius: 11, marginTop: 2, backgroundColor: 'rgba(255,245,228,0.85)' },
  name: { flexShrink: 1, color: Wood.brassText, fontFamily: Fonts.serif, fontSize: 17, fontWeight: '700' },
  plaqueFeet: { flexDirection: 'row', gap: 50 },
  plaqueFoot: { width: 4, height: 6, backgroundColor: '#5a3c14' },
  boards: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  board: { height: '100%', borderRightWidth: 1, borderRightColor: 'rgba(30,16,6,0.55)' },
  boardJoint: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(30,16,6,0.5)' },
  rug: { position: 'absolute', left: 112, right: 112, top: 40, bottom: 26, padding: 6, backgroundColor: '#6e2a22', borderRadius: 2 },
  rugInner: { flex: 1, borderWidth: 2, borderColor: '#c99a4a', backgroundColor: '#7d3328' },
  caseShadow: { position: 'absolute', width: 28, top: DEPTH + SIDE_CASE.far, bottom: -SIDE_CASE.near },
  backShadow: { position: 'absolute', left: 0, right: 0, top: CASE_DEPTH, height: 24 },
  beam: { position: 'absolute', left: 0, right: 0, height: 14, backgroundColor: '#3b281a', borderBottomWidth: 2, borderBottomColor: '#1c120b' },
  wallRail: { position: 'absolute', left: 0, right: 0, top: 70, height: 5, backgroundColor: '#5e4330' },
  baseboard: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 14, backgroundColor: '#2c1d13' },
  glow: { position: 'absolute', left: 10, top: 20, width: 120, height: 100, borderRadius: 60, backgroundColor: 'rgba(255,214,140,0.07)' },
  cord: { position: 'absolute', left: 69, top: 0, width: 2, height: 52, backgroundColor: '#15100b' },
  shade: { position: 'absolute', left: 50, top: 50, width: 40, height: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#b88a36' },
  bulb: { position: 'absolute', left: 62, top: 66, width: 16, height: 9, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: '#ffe7a8' },
});
