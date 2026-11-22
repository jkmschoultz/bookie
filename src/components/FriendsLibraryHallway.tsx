import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { usePageState } from '@/components/PageState';
import { Fonts, Wood } from '@/constants/theme';
import { sampleBooks } from '@/library/sampleBooks';
import { getSpineStyle, type SpineStyle } from '@/shelf/spineStyle';
import type { Book } from '@/types';

/*
 * A library hallway in one-point perspective, looking along it at eye level. Everything is laid out in "world" units
 * around the eye: x to the right, y down, z towards the viewer (so the hallway lies at negative z). Floor, ceiling, walls
 * and bookcase fronts are flat views turned into place with perspective + rotateX/rotateY, all centred on the vanishing
 * point so they share it. Things facing the viewer (end panels, plaques, lamps, the far wall) are scaled by their depth.
 *
 * Walking is one number, `walk`: how far along the hallway the eye has moved. Each moving part works out its own
 * transform from it in an animated style, so walking never re-renders anything. Drawn far to near.
 *
 * Walking stops at bookcases, like a list snapping to its rows: at a stop, one bookcase (on one side or the other) has
 * its end just ahead, with its aisle sign whole. Bookcases alternate sides half a spacing apart, so stops are too.
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
/** How far the hallway runs, up to the window at its end. */
const LENGTH = 1200;

const CASE_HEIGHT = 230;
const CASE_TOP = FLOOR - CASE_HEIGHT;
const CASE_MID_Y = CASE_TOP + CASE_HEIGHT / 2;
/** How far a bookcase stands out from the wall, and how long it runs along it. */
const CASE_DEPTH = 36;
const CASE_LENGTH = 150;
const CASE_SPACING = 174;
const FRONT_X = HALF_WIDTH - CASE_DEPTH;
const FIRST_CASE = -40;
const SHELVES = 3;
const BOOK_SCALE = 0.28;

/** Walk between one stop and the next: from one bookcase to the next one along, on the other side. */
const STOP = CASE_SPACING / 2;
/** One swipe of the demo loop walks past a bookcase on each side, from stop to stop. */
const STEP = 2 * STOP;
const STEPS = 5;
const FADE_MS = 450;
const STEP_MS = 1500;
const HOLD_MS = 900;
const LOOP_MS = FADE_MS + STEPS * STEP_MS + HOLD_MS + FADE_MS;
/** With reduced motion, the picture rests at the first stop, faded in. */
const STILL_MS = FADE_MS;
/** How far a drag on the picture walks, per point dragged. */
const DRAG_WALK = 2.2;
/** How far a flick carries on after letting go, per unit of speed (walk per second). */
const MOMENTUM = 0.16;
/** How far past the first or last stop a drag can stretch, at most. */
const STRETCH = 50;
/** Settles on a stop with no bounce, starting at the flick's speed. */
const SETTLE = { mass: 1, stiffness: 140, damping: 24 } as const;

/**
 * On the web, moving parts get their own layers up front, so the browser only recomposites them each frame instead of
 * repainting and re-rasterising them as they grow.
 */
const MOVING = Platform.OS === 'web' ? ({ willChange: 'transform' } as object) : null;
const FADING = Platform.OS === 'web' ? ({ willChange: 'opacity' } as object) : null;

const clamp = (v: number, lo: number, hi: number) => {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
};
const easeInOut = (v: number) => {
  'worklet';
  return v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2;
};
/** How much smaller something at depth z is drawn (z stays clear of the eye). */
const depthScale = (z: number) => {
  'worklet';
  return EYE / (EYE - Math.min(z, EYE - 40));
};

/** The nearest stop to a walk, between the first and last bookcase. */
const nearestStop = (walk: number, last: number) => {
  'worklet';
  return clamp(Math.round(walk / STOP), 0, last) * STOP;
};
/** A walk held between the first and last stop, giving a little past either end, harder the further it goes. */
const stretch = (walk: number, last: number) => {
  'worklet';
  const end = last * STOP;
  const over = walk < 0 ? walk : walk > end ? walk - end : 0;
  return clamp(walk, 0, end) + Math.sign(over) * STRETCH * (1 - 1 / (1 + Math.abs(over) / (2 * STRETCH)));
};

/** Where one swipe of the loop is at time t: which swipe, and how far through it (0 to 1). */
const swipeAt = (t: number) => {
  'worklet';
  const u = t - FADE_MS;
  if (u < 0) return { k: 0, v: 0 };
  if (u >= STEPS * STEP_MS) return { k: STEPS, v: 0 };
  const k = Math.floor(u / STEP_MS);
  return { k, v: (u - k * STEP_MS) / STEP_MS };
};
/** How far along the hallway the loop has walked at time t. Each swipe glides one step, easing in and out. */
const walkAt = (t: number) => {
  'worklet';
  const { k, v } = swipeAt(t);
  return (k + easeInOut(clamp((v - 0.12) / 0.7, 0, 1))) * STEP;
};
/** Dark at the start and end of each loop, to hide the jump back. */
const fadeAt = (t: number) => {
  'worklet';
  if (t < FADE_MS) return 1 - t / FADE_MS;
  if (t > LOOP_MS - FADE_MS) return (t - (LOOP_MS - FADE_MS)) / FADE_MS;
  return 0;
};

interface Friend {
  name: string;
  /** Behind the stand-in silhouette, until a real profile picture takes its place. */
  color: string;
  books: Book[];
}

/** Sample books for each friend: their favourite genres first, then the rest. Ids are negative and unused elsewhere. */
const SAMPLES = sampleBooks();
function friend(index: number, name: string, color: string, genres: string[]): Friend {
  const mine = SAMPLES.filter((b) => genres.includes(b.genres[0]));
  const rest = SAMPLES.filter((b) => !genres.includes(b.genres[0]));
  const books = [...mine, ...mine, ...rest].map((b, i) => ({ ...b, id: -2000 - index * 200 - i }));
  return { name, color, books };
}

const FRIENDS = [
  friend(0, 'Maja', '#b66b4b', ['Literary Fiction', 'Classics', 'Poetry']),
  friend(1, 'Tom', '#557d83', ['Science Fiction']),
  friend(2, 'Elin', '#7b6e9a', ['Fantasy', 'Graphic Novels']),
  friend(3, 'Noor', '#a5713a', ['Mystery & Thriller', 'Biography & Memoir']),
  friend(4, 'Sam', '#6b8f5e', ['History', 'Science & Nature']),
  friend(5, 'Ida', '#b0587a', ['Poetry', 'Classics', 'Cooking']),
  friend(6, 'Leo', '#4f6fa0', ['Science Fiction', 'Graphic Novels']),
  friend(7, 'Freja', '#8a7a3a', ['Fantasy', 'Literary Fiction']),
  friend(8, 'Omar', '#3f8a80', ['History', 'Philosophy', 'Psychology']),
  friend(9, 'Aisha', '#9a4f4f', ['Mystery & Thriller', 'Literary Fiction']),
  friend(10, 'Jonas', '#5f7a4a', ['Science & Nature', 'Biography & Memoir']),
  friend(11, 'Vera', '#7a5a9a', ['Classics', 'Fantasy']),
];

/** Bookcases alternate sides, each a half-step further along than the last. */
const CASES = FRIENDS.map((f, i) => ({ friend: f, side: (i % 2 ? 1 : -1) as -1 | 1, near: FIRST_CASE - (i * CASE_SPACING) / 2 }));
const LAMPS = [-150, -500, -850];

/** The books on one shelf: a shuffled run from the friend's books, as many as fit, with a little room left at the end. */
function shelfBooks(f: Friend, shelf: number, width: number) {
  let seed = (f.books[0].id * 31 + shelf * 977) >>> 0;
  const next = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  const room = width * (0.86 + next() * 0.12);
  const out: { key: string; style: SpineStyle }[] = [];
  let used = 0;
  for (let n = 0; n < 60; n++) {
    const style = getSpineStyle(f.books[Math.floor(next() * f.books.length)], BOOK_SCALE);
    if (used + style.width > room) break;
    out.push({ key: `${shelf}-${n}`, style });
    used += style.width + 1;
  }
  return out;
}

/**
 * A spine at hallway size: the app's own spine colour, size and ornament, without the title, which would be too small
 * to read here. One view each, so a long hallway of books stays light.
 */
function SmallSpine({ s }: { s: SpineStyle }) {
  const ornament =
    s.decoration === 'bands'
      ? [styles.bands, { borderColor: s.accentColor }]
      : s.decoration === 'band'
        ? [styles.band, { backgroundColor: s.accentColor }]
        : s.decoration === 'frame' || s.decoration === 'label'
          ? [styles.spineFrame, { borderColor: s.accentColor }]
          : null;
  return (
    <View style={[styles.spine, { width: s.width, height: s.height, backgroundColor: s.color }]}>
      {ornament && <View style={ornament} />}
    </View>
  );
}

const POST = 7;
const CROWN = 12;
const BASE = 12;
const PLANK = 6;
const ROW_HEIGHT = (CASE_HEIGHT - CROWN - BASE) / SHELVES;

/** The front of one friend's bookcase, drawn flat: posts, a crown, and shelves of books. Lighter at the near end. */
const CaseFront = memo(function CaseFront({ friend: f, side }: { friend: Friend; side: -1 | 1 }) {
  return (
    <View style={styles.caseFront}>
      <LinearGradient colors={Wood.plankTop} style={{ height: CROWN }} />
      <View style={styles.shelves}>
        {Array.from({ length: SHELVES }, (_, shelf) => (
          <View key={shelf} style={{ height: ROW_HEIGHT }}>
            <LinearGradient colors={['#1a110a', '#2c1d12']} style={styles.rowBooks}>
              {shelfBooks(f, shelf, CASE_LENGTH - 2 * POST - 4).map(({ key, style }) => (
                <SmallSpine key={key} s={style} />
              ))}
            </LinearGradient>
            <View style={styles.plank} />
          </View>
        ))}
      </View>
      <View style={styles.caseBase} />
      <View style={[styles.post, { left: 0 }]} />
      <View style={[styles.post, { right: 0 }]} />
      <LinearGradient
        colors={['rgba(10,6,3,0)', 'rgba(10,6,3,0.5)']}
        start={{ x: side === -1 ? 0 : 1, y: 0 }}
        end={{ x: side === -1 ? 1 : 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

/**
 * A friend's aisle sign, like the ones at the end of library aisles: a flat brass sign held out into the hallway by two
 * iron brackets on the bookcase's end, facing down the hallway, with a framed round picture and the friend's name.
 * A plain silhouette stands in until there are profile pictures. `fog` darkens it with distance.
 */
function AisleSign({ friend: f, side, fog }: { friend: Friend; side: -1 | 1; fog: object }) {
  const edge = side === -1 ? 'left' : 'right';
  return (
    <>
      {[SIGN.bracketInset, SIGN.height - SIGN.bracketInset - SIGN.bracket].map((top) => (
        <View key={top} style={[styles.bracket, { top, [edge]: CASE_DEPTH - SIGN.bracketReach }]} />
      ))}
      <View style={[styles.sign, { [edge]: CASE_DEPTH + SIGN.gap }]}>
        <LinearGradient colors={Wood.brass} style={styles.signFace}>
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
        <Animated.View style={[styles.fog, styles.signFog, FADING, fog]} />
      </View>
    </>
  );
}

/** Something facing the viewer, centred on (x, y) at depth z as walked. Hidden once it is past the eye. */
function Facing({ walk, x, y, z, hideAfter, width, height, children }: { walk: SharedValue<number>; x: number; y: number; z: number; hideAfter: number; width: number; height: number; children?: ReactNode }) {
  const style = useAnimatedStyle(() => {
    const at = z + walk.value;
    const s = depthScale(at);
    return { opacity: at > hideAfter ? 0 : 1, transform: [{ translateX: x * s }, { translateY: y * s }, { scale: s }] };
  });
  return <Animated.View style={[{ position: 'absolute', left: VX - width / 2, top: VY - height / 2, width, height }, MOVING, style]}>{children}</Animated.View>;
}

/** A flat view turned into place, centred on the vanishing point. */
function Plane({ width, height, transform, children }: { width: number; height: number; transform: object[]; children?: ReactNode }) {
  return (
    <View style={{ position: 'absolute', left: VX - width / 2, top: VY - height / 2, width, height, transform: [{ perspective: EYE }, ...transform] as never }}>
      {children}
    </View>
  );
}

/** One friend's bookcase along a side wall: its front turned to face the hallway, its end panel and plaque facing us. */
function SideCase({ walk, friend: f, side, near }: { walk: SharedValue<number>; friend: Friend; side: -1 | 1; near: number }) {
  const left = side === -1;
  const front = useAnimatedStyle(() => {
    const centre = near - CASE_LENGTH / 2 + walk.value;
    return {
      opacity: centre - CASE_LENGTH / 2 > 70 ? 0 : 1,
      transform: [
        { perspective: EYE },
        { translateX: side * FRONT_X },
        { translateY: CASE_MID_Y },
        { rotateY: left ? '90deg' : '-90deg' },
        // After the turn, sideways in the view is along the hallway.
        { translateX: left ? -centre : centre },
      ],
    };
  });
  // Farther bookcases fade into the dark.
  const fog = useAnimatedStyle(() => ({ opacity: clamp((-(near - CASE_LENGTH / 2 + walk.value) - 220) / 760, 0, 0.88) }));
  const endFog = useAnimatedStyle(() => ({ opacity: clamp((-(near + walk.value) - 220) / 760, 0, 0.88) }));
  // The farthest signs fade out altogether, so the row of them along each wall doesn't crowd into the window.
  const signFade = useAnimatedStyle(() => ({ opacity: clamp((SIGN_GONE + near + walk.value) / 220, 0, 1) }));
  return (
    <>
      <Animated.View style={[styles.casePlane, MOVING, front]}>
        <CaseFront friend={f} side={side} />
        <Animated.View style={[styles.fog, FADING, fog]} />
      </Animated.View>
      <Facing walk={walk} x={side * (HALF_WIDTH - CASE_DEPTH / 2)} y={CASE_MID_Y} z={near} hideAfter={70} width={CASE_DEPTH} height={CASE_HEIGHT}>
        <LinearGradient colors={left ? ['#7a4f2d', '#5a381f'] : ['#5a381f', '#7a4f2d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.endPanel}>
          <View style={styles.endTrim} />
        </LinearGradient>
        <Animated.View style={[styles.fog, FADING, endFog]} />
      </Facing>
      <Facing walk={walk} x={side * (HALF_WIDTH - SIGN_SPAN / 2)} y={CASE_TOP + SIGN.drop + SIGN.height / 2} z={near} hideAfter={70} width={SIGN_SPAN} height={SIGN.height}>
        <Animated.View style={[StyleSheet.absoluteFill, FADING, signFade]}>
          <AisleSign friend={f} side={side} fog={endFog} />
        </Animated.View>
      </Facing>
    </>
  );
}

/** Lines across the floor or ceiling, every `every` units, sliding towards us as we walk. */
function Crosswise({ walk, every, children }: { walk: SharedValue<number>; every: number; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: walk.value % every }] }));
  return <Animated.View style={[styles.crosswise, { top: -every }, MOVING, style]}>{children}</Animated.View>;
}

const BOARDS = 10;
const JOINT = 60;
const BEAM = 120;

function Floor({ walk }: { walk: SharedValue<number> }) {
  const board = (2 * HALF_WIDTH) / BOARDS;
  return (
    <Plane width={2 * HALF_WIDTH} height={LENGTH} transform={[{ translateY: FLOOR }, { rotateX: '90deg' }, { translateY: -LENGTH / 2 }]}>
      {/* Boards run along the hallway, so their seams meet at the vanishing point. */}
      <View style={styles.boards}>
        {Array.from({ length: BOARDS }, (_, i) => (
          <View key={i} style={[styles.board, { width: board, backgroundColor: i % 3 === 0 ? '#7d522f' : i % 3 === 1 ? '#8a5c35' : '#734a2a' }]} />
        ))}
      </View>
      <View style={styles.runner} />
      <Crosswise walk={walk} every={JOINT}>
        {Array.from({ length: LENGTH / JOINT + 1 }, (_, i) => (
          <View key={i} style={[styles.joint, { top: i * JOINT }]} />
        ))}
      </Crosswise>
      <LinearGradient colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.caseShadow, { left: CASE_DEPTH }]} />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.caseShadow, { right: CASE_DEPTH }]} />
      <LinearGradient colors={['rgba(8,5,2,0.95)', 'rgba(8,5,2,0.55)', 'rgba(8,5,2,0)']} locations={[0, 0.55, 0.9]} style={StyleSheet.absoluteFill} />
    </Plane>
  );
}

function Ceiling({ walk }: { walk: SharedValue<number> }) {
  return (
    <Plane width={2 * HALF_WIDTH} height={LENGTH} transform={[{ translateY: CEILING }, { rotateX: '-90deg' }, { translateY: LENGTH / 2 }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2a1c13' }]} />
      {/* The ceiling's near edge is at the bottom of this view, so the beams slide downwards too, but flipped. */}
      <View style={[StyleSheet.absoluteFill, { transform: [{ scaleY: -1 }] }]}>
        <Crosswise walk={walk} every={BEAM}>
          {Array.from({ length: LENGTH / BEAM + 1 }, (_, i) => (
            <View key={i} style={[styles.beam, { top: i * BEAM }]} />
          ))}
        </Crosswise>
      </View>
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']} locations={[0.1, 0.45, 1]} style={StyleSheet.absoluteFill} />
    </Plane>
  );
}

function SideWall({ side }: { side: -1 | 1 }) {
  const left = side === -1;
  return (
    <Plane
      width={LENGTH}
      height={FLOOR - CEILING}
      transform={[{ translateX: side * HALF_WIDTH }, { translateY: (FLOOR + CEILING) / 2 }, { rotateY: left ? '90deg' : '-90deg' }, { translateX: left ? LENGTH / 2 : -LENGTH / 2 }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#4b3526' }]} />
      <View style={styles.wallRail} />
      <LinearGradient colors={['rgba(8,5,2,0)', 'rgba(8,5,2,0.6)', 'rgba(8,5,2,0.95)']} locations={[0.05, 0.4, 0.9]} start={{ x: left ? 0 : 1, y: 0 }} end={{ x: left ? 1 : 0, y: 0 }} style={StyleSheet.absoluteFill} />
    </Plane>
  );
}

/** The far end of the hallway: a tall window with moonlight. */
function FarWall({ walk }: { walk: SharedValue<number> }) {
  return (
    <Facing walk={walk} x={0} y={(FLOOR + CEILING) / 2} z={-LENGTH} hideAfter={0} width={2 * HALF_WIDTH} height={FLOOR - CEILING}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#22170f' }]} />
      <View style={styles.window}>
        <LinearGradient colors={['#2c3e5c', '#4d6a8c', '#22324a']} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.moon} />
        <View style={styles.mullionV} />
        <View style={[styles.mullionH, { top: '40%' }]} />
        <View style={[styles.mullionH, { top: '70%' }]} />
      </View>
      <View style={styles.sill} />
    </Facing>
  );
}

/** A pendant lamp over the hallway, with a soft glow. */
function Lamp({ walk, z }: { walk: SharedValue<number>; z: number }) {
  return (
    <Facing walk={walk} x={0} y={-108} z={z} hideAfter={-30} width={120} height={110}>
      <View style={styles.glow} />
      <View style={styles.cord} />
      <View style={styles.shade} />
      <View style={styles.bulb} />
    </Facing>
  );
}

/** A finger swiping down the picture, with a fading trail, in time with each step of the walk. */
function SwipeHint({ clock, manual }: { clock: SharedValue<number>; manual: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const { k, v } = swipeAt(clock.value);
    const on = k < STEPS && manual.value === 0;
    const stroke = clamp((v - 0.06) / 0.62, 0, 1);
    const opacity = on ? clamp(stroke * 6, 0, 1) * clamp((1 - stroke) * 4, 0, 1) : 0;
    return { opacity, transform: [{ translateY: easeInOut(stroke) * 120 }] };
  });
  return (
    <Animated.View style={[styles.hint, style]} pointerEvents="none">
      <LinearGradient colors={['rgba(255,248,230,0)', 'rgba(255,248,230,0.45)']} style={styles.trail} />
      <View style={styles.finger} />
    </Animated.View>
  );
}

/** The hallway itself, drawn once; `walk` moves it. */
const Hallway = memo(function Hallway({ walk }: { walk: SharedValue<number> }) {
  return (
    <>
      <Ceiling walk={walk} />
      <Floor walk={walk} />
      <SideWall side={-1} />
      <SideWall side={1} />
      <FarWall walk={walk} />
      {[...CASES].reverse().map((c) => (
        <SideCase key={c.friend.name} walk={walk} friend={c.friend} side={c.side} near={c.near} />
      ))}
      {[...LAMPS].reverse().map((z) => (
        <Lamp key={z} walk={walk} z={z} />
      ))}
    </>
  );
});

/**
 * Walking down a library hallway, with a bookcase for each friend along both walls, each with their name and picture.
 * It plays a loop of swiping down to walk further in; dragging down on it walks too.
 */
export function FriendsLibraryHallway() {
  const { reached, current } = usePageState();
  const reducedMotion = useReducedMotion();
  // The frame keeps the picture's shape at any width; the hallway is drawn once its width is known and its page reached.
  const [width, setWidth] = useState(0);
  const k = width / W;

  const clock = useSharedValue(reducedMotion ? STILL_MS : 0);
  /** 1 while a drag has taken over from the loop. */
  const manual = useSharedValue(0);
  const manualWalk = useSharedValue(0);
  const dragStart = useSharedValue(0);
  /** Darkens the picture while it fades back to the start after a drag. */
  const dim = useSharedValue(0);
  const looping = useSharedValue(0);
  const walk = useDerivedValue(() => (manual.value ? manualWalk.value : walkAt(clock.value)));

  const last = FRIENDS.length - 1;
  const drag = usePanGesture({
    // On the web, leave sideways swipes to the browser, so they still turn the page. Gesture handler reads this from the
    // config, but its types leave it out.
    // @ts-expect-error touchAction is a web-only gesture option missing from PanGestureConfig
    touchAction: 'pan-x',
    activeOffsetY: [-8, 8],
    failOffsetX: [-12, 12],
    onActivate: () => {
      'worklet';
      cancelAnimation(clock);
      cancelAnimation(dim);
      // Catch a walk that is still settling, where it is.
      cancelAnimation(manualWalk);
      dim.set(0);
      dragStart.set(manual.value ? manualWalk.value : walkAt(clock.value));
      manualWalk.set(dragStart.value);
      manual.set(1);
    },
    onUpdate: (e) => {
      'worklet';
      manualWalk.set(stretch(dragStart.value + e.translationY * DRAG_WALK, last));
    },
    onDeactivate: (e) => {
      'worklet';
      // Like letting go of a list: a flick carries on, then the walk settles on the nearest bookcase. With reduced
      // motion it goes straight to the nearest one.
      const speed = e.velocityY * DRAG_WALK;
      if (reducedMotion) manualWalk.set(nearestStop(manualWalk.value, last));
      else manualWalk.set(withSpring(nearestStop(manualWalk.value + speed * MOMENTUM, last), { ...SETTLE, velocity: speed }));
      if (!looping.value) return;
      // Rest where the drag left off, then fade back to the start of the loop.
      const backToStart = withTiming(1, { duration: FADE_MS }, (finished) => {
        'worklet';
        if (!finished) return;
        manual.set(0);
        dim.set(0);
        clock.set(0);
        clock.set(withRepeat(withTiming(LOOP_MS, { duration: LOOP_MS, easing: Easing.linear }), -1, false));
      });
      dim.set(withDelay(1600, backToStart));
    },
  });

  const playing = reached && current && !reducedMotion;
  useEffect(() => {
    manual.set(0);
    dim.set(0);
    looping.set(playing ? 1 : 0);
    if (!playing) {
      cancelAnimation(clock);
      clock.set(STILL_MS);
      return;
    }
    clock.set(0);
    clock.set(withRepeat(withTiming(LOOP_MS, { duration: LOOP_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(clock);
  }, [playing, clock, manual, dim, looping]);

  const darkness = useAnimatedStyle(() => ({ opacity: Math.max(dim.value, manual.value ? 0 : fadeAt(clock.value)) }));

  return (
    <GestureDetector gesture={drag}>
      <View
        style={styles.frame}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityLabel={`A long library hallway seen at eye level, with ${FRIENDS.length} bookcases full of books along both walls and a window at the far end. Each bookcase belongs to a friend and has an aisle sign with their name and a round photo: ${FRIENDS.map((f) => f.name).join(', ')}. The picture walks down the hallway, as if swiping down; drag up or down on it to walk yourself, and it stops at the nearest bookcase.`}>
        {reached && width > 0 && (
          <View style={[styles.hallway, { left: (width - W) / 2, top: (H * k - H) / 2, transform: [{ scale: k }] }]} pointerEvents="none">
            <Hallway walk={walk} />
            {!reducedMotion && <SwipeHint clock={clock} manual={manual} />}
            <Animated.View style={[styles.darkness, darkness]} />
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

/** An aisle sign: its size, how far below the top of the bookcase it hangs, and its brackets. */
const SIGN = { width: 56, height: 62, drop: 6, gap: 5, bracket: 4, bracketInset: 9, bracketReach: 6 };
/** From the wall to the sign's far edge: the bookcase's end, the gap the brackets span, and the sign. */
const SIGN_SPAN = CASE_DEPTH + SIGN.gap + SIGN.width;
/** How far down the hallway signs have faded out. */
const SIGN_GONE = 900;

const styles = StyleSheet.create({
  frame: { width: '100%', maxWidth: 432, aspectRatio: W / H, alignSelf: 'center', borderRadius: 14, overflow: 'hidden', backgroundColor: '#0d0905' },
  hallway: { position: 'absolute', width: W, height: H },
  darkness: { ...StyleSheet.absoluteFill, backgroundColor: '#0d0905' },
  casePlane: { position: 'absolute', left: VX - CASE_LENGTH / 2, top: VY - CASE_HEIGHT / 2, width: CASE_LENGTH, height: CASE_HEIGHT },
  caseFront: { width: CASE_LENGTH, height: CASE_HEIGHT, backgroundColor: Wood.side[1] },
  shelves: { flex: 1, paddingHorizontal: POST },
  rowBooks: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1, paddingHorizontal: 2 },
  plank: { height: PLANK, backgroundColor: Wood.plankFront[1], borderTopWidth: 2, borderTopColor: Wood.plankTop[0] },
  caseBase: { height: BASE, backgroundColor: Wood.plankFront[2] },
  post: { position: 'absolute', top: 0, bottom: 0, width: POST, backgroundColor: Wood.side[0], borderLeftWidth: 2, borderLeftColor: Wood.side[1] },
  fog: { ...StyleSheet.absoluteFill, backgroundColor: '#0d0905' },
  signFog: { borderRadius: 5 },
  spine: { borderTopLeftRadius: 1, borderTopRightRadius: 1, borderLeftWidth: 0.6, borderLeftColor: 'rgba(0,0,0,0.35)', overflow: 'hidden' },
  bands: { position: 'absolute', left: 0, right: 0, top: 3, bottom: 3, borderTopWidth: 1, borderBottomWidth: 1 },
  band: { position: 'absolute', left: 0, right: 0, top: 3, height: 3, opacity: 0.85 },
  spineFrame: { position: 'absolute', left: 1, right: 1, top: 2, bottom: 2, borderWidth: 0.6 },
  endPanel: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  endTrim: { position: 'absolute', left: 4, right: 4, top: CROWN, bottom: BASE, borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)', borderRadius: 2 },
  sign: { position: 'absolute', top: 0, width: SIGN.width, height: SIGN.height, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  signFace: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 3, borderRadius: 5, borderWidth: 1.5, borderColor: '#7a5a22' },
  bracket: { position: 'absolute', width: SIGN.gap + 2 * SIGN.bracketReach, height: SIGN.bracket, borderRadius: 1, backgroundColor: '#2b2420', borderTopWidth: 1, borderTopColor: '#6a5a4c' },
  photoFrame: { width: 30, height: 30, borderRadius: 15, padding: 2.5, backgroundColor: '#4f311b' },
  photo: { flex: 1, borderRadius: 13, overflow: 'hidden', alignItems: 'center' },
  head: { width: 9, height: 9, borderRadius: 5, marginTop: 4, backgroundColor: 'rgba(255,245,228,0.85)' },
  shoulders: { width: 19, height: 14, borderRadius: 10, marginTop: 2, backgroundColor: 'rgba(255,245,228,0.85)' },
  name: { color: Wood.brassText, fontFamily: Fonts.serif, fontSize: 13, fontWeight: '700' },
  boards: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  board: { height: '100%', borderRightWidth: 1, borderRightColor: 'rgba(30,16,6,0.55)' },
  runner: { position: 'absolute', left: 116, right: 116, top: 0, bottom: 0, backgroundColor: '#6e2a22', borderLeftWidth: 3, borderRightWidth: 3, borderColor: '#c99a4a' },
  crosswise: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  joint: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(30,16,6,0.5)' },
  caseShadow: { position: 'absolute', width: 28, top: 0, bottom: 0 },
  beam: { position: 'absolute', left: 0, right: 0, height: 14, backgroundColor: '#3b281a', borderBottomWidth: 2, borderBottomColor: '#1c120b' },
  wallRail: { position: 'absolute', left: 0, right: 0, top: 70, height: 5, backgroundColor: '#5e4330' },
  window: { position: 'absolute', left: 120, right: 120, top: 70, bottom: 120, borderTopLeftRadius: 50, borderTopRightRadius: 50, overflow: 'hidden', borderWidth: 6, borderColor: '#3a2817' },
  moon: { position: 'absolute', top: 30, right: 22, width: 18, height: 18, borderRadius: 9, backgroundColor: '#f1e8c8' },
  mullionV: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 4, marginLeft: -2, backgroundColor: '#3a2817' },
  mullionH: { position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: '#3a2817' },
  sill: { position: 'absolute', left: 110, right: 110, bottom: 112, height: 8, backgroundColor: '#5a3c22' },
  glow: { position: 'absolute', left: 0, top: 10, width: 120, height: 100, borderRadius: 60, backgroundColor: 'rgba(255,214,140,0.07)' },
  cord: { position: 'absolute', left: 59, top: 0, width: 2, height: 48, backgroundColor: '#15100b' },
  shade: { position: 'absolute', left: 40, top: 46, width: 40, height: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#b88a36' },
  bulb: { position: 'absolute', left: 52, top: 62, width: 16, height: 9, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: '#ffe7a8' },
  hint: { position: 'absolute', right: 26, top: 92, width: 26, alignItems: 'center' },
  trail: { width: 10, height: 56, borderRadius: 5, marginBottom: -12 },
  finger: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,248,230,0.85)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.95)', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4 },
});
