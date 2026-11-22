import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

import { usePageState } from '@/components/PageState';
import { SpineFace } from '@/components/shelf/Spine';
import { exampleBook } from '@/components/TourShelf';
import { Colors } from '@/constants/theme';
import { spineCues } from '@/shelf/spineCues';
import { getSpineStyle } from '@/shelf/spineStyle';

/*
 * One bookcase that changes style every few seconds (oak, walnut, painted, metal, glass), with style chips above it and
 * a tray of ornaments below. Each style has its own ornaments in its own places, and one of them lifts out of the tray
 * and settles onto its shelf. Everything is laid out on a fixed canvas, scaled to the page, so the tray and the shelf
 * spots are at known places for the flight between them. A single clock drives it all in animated styles.
 */

const W = 340;
const H = 330;

/** The bookcase front, with its top and right side drawn running back at an angle. */
const CASE = { x: 74, y: 72, width: 180, height: 178, depth: 14, crown: 10, base: 10, post: 6 };
const ROW = (CASE.height - CASE.crown - CASE.base) / 3;
const INNER_X = CASE.x + CASE.post;
/** Where the books and ornaments on a shelf stand. */
const shelfBottom = (row: number) => CASE.y + CASE.crown + (row + 1) * ROW - 5;

const BOOK_SCALE = 0.22;
const BOOKS = [
  exampleBook({ id: -301, title: 'Piranesi', author: 'Clarke', palette: ['#2b3a67', '#e8c875'], pageCount: 272, heightMm: 216 }),
  exampleBook({ id: -302, title: 'Circe', author: 'Miller', palette: ['#c4622d', '#1c1c1c'], pageCount: 400, heightMm: 203, status: 'reading' }),
  exampleBook({ id: -303, title: 'Dune', author: 'Herbert', palette: ['#b3202a', '#e9dcc0'], pageCount: 688, heightMm: 175 }),
  exampleBook({ id: -304, title: 'Emma', author: 'Austen', palette: ['#2f6b5e', '#e8c875'], pageCount: 474, heightMm: 198 }),
  exampleBook({ id: -305, title: 'Solaris', author: 'Lem', palette: ['#4d6d73', '#e8e0cf'], pageCount: 204, heightMm: 198 }),
  exampleBook({ id: -306, title: 'Beloved', author: 'Morrison', palette: ['#8c3b6b', '#e8e0cf'], pageCount: 324, heightMm: 203 }),
  exampleBook({ id: -307, title: 'Stoner', author: 'Williams', palette: ['#bb3e03', '#1c1c1c'], pageCount: 288, heightMm: 203 }),
  exampleBook({ id: -308, title: 'Hyperion', author: 'Simmons', palette: ['#3b2f5c', '#c9b6e4'], pageCount: 482, heightMm: 175, status: 'owned' }),
  exampleBook({ id: -309, title: 'Rebecca', author: 'du Maurier', palette: ['#3a3a3a', '#d9a441'], pageCount: 430, heightMm: 178 }),
];
/** Runs of books along each shelf, in px from the inside left; the gaps between them are where ornaments can go. */
const BOOK_RUNS = [
  { row: 0, from: 2, to: 60, first: 0 },
  { row: 0, from: 104, to: 138, first: 4 },
  { row: 1, from: 40, to: 108, first: 2 },
  { row: 2, from: 2, to: 56, first: 6 },
  { row: 2, from: 98, to: 142, first: 1 },
];

type Ornament = 'plant' | 'cactus' | 'candle' | 'frame' | 'globe' | 'vase' | 'bookend';
/** The tray, in order. */
const TRAY: Ornament[] = ['plant', 'cactus', 'candle', 'frame', 'globe', 'vase', 'bookend'];
/** Each ornament's box, in px. */
const SIZE: Record<Ornament, { w: number; h: number }> = {
  plant: { w: 22, h: 40 },
  cactus: { w: 16, h: 30 },
  candle: { w: 10, h: 30 },
  frame: { w: 20, h: 25 },
  globe: { w: 20, h: 28 },
  vase: { w: 16, h: 32 },
  bookend: { w: 8, h: 30 },
};

/** A place for an ornament: on a shelf, centred this far in, or on top of the bookcase. */
type Spot = { row: number; x: number } | 'top';
const spotPoint = (spot: Spot) =>
  spot === 'top' ? { x: CASE.x + CASE.width / 2 + CASE.depth / 2, y: CASE.y - CASE.depth / 2 + 2 } : { x: INNER_X + spot.x, y: shelfBottom(spot.row) };

interface Finish {
  name: string;
  /** Front of the frame, its top and side, and the inside back. */
  face: string;
  top: string;
  side: string;
  back: readonly [string, string];
  grain?: string;
  /** Thin metal or glass shelves, instead of wooden planks. */
  kind: 'wood' | 'metal' | 'glass';
  /** Ornaments and where they sit. The first is the one shown being placed. Other things on the shelves (a pile of books). */
  ornaments: { item: Ornament | 'trailing plant'; spot: Spot }[];
  pile?: Spot;
}

const FINISHES: Finish[] = [
  {
    name: 'Oak',
    face: '#c08a52', top: '#d9a96f', side: '#946234', back: ['#4a3019', '#5c3d21'], grain: 'rgba(110,62,24,0.32)', kind: 'wood',
    ornaments: [{ item: 'bookend', spot: { row: 1, x: 113 } }, { item: 'trailing plant', spot: 'top' }, { item: 'candle', spot: { row: 2, x: 154 } }],
  },
  {
    name: 'Walnut',
    face: '#6e4529', top: '#8a5a38', side: '#4a2c18', back: ['#1f130a', '#2b1b0f'], grain: 'rgba(28,14,5,0.45)', kind: 'wood',
    ornaments: [{ item: 'frame', spot: { row: 1, x: 20 } }, { item: 'candle', spot: { row: 0, x: 152 } }, { item: 'vase', spot: { row: 2, x: 77 } }],
  },
  {
    name: 'Painted',
    face: '#e9e3d6', top: '#f7f3ea', side: '#c4bba9', back: ['#8fa597', '#a2b6a8'], kind: 'wood',
    ornaments: [{ item: 'globe', spot: 'top' }, { item: 'cactus', spot: { row: 0, x: 82 } }],
    pile: { row: 1, x: 137 },
  },
  {
    name: 'Metal',
    face: '#3d4248', top: '#6b737b', side: '#2a2e33', back: ['#24272b', '#2f3338'], kind: 'metal',
    ornaments: [{ item: 'plant', spot: { row: 1, x: 137 } }, { item: 'frame', spot: { row: 0, x: 82 } }, { item: 'bookend', spot: { row: 2, x: 147 } }],
  },
  {
    name: 'Glass',
    face: 'rgba(205,235,242,0.4)', top: 'rgba(205,238,247,0.55)', side: 'rgba(170,215,228,0.4)', back: ['#3a2b20', '#47362a'], kind: 'glass',
    ornaments: [{ item: 'vase', spot: 'top' }, { item: 'candle', spot: { row: 1, x: 20 } }, { item: 'cactus', spot: { row: 2, x: 77 } }],
  },
];
const SELECTED_STILL = 1;

/** Each style is shown for a few seconds: it fades in, then its first ornament flies from the tray to its spot. */
const STYLE_MS = 3200;
const LOOP_MS = STYLE_MS * FINISHES.length;
const FADE_MS = 450;
const LIFT_FROM = 700;
const LIFT_MS = 1000;

const clamp = (v: number, lo: number, hi: number) => {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
};
const easeInOut = (v: number) => {
  'worklet';
  return v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2;
};
/** Which style is showing at time t, the one before it, and how far the change between them has got. */
const styleAt = (t: number) => {
  'worklet';
  const current = Math.floor(t / STYLE_MS) % FINISHES.length;
  return { current, previous: (current + FINISHES.length - 1) % FINISHES.length, fade: clamp((t % STYLE_MS) / FADE_MS, 0, 1), local: t % STYLE_MS };
};
/**
 * How opaque style i is at time t. Solid layers (the insides) keep the older style solid under a newer one fading in
 * above it, or fade the older out above the newer, so nothing behind ever shows through. Open layers (frames and
 * ornaments) simply cross-fade, so the older style's ornaments go.
 */
const opacityOf = (i: number, t: number, solid: boolean) => {
  'worklet';
  const { current, previous, fade } = styleAt(t);
  if (i === current) return solid && current < previous ? 1 : fade;
  if (i === previous) return solid && current > previous ? 1 : 1 - fade;
  return 0;
};

// Ornaments, drawn in their boxes (see SIZE).

function Plant() {
  return (
    <View style={o.plant}>
      {[-62, -34, -8, 16, 42, 66].map((deg, i) => (
        <View key={deg} style={[o.leaf, { backgroundColor: i % 2 ? '#4f8a4a' : '#3d7339', height: 15 + (i % 3) * 3, transform: [{ rotate: `${deg}deg` }, { translateY: -7 }] }]} />
      ))}
      <View style={o.potRim} />
      <View style={o.pot} />
    </View>
  );
}

/** A plant on top of the bookcase, its vines hanging down over the front. */
function TrailingPlant() {
  return (
    <View style={o.trailing}>
      {[0, 1].map((vine) => (
        <View key={vine} style={[o.vine, { left: vine ? 21 : 5, top: 20 }]}>
          <View style={o.vineStem} />
          {Array.from({ length: vine ? 4 : 6 }, (_, i) => (
            <View key={i} style={[o.vineLeaf, { marginLeft: i % 2 ? 3 : 0, backgroundColor: i % 2 ? '#4f8a4a' : '#3d7339' }]} />
          ))}
        </View>
      ))}
      {[-40, -10, 20, 50].map((deg) => (
        <View key={deg} style={[o.leaf, { bottom: 52, left: 12, height: 13, backgroundColor: '#4f8a4a', transform: [{ rotate: `${deg}deg` }, { translateY: -6 }] }]} />
      ))}
      <View style={[o.pot, o.trailingPot]} />
    </View>
  );
}

function Cactus() {
  return (
    <View style={o.cactus}>
      <View style={o.cactusBody}>
        <View style={o.cactusRib} />
      </View>
      <View style={[o.cactusArm, { left: 0 }]} />
      <View style={[o.cactusArm, { right: 0, top: 6 }]} />
      <View style={o.cactusPot} />
    </View>
  );
}

function Candle() {
  return (
    <View style={o.candle}>
      <View style={o.flameGlow} />
      <View style={o.flame} />
      <View style={o.wax} />
      <View style={o.holder} />
    </View>
  );
}

function Frame() {
  return (
    <View style={o.frame}>
      <LinearGradient colors={['#9cc3d9', '#e6d3a3']} style={o.picture}>
        <View style={o.sun} />
        <View style={o.hill} />
      </LinearGradient>
    </View>
  );
}

function Globe() {
  return (
    <View style={o.globe}>
      <View style={o.ball}>
        <View style={[o.land, { top: 4, left: 3, width: 8, height: 6 }]} />
        <View style={[o.land, { top: 11, left: 10, width: 7, height: 5 }]} />
      </View>
      <View style={o.stand} />
      <View style={o.standBase} />
    </View>
  );
}

function Vase() {
  return (
    <View style={o.vase}>
      <View style={[o.stem, { transform: [{ rotate: '-14deg' }] }]} />
      <View style={[o.stem, { transform: [{ rotate: '12deg' }] }]} />
      <View style={[o.bloom, { left: 1, top: 0, backgroundColor: '#e07a5f' }]} />
      <View style={[o.bloom, { right: 1, top: 2, backgroundColor: '#f2cc8f' }]} />
      <View style={o.vaseBody} />
    </View>
  );
}

function Bookend() {
  return (
    <View style={o.bookend}>
      <LinearGradient colors={['#5b5e63', '#a7adb3', '#4a4d52']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={o.bookendPlate} />
      <View style={o.bookendFoot} />
    </View>
  );
}

const ORNAMENTS: Record<Ornament, () => ReactNode> = { plant: Plant, cactus: Cactus, candle: Candle, frame: Frame, globe: Globe, vase: Vase, bookend: Bookend };

const PILE = [
  { color: '#7a1f1f', width: 40, shift: 0 },
  { color: '#2e5c8a', width: 36, shift: 3 },
  { color: '#d89a3b', width: 42, shift: -2 },
];

/** A few books lying flat. */
function Pile() {
  return (
    <View style={o.pile}>
      {PILE.map((b) => (
        <View key={b.color} style={[o.flatBook, { backgroundColor: b.color, width: b.width, marginLeft: b.shift }]} />
      ))}
    </View>
  );
}

/** An ornament standing on a spot. */
function Placed({ item, spot, style }: { item: Ornament | 'trailing plant'; spot: Spot; style?: object }) {
  const { x, y } = spotPoint(spot);
  const size = item === 'trailing plant' ? { w: 34, h: 64 } : SIZE[item];
  // The trailing plant's pot sits on the top; its vines hang below.
  const top = item === 'trailing plant' ? y - 22 : y - size.h;
  const Item = item === 'trailing plant' ? TrailingPlant : ORNAMENTS[item];
  return (
    <Animated.View style={[{ position: 'absolute', left: x - size.w / 2, top, width: size.w, height: size.h, alignItems: 'center', justifyContent: 'flex-end' }, style]}>
      <Item />
    </Animated.View>
  );
}

/** Thin, slightly uneven lines along a plank or post. */
function Grain({ color, vertical }: { color: string; vertical?: boolean }) {
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {[0.2, 0.45, 0.7].map((at, i) => (
        <View
          key={at}
          style={[
            { position: 'absolute', backgroundColor: color },
            vertical ? { top: `${i * 9}%`, bottom: `${(2 - i) * 8}%`, left: `${at * 100}%`, width: 1 } : { left: `${i * 14}%`, right: `${(2 - i) * 9}%`, top: `${at * 100}%`, height: 1 },
          ]}
        />
      ))}
    </View>
  );
}

/** A plank, post or panel in a finish: wood with grain, brushed steel, or glass with a bright edge. */
function Part({ finish: f, style, vertical }: { finish: Finish; style: object; vertical?: boolean }) {
  if (f.kind === 'metal') {
    return <LinearGradient colors={['#4a4f55', '#a9b0b7', '#5d636a']} start={{ x: 0, y: 0 }} end={vertical ? { x: 1, y: 0 } : { x: 0, y: 1 }} style={style} />;
  }
  return (
    <View style={[{ backgroundColor: f.face }, f.kind === 'glass' && (vertical ? styles.glassEdgeV : styles.glassEdgeH), style]}>
      {f.grain && <Grain color={f.grain} vertical={vertical} />}
    </View>
  );
}

/** The inside of a style's bookcase: its back, drawn behind the books. */
const Back = memo(function Back({ finish: f }: { finish: Finish }) {
  return (
    <View style={styles.inside}>
      {[0, 1, 2].map((row) => (
        <LinearGradient key={row} colors={f.back} style={{ height: ROW }}>
          <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']} style={styles.insideTop} />
          {f.kind === 'metal' && <View style={styles.perforation} />}
        </LinearGradient>
      ))}
    </View>
  );
});

/** A style's frame, shelves and ornaments, drawn in front of the books. Its first ornament waits for the flight to land. */
function Front({ finish: f, index, clock }: { finish: Finish; index: number; clock: SharedValue<number> }) {
  const { x, y, width, height, depth, crown, base, post } = CASE;
  const thin = f.kind !== 'wood';
  const plank = thin ? 3 : 5;
  const landed = useAnimatedStyle(() => {
    const { current, local } = styleAt(clock.value);
    return { opacity: current !== index || local >= LIFT_FROM + LIFT_MS ? 1 : 0 };
  });
  return (
    <>
      {/* Top and side, sheared back to give the case depth. */}
      <View style={[styles.topSurface, { backgroundColor: f.top, left: x + depth / 2, top: y - depth, width }]} />
      <View style={[styles.sideSurface, { backgroundColor: f.side, left: x + width, top: y - depth / 2, height }]} />
      {f.pile && <PilePlaced spot={f.pile} />}
      {f.ornaments.map(
        (orn, i) => orn.item !== 'trailing plant' && <Placed key={`${orn.item}-${i}`} item={orn.item} spot={orn.spot} style={i === 0 ? landed : undefined} />,
      )}
      <Part finish={f} style={{ position: 'absolute', left: x, top: y, width, height: thin ? 4 : crown }} />
      {[0, 1, 2].map((row) => (
        <Part key={row} finish={f} style={{ position: 'absolute', left: x + post, top: shelfBottom(row), width: width - 2 * post, height: plank }} />
      ))}
      <Part finish={f} style={{ position: 'absolute', left: x, top: y + height - base, width, height: base }} />
      <Part finish={f} vertical style={{ position: 'absolute', left: x, top: y, width: thin ? 4 : post, height }} />
      <Part finish={f} vertical style={{ position: 'absolute', left: x + width - (thin ? 4 : post), top: y, width: thin ? 4 : post, height }} />
      {/* A trailing plant hangs over the front, so it goes on last. */}
      {f.ornaments.map((orn, i) => orn.item === 'trailing plant' && <Placed key={`trailing-${i}`} item={orn.item} spot={orn.spot} />)}
    </>
  );
}

function PilePlaced({ spot }: { spot: Spot }) {
  const { x, y } = spotPoint(spot);
  return (
    <View style={{ position: 'absolute', left: x - 22, top: y - 18 }}>
      <Pile />
    </View>
  );
}

/** One style's layers, faded in and out together. */
function StyleLayer({ index, clock, solid, children }: { index: number; clock: SharedValue<number>; solid?: boolean; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({ opacity: opacityOf(index, clock.value, !!solid) }));
  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

/** The books, the same on every style, so the style is what changes. */
const Books = memo(function Books() {
  return BOOK_RUNS.map((run) => {
    let left = INNER_X + run.from;
    const out = [];
    for (let i = 0; ; i++) {
      const book = BOOKS[(run.first + i) % BOOKS.length];
      const s = getSpineStyle(book, BOOK_SCALE);
      if (left + s.width > INNER_X + run.to) break;
      out.push(
        <View key={`${run.row}-${run.from}-${i}`} style={{ position: 'absolute', left, top: shelfBottom(run.row) - s.height, width: s.width, height: s.height, opacity: spineCues(book).opacity }}>
          <SpineFace book={book} style={s} />
        </View>,
      );
      left += s.width + 1;
    }
    return out;
  });
});

const CHIP = { width: 58, gap: 6, top: 4 };
const CHIPS_X = (W - FINISHES.length * CHIP.width - (FINISHES.length - 1) * CHIP.gap) / 2;
const chipX = (i: number) => CHIPS_X + i * (CHIP.width + CHIP.gap);

/** The style chips, with a marker that slides to the chosen one. */
function Chips({ clock }: { clock: SharedValue<number> }) {
  const marker = useAnimatedStyle(() => {
    const { current, previous, fade } = styleAt(clock.value);
    // Back to the first chip from the last, the marker slides all the way across.
    const at = previous + (current - previous) * easeInOut(fade);
    return { transform: [{ translateX: chipX(at) }] };
  });
  return (
    <>
      <Animated.View style={[styles.chipMarker, marker]} />
      {FINISHES.map((f, i) => (
        <View key={f.name} style={[styles.chip, { left: chipX(i) }]}>
          <Text style={styles.chipText}>{f.name}</Text>
        </View>
      ))}
    </>
  );
}

const TILE = { size: 38, gap: 6, top: 274 };
const TRAY_X = (W - TRAY.length * TILE.size - (TRAY.length - 1) * TILE.gap) / 2;
const tileCentre = (i: number) => ({ x: TRAY_X + i * (TILE.size + TILE.gap) + TILE.size / 2, y: TILE.top + TILE.size / 2 });
const TRAY_SCALE = 0.8;

/** A tray tile, ringed while the showing style uses its ornament. */
function TrayTile({ item, index, clock }: { item: Ornament; index: number; clock: SharedValue<number> }) {
  const used = FINISHES.map((f) => f.ornaments.some((orn) => orn.item === item || (item === 'plant' && orn.item === 'trailing plant')));
  const ring = useAnimatedStyle(() => {
    const { current, previous, fade } = styleAt(clock.value);
    return { opacity: (used[current] ? fade : 0) + (used[previous] ? 1 - fade : 0) };
  });
  const Item = ORNAMENTS[item];
  const c = tileCentre(index);
  return (
    <View style={[styles.tile, { left: c.x - TILE.size / 2, top: TILE.top }]}>
      <Animated.View style={[styles.tileRing, ring]} />
      <View style={{ transform: [{ scale: TRAY_SCALE }], width: SIZE[item].w, height: SIZE[item].h, alignItems: 'center', justifyContent: 'flex-end' }}>
        <Item />
      </View>
    </View>
  );
}

/** The showing style's first ornament, lifting from its tray tile and settling onto its spot. */
function Flight({ clock }: { clock: SharedValue<number> }) {
  // Precomputed per style: where it starts and lands (centres), and how big it is.
  const paths = FINISHES.map((f) => {
    const { item, spot } = f.ornaments[0];
    const ornament = item as Ornament;
    const end = spotPoint(spot);
    return { item: ornament, from: tileCentre(TRAY.indexOf(ornament)), to: { x: end.x, y: end.y - SIZE[ornament].h / 2 } };
  });
  return paths.map((p, i) => <FlyingOrnament key={i} index={i} path={p} clock={clock} />);
}

function FlyingOrnament({ index, path, clock }: { index: number; path: { item: Ornament; from: { x: number; y: number }; to: { x: number; y: number } }; clock: SharedValue<number> }) {
  const size = SIZE[path.item];
  const style = useAnimatedStyle(() => {
    const { current, local } = styleAt(clock.value);
    const p = (local - LIFT_FROM) / LIFT_MS;
    if (current !== index || p <= 0 || p >= 1) return { opacity: 0, transform: [{ translateX: path.from.x }, { translateY: path.from.y }] };
    const e = easeInOut(p);
    const x = path.from.x + (path.to.x - path.from.x) * e;
    // Lifted up and over in an arc, a little bigger while held.
    const y = path.from.y + (path.to.y - path.from.y) * e - Math.sin(Math.PI * p) * 46;
    const scale = TRAY_SCALE + (1 - TRAY_SCALE) * e + Math.sin(Math.PI * p) * 0.25;
    return { opacity: 1, transform: [{ translateX: x }, { translateY: y }, { scale }] };
  });
  const Item = ORNAMENTS[path.item];
  return (
    <Animated.View style={[styles.flying, { marginLeft: -size.w / 2, marginTop: -size.h / 2, width: size.w, height: size.h }, style]}>
      <Item />
    </Animated.View>
  );
}

/** One bookcase cycling through wood, metal and glass, each with its own ornaments, and a tray of ornaments to place. */
export function CustomShelvesExample() {
  const { reached, current } = usePageState();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const k = width / W;
  /** Still frame: the walnut style, its ornaments in place. */
  const still = SELECTED_STILL * STYLE_MS + STYLE_MS - 1;
  const clock = useSharedValue(still);

  const playing = reached && current && !reducedMotion;
  useEffect(() => {
    if (!playing) {
      cancelAnimation(clock);
      clock.set(still);
      return;
    }
    // Start on the first style, already faded in.
    clock.set(FADE_MS);
    clock.set(withRepeat(withTiming(LOOP_MS + FADE_MS, { duration: LOOP_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(clock);
  }, [playing, clock, still]);

  return (
    <View
      style={styles.frame}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      pointerEvents="none"
      accessible
      accessibilityLabel="A bookcase that changes between oak, walnut, painted, metal and glass, each with its own ornaments in its own places: a trailing plant, a bookend, candles, a framed picture, a vase, a cactus, a potted plant, a globe and a pile of books. Below it, a tray of ornaments, with the ones in use marked; one lifts from the tray and settles onto a shelf.">
      {reached && width > 0 && (
        <View style={[styles.canvas, { left: (width - W) / 2, top: (H * k - H) / 2, transform: [{ scale: k }] }]}>
          <Chips clock={clock} />
          <View style={styles.trayBed} />
          {FINISHES.map((f, i) => (
            <StyleLayer key={f.name} index={i} clock={clock} solid>
              <Back finish={f} />
            </StyleLayer>
          ))}
          <Books />
          {FINISHES.map((f, i) => (
            <StyleLayer key={f.name} index={i} clock={clock}>
              <Front finish={f} index={i} clock={clock} />
            </StyleLayer>
          ))}
          {TRAY.map((item, i) => (
            <TrayTile key={item} item={item} index={i} clock={clock} />
          ))}
          <Flight clock={clock} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', maxWidth: 432, aspectRatio: W / H, alignSelf: 'center' },
  canvas: { position: 'absolute', width: W, height: H },
  inside: { position: 'absolute', left: INNER_X, top: CASE.y + CASE.crown, width: CASE.width - 2 * CASE.post },
  insideTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 12 },
  perforation: { ...StyleSheet.absoluteFill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', margin: 6, borderStyle: 'dotted' },
  topSurface: { position: 'absolute', height: CASE.depth, transform: [{ skewX: '-45deg' }] },
  sideSurface: { position: 'absolute', width: CASE.depth, transform: [{ skewY: '-45deg' }] },
  glassEdgeH: { borderTopWidth: 1, borderTopColor: 'rgba(235,250,255,0.75)' },
  glassEdgeV: { borderLeftWidth: 1, borderLeftColor: 'rgba(235,250,255,0.6)' },
  chip: { position: 'absolute', top: CHIP.top, width: CHIP.width, height: 26, borderRadius: 13, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  chipMarker: { position: 'absolute', left: 0, top: CHIP.top, width: CHIP.width, height: 26, borderRadius: 13, borderWidth: 2, borderColor: Colors.accent, backgroundColor: 'rgba(217,164,65,0.18)' },
  chipText: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  trayBed: { position: 'absolute', left: TRAY_X - 8, right: TRAY_X - 8, top: TILE.top - 8, height: TILE.size + 16, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tile: { position: 'absolute', width: TILE.size, height: TILE.size, borderRadius: 8, backgroundColor: Colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  tileRing: { ...StyleSheet.absoluteFill, borderRadius: 8, borderWidth: 2, borderColor: Colors.accent },
  flying: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'flex-end' },
});

const o = StyleSheet.create({
  plant: { width: 22, height: 40, alignItems: 'center', justifyContent: 'flex-end' },
  leaf: { position: 'absolute', bottom: 15, width: 7, borderRadius: 6 },
  potRim: { width: 17, height: 3, backgroundColor: '#c4704a', borderRadius: 1 },
  pot: { width: 13, height: 11, backgroundColor: '#b05f3c', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  trailing: { width: 34, height: 64 },
  trailingPot: { position: 'absolute', left: 10, top: 11 },
  vine: { position: 'absolute', gap: 1 },
  vineStem: { position: 'absolute', left: 3, top: 0, bottom: 2, width: 1, backgroundColor: '#3d6a33' },
  vineLeaf: { width: 6, height: 7, borderRadius: 4 },
  cactus: { width: 16, height: 30, alignItems: 'center', justifyContent: 'flex-end' },
  cactusBody: { width: 8, height: 20, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: '#5b8c4f', alignItems: 'center' },
  cactusRib: { width: 1, height: '100%', backgroundColor: 'rgba(0,0,0,0.18)' },
  cactusArm: { position: 'absolute', top: 9, width: 4, height: 8, borderRadius: 2, backgroundColor: '#5b8c4f' },
  cactusPot: { width: 13, height: 8, backgroundColor: '#d9c7a4', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  candle: { width: 10, height: 30, alignItems: 'center', justifyContent: 'flex-end' },
  flameGlow: { position: 'absolute', top: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,200,90,0.3)' },
  flame: { width: 4, height: 6, borderRadius: 3, borderTopLeftRadius: 1, backgroundColor: '#ffb53c', transform: [{ rotate: '45deg' }], marginBottom: 1 },
  wax: { width: 5, height: 15, backgroundColor: '#f3ead2' },
  holder: { width: 10, height: 3, borderRadius: 1, backgroundColor: '#b88a36' },
  frame: { width: 20, height: 25, padding: 3, backgroundColor: '#3a2412', borderRadius: 1, transform: [{ rotate: '-4deg' }] },
  picture: { flex: 1, overflow: 'hidden' },
  sun: { position: 'absolute', top: 2, right: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: '#f3c45a' },
  hill: { position: 'absolute', bottom: -6, left: -4, width: 20, height: 12, borderRadius: 10, backgroundColor: '#5f8f4e' },
  globe: { width: 20, height: 28, alignItems: 'center' },
  ball: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#3f7fae', overflow: 'hidden', borderWidth: 1, borderColor: '#2a5878' },
  land: { position: 'absolute', borderRadius: 3, backgroundColor: '#7aa860' },
  stand: { width: 3, height: 6, backgroundColor: '#8a6a2c' },
  standBase: { width: 12, height: 3, borderRadius: 1, backgroundColor: '#b88a36' },
  vase: { width: 16, height: 32, alignItems: 'center', justifyContent: 'flex-end' },
  stem: { position: 'absolute', top: 6, width: 1.5, height: 14, backgroundColor: '#4f7a3a' },
  bloom: { position: 'absolute', width: 7, height: 7, borderRadius: 4 },
  vaseBody: { width: 11, height: 15, borderRadius: 5, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: '#5e8fa3' },
  bookend: { width: 8, height: 30, justifyContent: 'flex-end', alignItems: 'flex-end' },
  bookendPlate: { flex: 1, width: 3, borderTopLeftRadius: 1, borderTopRightRadius: 1 },
  bookendFoot: { width: 8, height: 2, backgroundColor: '#6f7378' },
  pile: { width: 44 },
  flatBook: { height: 6, borderRadius: 1, borderRightWidth: 2, borderRightColor: 'rgba(255,255,255,0.35)' },
});
