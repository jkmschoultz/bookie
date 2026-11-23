import { LinearGradient } from 'expo-linear-gradient';
import { createContext, Fragment, memo, startTransition, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useFocusEffect, useIsFocused } from 'expo-router';

import { usePageState } from '@/components/PageState';
import { Colors, Fonts, Wood } from '@/constants/theme';
import { sampleBooks } from '@/library/sampleBooks';
import { ChristmasWindow, FarEndPresents, Garland, Wreath } from '@/components/HallwayChristmas';
import { currentSeason, type Season } from '@/library/season';
import { caseAt, caseBounds, type HallwayView } from '@/shelf/hallwayHit';
import { hallwayShelves, type HallwaySpine } from '@/shelf/hallwayShelves';
import { shelfMetrics, shelfZoom } from '@/shelf/zoom';
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
 *
 * The eye is a camera: besides walking, it can step aside and up, and turn (yaw) on the spot (see Camera). Every part
 * puts the same camera transform between its perspective and its own placement, so turning to face a bookcase is a
 * real turn of the whole scene in 3-D, not a turn of the flat picture. At rest the camera transform does nothing.
 */

/** The picture's width before it is scaled to the page, and its height in the What's to come box. */
const W = 340;
const BOX_H = 330;
/** Distance from the eye to the picture, in world units. */
const EYE = 320;
const HALF_WIDTH = W / 2;
const VX = W / 2;
/** How far the hallway runs, up to the window at its end, at least. It grows with the number of bookcases. */
const MIN_LENGTH = 1200;

/** How far a bookcase stands out from the wall, and how long it runs along it. */
const CASE_DEPTH = 36;
const CASE_LENGTH = 150;
const CASE_SPACING = 174;
const FRONT_X = HALF_WIDTH - CASE_DEPTH;
const FIRST_CASE = -40;
const BOOK_SCALE = 0.28;

/**
 * The heights in the picture. In the What's to come box it's 330 high; full screen it's as tall as the screen at the same
 * width, so the hallway is taller (a higher ceiling, taller bookcases with more shelves) and seen just the same.
 * Everything vertical is in proportion to the picture's height: the eye, floor, ceiling, bookcases and shelves.
 */
export interface Geometry {
  H: number;
  /** The vanishing point, at eye level. */
  VY: number;
  FLOOR: number;
  CEILING: number;
  CASE_HEIGHT: number;
  CASE_TOP: number;
  CASE_MID_Y: number;
  SHELVES: number;
  ROW_HEIGHT: number;
}

function geometry(H: number): Geometry {
  const VY = Math.round((H * 150) / BOX_H);
  const FLOOR = H - VY;
  const CASE_HEIGHT = Math.round((H * 230) / BOX_H);
  const CASE_TOP = FLOOR - CASE_HEIGHT;
  const SHELVES = Math.max(3, Math.round((3 * H) / BOX_H));
  return { H, VY, FLOOR, CEILING: -VY, CASE_HEIGHT, CASE_TOP, CASE_MID_Y: CASE_TOP + CASE_HEIGHT / 2, SHELVES, ROW_HEIGHT: (CASE_HEIGHT - CROWN - BASE) / SHELVES };
}

const POST = 7;
const CROWN = 12;
const BASE = 12;
const PLANK = 6;
const BOX = geometry(BOX_H);
const GeometryContext = createContext<Geometry>(BOX);
const useGeometry = () => use(GeometryContext);

/** The season the hallway is dressed for (see library/season), and whether its animations (snow) may run. */
const SeasonContext = createContext<{ season: Season | null; playing: boolean }>({ season: null, playing: false });

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

/**
 * Where the camera is, as an opening turns it to a bookcase (see cameraAt): `yaw` degrees round (negative turns left),
 * stepped `x` to the side, `y` down and `z` forwards, from the eye at rest. `dim` darkens everything but the chosen
 * bookcase, and `relax` (0 at rest) lets things show that only the turned camera can see, close by on either side.
 */
interface Camera {
  t: number;
  yaw: number;
  sin: number;
  cos: number;
  x: number;
  y: number;
  z: number;
  dim: number;
  relax: number;
}
/** Where an opening turn ends: towards which wall, and the step to the bookcase (to the side, down, forwards). */
interface TurnTarget {
  side: number;
  x: number;
  y: number;
  z: number;
}
const REST: Camera = { t: 0, yaw: 0, sin: 0, cos: 1, x: 0, y: 0, z: 0, dim: 0, relax: 0 };
/** Where a part out of sight goes: nowhere, and the same every frame. */
const HIDDEN = [{ scale: 0 }];

/** Eases in and out gently (a half sine), so a turn keeps moving through its middle rather than whipping round. */
const gentle = (v: number) => {
  'worklet';
  return 0.5 - 0.5 * Math.cos(Math.PI * clamp(v, 0, 1));
};

/**
 * The camera t of the way through turning to face a bookcase (0 to 1, linear in time). Like turning on the spot while
 * taking the last steps: a quarter turn, with a step forwards to the bookcase's middle as it turns, and a step up close
 * as it comes round. The rest dims as the bookcase comes into view.
 */
const cameraAt = (t: number, to: TurnTarget): Camera => {
  'worklet';
  if (t <= 0) return REST;
  const turned = gentle(t);
  const forwards = gentle(t / 0.9);
  const close = gentle((t - 0.15) / 0.85);
  const yaw = to.side * 90 * turned;
  const r = (yaw * Math.PI) / 180;
  return {
    t,
    yaw,
    sin: Math.sin(r),
    cos: Math.cos(r),
    x: to.x * close,
    y: to.y * close,
    z: to.z * forwards,
    dim: easeInOut(clamp((t - 0.1) / 0.7, 0, 1)),
    relax: clamp(t * 4, 0, 1),
  };
};

/** A step towards the viewer: translateZ on the web; native transforms have no translateZ, so a matrix there. */
const IS_WEB = Platform.OS === 'web';
const towards = (z: number) => {
  'worklet';
  return IS_WEB ? { translateZ: z } : { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, z, 1] };
};
/**
 * The camera, as transforms between a part's perspective and its own placement: from the eye, step back to the camera
 * and turn about it. Nothing at rest, which keeps walking as light as it was.
 */
const view = (c: Camera) => {
  'worklet';
  if (c.t === 0) return [];
  return [towards(EYE), { rotateY: `${c.yaw}deg` }, { translateX: -c.x }, { translateY: -c.y }, towards(c.z - EYE)];
};
/** How far towards the viewer a point at (x, depth z as walked) is from the camera: negative in front of it. */
const camZ = (c: Camera, x: number, z: number) => {
  'worklet';
  return -(x - c.x) * c.sin + (z + c.z - EYE) * c.cos;
};
/** The depth at which a point would be, seen the same way with the camera at rest: z itself, at rest. */
const seenAt = (c: Camera, x: number, z: number) => {
  'worklet';
  return EYE + camZ(c, x, z);
};
/** Farther things fade into the dark, by their distance in front of the camera. */
const fogAt = (c: Camera, x: number, z: number) => {
  'worklet';
  return clamp((-seenAt(c, x, z) - 220) / 760, 0, 0.88);
};
/** How far past the picture something may come before it's hidden; with the camera turned, almost up to the eye. */
const hideAt = (c: Camera, hideAfter: number) => {
  'worklet';
  return hideAfter + (EYE - 30 - hideAfter) * c.relax;
};
/** A plane along a side wall, `distance` out from the middle, `y` from eye level, centred at depth `centre` (as walked). */
const alongWall = (c: Camera, side: -1 | 1, distance: number, y: number, centre: number) => {
  'worklet';
  return [
    { perspective: EYE },
    ...view(c),
    { translateX: side * distance },
    { translateY: y },
    { rotateY: side === -1 ? '90deg' : '-90deg' },
    // After the turn, sideways in the view is along the hallway.
    { translateX: side === -1 ? -centre : centre },
  ];
};
/**
 * Something facing down the hallway, centred on (x, y) at depth z (as walked). At rest that's only a move and a scale
 * by its depth, in 2-D, which is cheaper to draw; turned, it's placed in 3-D and seen through the camera.
 */
const facing = (c: Camera, x: number, y: number, z: number) => {
  'worklet';
  if (c.t === 0) {
    const s = EYE / (EYE - Math.min(z, EYE - 40));
    return [{ translateX: x * s }, { translateY: y * s }, { scale: s }];
  }
  return [{ perspective: EYE }, ...view(c), { translateX: x }, { translateY: y }, towards(z)];
};

/** The nearest stop to a walk, between the first and last stop (numbered, in STOPs). */
const nearestStop = (walk: number, first: number, last: number) => {
  'worklet';
  return clamp(Math.round(walk / STOP), first, last) * STOP;
};
/** A walk held between the first and last stop, giving a little past either end, harder the further it goes. */
const stretch = (walk: number, first: number, last: number) => {
  'worklet';
  const start = first * STOP;
  const end = last * STOP;
  const over = walk < start ? walk - start : walk > end ? walk - end : 0;
  return clamp(walk, start, end) + Math.sign(over) * STRETCH * (1 - 1 / (1 + Math.abs(over) / (2 * STRETCH)));
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

/**
 * How a friend's bookcase looks. Only the wood for now; later, the shelf customisation people choose for their own
 * shelf (wood, decor) can travel here, and every bookcase that doesn't say gets DEFAULT_SHELF_LOOK.
 */
export interface ShelfLook {
  wood: keyof typeof WOODS;
}

const WOODS = {
  walnut: { side: Wood.side, plankTop: Wood.plankTop, plankFront: Wood.plankFront, end: ['#7a4f2d', '#5a381f'] as const },
};

export const DEFAULT_SHELF_LOOK: ShelfLook = { wood: 'walnut' };

export interface HallwayFriend {
  key: string;
  name: string;
  /** Behind the picture on the sign, until there are profile pictures. */
  color: string;
  /** Shown on the sign instead of the stand-in silhouette. */
  initial?: string;
  books: Book[];
  /**
   * A friend request: someone asking you ('incoming') or someone you asked ('outgoing'). Their bookcase is only a
   * "potential" one: empty and see-through, with a dashed sign.
   */
  request?: 'incoming' | 'outgoing';
  /** News on their shelf you haven't seen: a dot on their sign. */
  news?: boolean;
  look?: ShelfLook;
}

/** Sample books for each friend: their favourite genres first, then the rest. Ids are negative and unused elsewhere. */
function friend(index: number, name: string, color: string, genres: string[]): HallwayFriend {
  const samples = sampleBooks();
  const mine = samples.filter((b) => genres.includes(b.genres[0]));
  const rest = samples.filter((b) => !genres.includes(b.genres[0]));
  const books = [...mine, ...mine, ...rest].map((b, i) => ({ ...b, id: -2000 - index * 200 - i }));
  return { key: name, name, color, books };
}

/** The made-up friends in the What's to come preview. */
const demoFriends = () => [
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

/** Where everything stands for a hallway of these friends' bookcases: the cases, its length, and lamps along it. */
function hallwayFor(friends: HallwayFriend[]) {
  // Bookcases alternate sides, each a half-step further along than the last.
  const cases = friends.map((f, i) => ({ friend: f, side: (i % 2 ? 1 : -1) as -1 | 1, near: FIRST_CASE - (i * CASE_SPACING) / 2 }));
  // Long enough to see the window past the last bookcase; whole beams, so the floor and ceiling lines repeat evenly.
  const length = Math.max(MIN_LENGTH, Math.ceil((friends.length * STOP + 360) / BEAM) * BEAM);
  const lamps: number[] = [];
  for (let z = -150; z > -length + 300; z -= 350) lamps.push(z);
  return { cases, length, lamps };
}

/**
 * A spine at hallway size: the app's own spine colour and ornament, without the title, which would be too small to
 * read here. One view each (two with an ornament), so a long hallway of books stays light.
 */
function SmallSpine({ s, lean }: { s: HallwaySpine; lean?: boolean }) {
  const { style } = s;
  const pageWidth = Math.min(1.5, Math.max(0.5, s.width * 0.2));
  const ornament =
    style.decoration === 'bands'
      ? [styles.bands, { borderColor: style.accentColor }]
      : style.decoration === 'band'
        ? [styles.band, { backgroundColor: style.accentColor }]
        : style.decoration === 'frame' || style.decoration === 'label'
          ? [styles.spineFrame, { borderColor: style.accentColor }]
          : null;
  return (
    <View
      style={[
        styles.book,
        { width: s.width, height: s.height },
        // Leaning against the post on its left: its foot out from the post, its top against it.
        lean && { marginLeft: s.height * LEAN_SIN + 1, transform: [{ rotate: `-${LEAN_DEG}deg` }], transformOrigin: 'left bottom' },
      ]}>
      <View style={[styles.pages, { width: pageWidth }]} />
      <View style={[styles.spine, { right: pageWidth, width: s.width - pageWidth, backgroundColor: style.color }]}>
        {ornament && <View style={ornament} />}
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.12)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

const LEAN_DEG = 11;
/** Bookcases near the entrance, which get their books in the first render. */
const NEAR_CASES = 4;
const LEAN_SIN = Math.sin((LEAN_DEG * Math.PI) / 180);

/**
 * The front of one friend's bookcase, drawn flat: posts, a crown, and shelves holding their books (see hallwayShelves).
 * A friend request's bookcase is empty and see-through. The room between the shelves is clear: the dark behind the books
 * is CaseBacking, which fades away for the bookcase being turned to, so its back and shelves show in depth behind it
 * (see CaseInside) without drawing its books again.
 */
const CaseFront = memo(function CaseFront({ friend: f, withBooks }: { friend: HallwayFriend; withBooks: boolean }) {
  const g = useGeometry();
  const wood = WOODS[(f.look ?? DEFAULT_SHELF_LOOK).wood];
  const eyeShelf = eyeShelfOf(g);
  const shelves = useMemo(
    () => (f.request || !withBooks ? null : hallwayShelves(f.books, g.SHELVES, CASE_LENGTH - 2 * POST - 4, BOOK_SCALE, eyeShelf)),
    [f.request, withBooks, f.books, g.SHELVES, eyeShelf],
  );
  return (
    <View style={[styles.caseFront, { height: g.CASE_HEIGHT }, f.request && styles.potential]}>
      <LinearGradient colors={wood.plankTop} style={{ height: CROWN }} />
      <View style={styles.shelves}>
        {Array.from({ length: g.SHELVES }, (_, i) => (
          <View key={i} style={{ height: g.ROW_HEIGHT }}>
            <View style={styles.rowBooks}>
              {shelves?.[i].spines.map((s) => <SmallSpine key={s.key} s={s} lean={shelves[i].lean} />)}
              {shelves?.[i].bookend && <View style={styles.bookend} />}
            </View>
            <View style={styles.plank}>
              <View style={[styles.plankTopFace, { backgroundColor: wood.plankTop[0] }]} />
              <LinearGradient colors={wood.plankFront} style={styles.plankFace} />
            </View>
          </View>
        ))}
      </View>
      <View style={[styles.caseBase, { backgroundColor: wood.plankFront[2] }]} />
      <View style={[styles.post, { left: 0, backgroundColor: wood.side[0], borderLeftColor: wood.side[1] }]} />
      <View style={[styles.post, { right: 0, backgroundColor: wood.side[0], borderLeftColor: wood.side[1] }]} />
      {f.request && <View style={styles.potentialOutline} />}
    </View>
  );
});

/** Books start on the shelf at eye level, where a few are easiest to see (the top one is behind the aisle sign). */
const eyeShelfOf = (g: Geometry) => Math.min(g.SHELVES - 1, Math.max(0, Math.floor(-(g.CASE_TOP + CROWN) / g.ROW_HEIGHT)));

/** The dark behind the books on each shelf of a bookcase's front, drawn flat (see CaseFront). */
const CaseBacking = memo(function CaseBacking({ friend: f }: { friend: HallwayFriend }) {
  const g = useGeometry();
  const wood = WOODS[(f.look ?? DEFAULT_SHELF_LOOK).wood];
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: wood.side[1] }, f.request && styles.potential]}>
      <View style={[styles.shelves, { marginTop: CROWN }]}>
        {Array.from({ length: g.SHELVES }, (_, i) => (
          <View key={i} style={{ height: g.ROW_HEIGHT }}>
            <LinearGradient colors={ROW_BACK} style={styles.rowBack} />
          </View>
        ))}
      </View>
    </View>
  );
});

const ROW_BACK = ['#1a110a', '#2c1d12'] as const;

/** Darker towards the far end of a bookcase, along the wall. */
function CaseShade({ side }: { side: -1 | 1 }) {
  return (
    <LinearGradient
      colors={['rgba(10,6,3,0)', 'rgba(10,6,3,0.5)']}
      start={{ x: side === -1 ? 0 : 1, y: 0 }}
      end={{ x: side === -1 ? 1 : 0, y: 0 }}
      style={StyleSheet.absoluteFill}
    />
  );
}

/**
 * A friend's aisle sign, like the ones at the end of library aisles: a flat brass sign held out into the hallway by two
 * iron brackets on the bookcase's end, facing down the hallway, with a framed round picture and the friend's name.
 * A plain silhouette stands in until there are profile pictures. `fog` darkens it with distance.
 */
function AisleSign({ friend: f, side, fog }: { friend: HallwayFriend; side: -1 | 1; fog: object }) {
  const edge = side === -1 ? 'left' : 'right';
  return (
    <>
      {[SIGN.bracketInset, SIGN.height - SIGN.bracketInset - SIGN.bracket].map((top) => (
        <View key={top} style={[styles.bracket, { top, [edge]: CASE_DEPTH - SIGN.bracketReach }]} />
      ))}
      <View style={[styles.sign, { [edge]: CASE_DEPTH + SIGN.gap }, f.request && styles.potentialSign]}>
        <LinearGradient colors={Wood.brass} style={[styles.signFace, f.request && styles.potentialSignFace]}>
          <View style={styles.photoFrame}>
            <View style={[styles.photo, { backgroundColor: f.color }, f.initial != null && styles.initialPhoto]}>
              {f.initial != null ? (
                <Text style={styles.initial}>{f.initial}</Text>
              ) : (
                <>
                  <View style={styles.head} />
                  <View style={styles.shoulders} />
                </>
              )}
            </View>
          </View>
          <Text numberOfLines={1} style={styles.name}>
            {f.name}
          </Text>
        </LinearGradient>
        <Animated.View style={[styles.fog, styles.signFog, FADING, fog]} />
        {/* News on their shelf you haven't seen, or a request waiting for your answer. */}
        {/* On the corner facing the walkway: top right on the left wall, top left on the right wall. */}
        {(f.news || f.request === 'incoming') && (
          <View style={[styles.newsDot, side === 1 ? { left: -5 } : { right: -5 }, f.request === 'incoming' && styles.requestDot]} />
        )}
      </View>
    </>
  );
}

/**
 * Something facing down the hallway, centred on (x, y) at depth z as walked, seen through the camera. Hidden once it
 * is past the eye at `hideAfter`; with `fadeFrom`, it fades out smoothly on the way there instead of vanishing. With
 * `besides`, a turned camera still sees it close by on either side (a bookcase's end, the far wall); otherwise it stays
 * hidden that close (signs and lamps, which would loom). `dims` fades it as the camera turns to a bookcase, and
 * `oneSided` hides it from behind (a bookcase's end, seen from inside the bookcase).
 */
function Facing({
  walk,
  cam,
  x,
  y,
  z,
  hideAfter,
  fadeFrom,
  besides,
  dims,
  oneSided,
  width,
  height,
  children,
}: {
  walk: SharedValue<number>;
  cam: SharedValue<Camera>;
  x: number;
  y: number;
  z: number;
  hideAfter: number;
  fadeFrom?: number;
  besides?: boolean;
  dims?: boolean;
  oneSided?: boolean;
  width: number;
  height: number;
  children?: ReactNode;
}) {
  const { VY } = useGeometry();
  const style = useAnimatedStyle(() => {
    const c = cam.value;
    const at = z + walk.value;
    const seen = seenAt(c, x, at);
    let opacity: number;
    if (fadeFrom != null) opacity = clamp((hideAfter - seen) / (hideAfter - fadeFrom), 0, 1);
    else if (besides && c.relax > 0) opacity = clamp((hideAt(c, hideAfter) - seen) / 30, 0, 1);
    else opacity = seen > hideAfter ? 0 : 1;
    if (dims) opacity *= 1 - c.dim;
    // Out of sight, it stays put, shrunk away, so it costs nothing to draw and nothing close to the eye is drawn huge.
    return { opacity, transform: (opacity > 0 ? facing(c, x, y, at) : HIDDEN) as never };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: VX - width / 2, top: VY - height / 2, width, height }, oneSided && styles.oneSided, MOVING, style]}>
      {children}
    </Animated.View>
  );
}

/** A flat view turned into place, centred on the vanishing point, seen through the camera. */
function Plane({ cam, width, height, transform, children }: { cam: SharedValue<Camera>; width: number; height: number; transform: object[]; children?: ReactNode }) {
  const { VY } = useGeometry();
  const style = useAnimatedStyle(() => ({ transform: [{ perspective: EYE }, ...view(cam.value), ...transform] as never }));
  return <Animated.View style={[{ position: 'absolute', left: VX - width / 2, top: VY - height / 2, width, height }, MOVING, style]}>{children}</Animated.View>;
}

/**
 * One friend's bookcase along a side wall: its front turned to face the hallway, its end panel and plaque facing us.
 * The bookcase being turned to (`chosen`) is drawn in depth: its back, shelves and inner sides behind an open front.
 * The others darken as it comes into view.
 */
const SideCase = memo(function SideCase({
  walk,
  cam,
  friend: f,
  side,
  near,
  withBooks,
  chosen,
}: {
  walk: SharedValue<number>;
  cam: SharedValue<Camera>;
  friend: HallwayFriend;
  side: -1 | 1;
  near: number;
  withBooks: boolean;
  chosen: boolean;
}) {
  const { VY, CASE_HEIGHT, CASE_MID_Y, CASE_TOP } = useGeometry();
  const left = side === -1;
  const front = useAnimatedStyle(() => {
    const c = cam.value;
    const nearZ = near + walk.value;
    const shows = frontShows(c, side, nearZ);
    return { opacity: shows ? 1 : 0, transform: (shows ? alongWall(c, side, FRONT_X, CASE_MID_Y, nearZ - CASE_LENGTH / 2) : HIDDEN) as never };
  });
  const { end } = WOODS[(f.look ?? DEFAULT_SHELF_LOOK).wood];
  // Farther bookcases fade into the dark; all but the chosen one darken as the camera turns to it.
  const fog = useAnimatedStyle(() => {
    const c = cam.value;
    return { opacity: Math.max(fogAt(c, side * FRONT_X, near - CASE_LENGTH / 2 + walk.value), chosen ? 0 : c.dim * DIM) };
  });
  const endFog = useAnimatedStyle(() => {
    const c = cam.value;
    return { opacity: Math.max(fogAt(c, side * HALF_WIDTH, near + walk.value), chosen ? 0 : c.dim * DIM) };
  });
  // The chosen bookcase loses the shade along it as it comes round to face you, lit evenly like a shelf, and the dark
  // behind its books gives way to its back and shelves, drawn in depth.
  const shade = useAnimatedStyle(() => ({ opacity: 1 - cam.value.dim }));
  const backing = useAnimatedStyle(() => ({ opacity: chosen ? 1 - clamp(cam.value.t * 5, 0, 1) : 1 }));
  // The farthest signs fade out altogether, so the row of them along each wall doesn't crowd into the window.
  const signFade = useAnimatedStyle(() => ({ opacity: clamp((SIGN_GONE + near + walk.value) / 220, 0, 1) }));
  return (
    <>
      {chosen && <CaseInside walk={walk} cam={cam} friend={f} side={side} near={near} />}
      <Animated.View style={[styles.casePlane, { top: VY - CASE_HEIGHT / 2, height: CASE_HEIGHT }, MOVING, front]}>
        <Animated.View style={[StyleSheet.absoluteFill, chosen && FADING, backing]}>
          <CaseBacking friend={f} />
        </Animated.View>
        <CaseFront friend={f} withBooks={withBooks} />
        {chosen ? (
          <Animated.View style={[StyleSheet.absoluteFill, FADING, shade]}>
            <CaseShade side={side} />
          </Animated.View>
        ) : (
          <CaseShade side={side} />
        )}
        <Animated.View style={[styles.fog, FADING, fog]} />
      </Animated.View>
      <Facing walk={walk} cam={cam} x={side * (HALF_WIDTH - CASE_DEPTH / 2)} y={CASE_MID_Y} z={near} hideAfter={CASE_HIDE} besides oneSided width={CASE_DEPTH} height={CASE_HEIGHT}>
        <LinearGradient colors={left ? end : [end[1], end[0]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.endPanel, f.request && styles.potential]}>
          <View style={[styles.endTrim, f.request && styles.potentialTrim]} />
        </LinearGradient>
        <Animated.View style={[styles.fog, FADING, endFog]} />
      </Facing>
      <Facing
        walk={walk}
        cam={cam}
        x={side * (HALF_WIDTH - SIGN_SPAN / 2)}
        y={CASE_TOP + SIGN.drop + SIGN.height / 2}
        z={near}
        hideAfter={SIGN_HIDE}
        fadeFrom={SIGN_FADE}
        width={SIGN_SPAN}
        height={SIGN.height}>
        <Animated.View style={[StyleSheet.absoluteFill, FADING, signFade]}>
          <AisleSign friend={f} side={side} fog={endFog} />
        </Animated.View>
      </Facing>
    </>
  );
});

/**
 * Inside the bookcase being turned to, drawn behind its open front so it has depth as the camera comes round: the
 * back panel against the wall, the inner sides at each end, and each shelf's surface between the front and the back
 * (its top below eye level, its underside above). They narrow away to nothing as the bookcase comes to face you.
 */
function CaseInside({ walk, cam, friend: f, side, near }: { walk: SharedValue<number>; cam: SharedValue<Camera>; friend: HallwayFriend; side: -1 | 1; near: number }) {
  const g = useGeometry();
  const wood = WOODS[(f.look ?? DEFAULT_SHELF_LOOK).wood];
  const shows = (c: Camera) => {
    'worklet';
    return frontShows(c, side, near + walk.value) ? 1 : 0;
  };
  const back = useAnimatedStyle(() => {
    const c = cam.value;
    return { opacity: shows(c), transform: alongWall(c, side, HALF_WIDTH, g.CASE_MID_Y, near - CASE_LENGTH / 2 + walk.value) as never };
  });
  // Shelf surfaces: where each plank's top is, or its underside above eye level.
  const shelves = Array.from({ length: g.SHELVES }, (_, i) => {
    const top = g.CASE_TOP + CROWN + (i + 1) * g.ROW_HEIGHT - PLANK;
    return top < 0 ? top + PLANK : top;
  });
  return (
    <>
      <Animated.View style={[styles.casePlane, { top: g.VY - g.CASE_HEIGHT / 2, height: g.CASE_HEIGHT }, MOVING, back]}>
        <LinearGradient colors={Wood.backPanel} style={StyleSheet.absoluteFill} />
        {Array.from({ length: g.SHELVES }, (_, i) => (
          <LinearGradient
            key={i}
            colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
            style={[styles.backShadow, { top: CROWN + i * g.ROW_HEIGHT }]}
          />
        ))}
      </Animated.View>
      {[near, near - CASE_LENGTH].map((z) => (
        <Facing key={z} walk={walk} cam={cam} x={side * (HALF_WIDTH - CASE_DEPTH / 2)} y={g.CASE_MID_Y} z={z} hideAfter={CASE_HIDE} besides width={CASE_DEPTH} height={g.CASE_HEIGHT}>
          <LinearGradient colors={[wood.side[0], '#24170d']} start={{ x: side === -1 ? 1 : 0, y: 0 }} end={{ x: side === -1 ? 0 : 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Facing>
      ))}
      {shelves.map((y) => (
        <ShelfSurface key={y} walk={walk} cam={cam} side={side} near={near} y={y} below={y > 0} shows={shows} />
      ))}
    </>
  );
}

/** One shelf's surface, flat between the bookcase's front and the wall, at `y` from eye level. */
function ShelfSurface({
  walk,
  cam,
  side,
  near,
  y,
  below,
  shows,
}: {
  walk: SharedValue<number>;
  cam: SharedValue<Camera>;
  side: -1 | 1;
  near: number;
  y: number;
  below: boolean;
  shows: (c: Camera) => number;
}) {
  const { VY } = useGeometry();
  const style = useAnimatedStyle(() => {
    const c = cam.value;
    return {
      opacity: shows(c),
      // Laid flat: the view's height runs from the wall (top) to the front edge (bottom).
      transform: [...alongWall(c, side, FRONT_X + CASE_DEPTH / 2, y, near - CASE_LENGTH / 2 + walk.value), { rotateX: '90deg' }] as never,
    };
  });
  return (
    <Animated.View style={[styles.shelfSurface, { top: VY - CASE_DEPTH / 2 }, MOVING, style]}>
      <LinearGradient colors={below ? ['#2a1a0e', Wood.plankTop[1]] : ['#1c120a', Wood.plankFront[2]]} style={StyleSheet.absoluteFill} />
    </Animated.View>
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

/**
 * The floor, ceiling and side walls run from the far end to NEAR_Z past the picture, behind the eye, so a turned camera
 * finds them beside it too. Shares of their length, for gradients laid out along it from either end.
 */
const span = (length: number) => length + NEAR_Z;
const fromFar = (length: number, share: number) => (share * length) / span(length);
const fromNear = (length: number, share: number) => (NEAR_Z + share * length) / span(length);

const Floor = memo(function Floor({ walk, cam, length }: { walk: SharedValue<number>; cam: SharedValue<Camera>; length: number }) {
  const { FLOOR } = useGeometry();
  const board = (2 * HALF_WIDTH) / BOARDS;
  const all = span(length);
  return (
    <Plane cam={cam} width={2 * HALF_WIDTH} height={all} transform={[{ translateY: FLOOR }, { rotateX: '90deg' }, { translateY: (NEAR_Z - length) / 2 }]}>
      {/* Boards run along the hallway, so their seams meet at the vanishing point. */}
      <View style={styles.boards}>
        {Array.from({ length: BOARDS }, (_, i) => (
          <View key={i} style={[styles.board, { width: board, backgroundColor: i % 3 === 0 ? '#7d522f' : i % 3 === 1 ? '#8a5c35' : '#734a2a' }]} />
        ))}
      </View>
      <LinearGradient
        colors={['#481f22', '#742d2b', '#542124']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.runner}
      />
      <Crosswise walk={walk} every={180}>
        {Array.from({ length: Math.ceil(all / 180) + 1 }, (_, i) => (
          <View key={i} style={[styles.runnerMotif, { top: i * 180 + 80 }]}>
            <View style={styles.runnerMotifInner} />
          </View>
        ))}
      </Crosswise>
      <Crosswise walk={walk} every={JOINT}>
        {Array.from({ length: Math.ceil(all / JOINT) + 1 }, (_, i) => (
          <View key={i} style={[styles.joint, { top: i * JOINT }]} />
        ))}
      </Crosswise>
      <LinearGradient colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.caseShadow, { left: CASE_DEPTH }]} />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.caseShadow, { right: CASE_DEPTH }]} />
      {/* The far end is at the top. */}
      <LinearGradient
        colors={['rgba(8,5,2,0.95)', 'rgba(8,5,2,0.55)', 'rgba(8,5,2,0)']}
        locations={[0, fromFar(length, 0.55), fromFar(length, 0.9)]}
        style={StyleSheet.absoluteFill}
      />
    </Plane>
  );
});

const Ceiling = memo(function Ceiling({ walk, cam, length }: { walk: SharedValue<number>; cam: SharedValue<Camera>; length: number }) {
  const { CEILING } = useGeometry();
  const all = span(length);
  return (
    <Plane cam={cam} width={2 * HALF_WIDTH} height={all} transform={[{ translateY: CEILING }, { rotateX: '-90deg' }, { translateY: (length - NEAR_Z) / 2 }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2a1c13' }]} />
      {/* The ceiling's near edge is at the bottom of this view, so the beams slide downwards too, but flipped. */}
      <View style={[StyleSheet.absoluteFill, { transform: [{ scaleY: -1 }] }]}>
        <Crosswise walk={walk} every={BEAM}>
          {Array.from({ length: Math.ceil(all / BEAM) + 1 }, (_, i) => (
            <View key={i} style={[styles.beam, { top: i * BEAM }]} />
          ))}
        </Crosswise>
      </View>
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']}
        locations={[fromNear(length, 0.1), fromNear(length, 0.45), 1]}
        style={StyleSheet.absoluteFill}
      />
    </Plane>
  );
});

const SideWall = memo(function SideWall({ walk, cam, side, length }: { walk: SharedValue<number>; cam: SharedValue<Camera>; side: -1 | 1; length: number }) {
  const { FLOOR, CEILING, CASE_TOP } = useGeometry();
  const { season } = use(SeasonContext);
  const left = side === -1;
  const all = span(length);
  return (
    <Plane
      cam={cam}
      width={all}
      height={FLOOR - CEILING}
      transform={[
        { translateX: side * HALF_WIDTH },
        { translateY: (FLOOR + CEILING) / 2 },
        { rotateY: left ? '90deg' : '-90deg' },
        { translateX: left ? (length - NEAR_Z) / 2 : (NEAR_Z - length) / 2 },
      ]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#34473b' }]} />
      <LinearGradient
        colors={['rgba(218,190,135,0.1)', 'rgba(18,27,21,0.04)', 'rgba(8,14,11,0.2)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.wallRail} />
      {/* Above the bookcases, where the wall is bare, moving along with them. */}
      {season === 'christmas' && <Garland length={all} top={(CASE_TOP - CEILING) * 0.32} walk={walk} side={side} />}
      <LinearGradient
        colors={['rgba(8,5,2,0)', 'rgba(8,5,2,0.6)', 'rgba(8,5,2,0.95)']}
        locations={[fromNear(length, 0.05), fromNear(length, 0.4), fromNear(length, 0.9)]}
        start={{ x: left ? 0 : 1, y: 0 }}
        end={{ x: left ? 1 : 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Plane>
  );
});

/** The far end of the hallway: a tall window with moonlight, or at Christmas a snowy night with a wreath and presents. */
const FarWall = memo(function FarWall({ walk, cam, length }: { walk: SharedValue<number>; cam: SharedValue<Camera>; length: number }) {
  const { FLOOR, CEILING } = useGeometry();
  const { season, playing } = use(SeasonContext);
  const height = FLOOR - CEILING;
  const christmas = season === 'christmas';
  return (
    <Facing walk={walk} cam={cam} x={0} y={(FLOOR + CEILING) / 2} z={-length} hideAfter={0} besides width={2 * HALF_WIDTH} height={height}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#22170f' }]} />
      <View style={styles.window}>
        {christmas ? (
          <ChristmasWindow height={height * WINDOW_SHARE - 12} playing={playing} />
        ) : (
          <>
            <LinearGradient colors={['#2c3e5c', '#4d6a8c', '#22324a']} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.moon} />
          </>
        )}
        <View style={styles.mullionV} />
        <View style={[styles.mullionH, { top: '40%' }]} />
        <View style={[styles.mullionH, { top: '70%' }]} />
      </View>
      <View style={styles.sill} />
      {christmas && (
        <>
          <View style={[styles.wreath, { top: height * 0.105 - 22 }]}>
            <Wreath size={44} />
          </View>
          <FarEndPresents />
        </>
      )}
    </Facing>
  );
});

/** How much of the far wall's height the window takes (styles.window: 21% from the top, 36% from the bottom). */
const WINDOW_SHARE = 0.43;

/** A pendant lamp over the hallway, casting a cone of light down to a faint pool on the floor. */
const Lamp = memo(function Lamp({ walk, cam, z }: { walk: SharedValue<number>; cam: SharedValue<Camera>; z: number }) {
  const { CEILING, FLOOR } = useGeometry();
  // From the mouth of the shade to the floor, in the lamp's own box (its top is 55 above the lamp's middle).
  const drop = FLOOR - (CEILING + 42) + 55 - CONE_TOP;
  // Farther lamps light up less of the dark.
  const far = useAnimatedStyle(() => ({ opacity: clamp(1 - (-seenAt(cam.value, 0, z + walk.value) - 300) / 1100, 0.3, 1) }));
  return (
    <Facing walk={walk} cam={cam} x={0} y={CEILING + 42} z={z} hideAfter={LAMP_HIDE} fadeFrom={LAMP_FADE} dims width={120} height={110}>
      <Animated.View style={[StyleSheet.absoluteFill, FADING, far]}>
        {/* Overlapping, ever longer and fainter cones: brightest by the bulb, fading towards the floor. */}
        {CONE_LAYERS.map((share) => {
          const h = drop * share.length;
          const spread = h * CONE_SPREAD * share.width;
          return (
            <View
              key={share.length}
              style={[styles.cone, { left: 60 - CONE_MOUTH / 2 - spread, width: CONE_MOUTH + 2 * spread, borderBottomWidth: h, borderLeftWidth: spread, borderRightWidth: spread, borderBottomColor: share.color }]}
            />
          );
        })}
        <LinearGradient
          colors={['rgba(255,214,140,0)', 'rgba(255,214,140,0.07)', 'rgba(255,214,140,0)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.pool, { top: CONE_TOP + drop - 12, left: 60 - (CONE_MOUTH / 2 + drop * CONE_SPREAD) * 0.6, width: (CONE_MOUTH + 2 * drop * CONE_SPREAD) * 0.6 }]}
        />
      </Animated.View>
      <View style={styles.bulbGlow} />
      <View style={styles.cord} />
      <LinearGradient colors={['#dfb858', '#a6762a', '#79501f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.shade}>
        <View style={styles.shadeHighlight} />
      </LinearGradient>
      <LinearGradient colors={['#fff5cd', '#ffd973']} style={styles.bulb} />
    </Facing>
  );
});

/** The cone's mouth and spread, with nested layers to soften its edges. */
const CONE_TOP = 64;
const CONE_MOUTH = 34;
const CONE_SPREAD = 0.42;
const CONE_LAYERS = [
  { length: 1, width: 1, color: 'rgba(255,214,140,0.018)' },
  { length: 0.76, width: 0.76, color: 'rgba(255,225,164,0.022)' },
  { length: 0.5, width: 0.5, color: 'rgba(255,237,196,0.026)' },
] as const;

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

/**
 * The top of a friend's shelf screen (its header and its line of counts, without their words), fading in at the end
 * of the turn to a bookcase, so their shelf opens over it without a jump.
 */
function ShelfTop({ cam, top }: { cam: SharedValue<Camera>; top: number }) {
  const style = useAnimatedStyle(() => ({ opacity: clamp((cam.value.t - 0.7) / 0.3, 0, 1) }));
  return (
    <Animated.View style={[styles.shelfTop, FADING, style]} pointerEvents="none">
      <View style={[styles.shelfHeader, { height: top + SHELF_HEADER }]} />
      <View style={styles.shelfCounts} />
    </Animated.View>
  );
}

/** Darkens everything drawn before it (the room, and bookcases farther along) as the camera turns to a bookcase. */
function Dim({ cam }: { cam: SharedValue<Camera> }) {
  const style = useAnimatedStyle(() => ({ opacity: cam.value.dim * DIM }));
  return <Animated.View style={[styles.fog, FADING, style]} pointerEvents="none" />;
}

/** The hallway itself, drawn once; `walk` and `cam` move it. `chosen` is the bookcase being turned to, if any. */
const Hallway = memo(function Hallway({ walk, cam, friends, chosen }: { walk: SharedValue<number>; cam: SharedValue<Camera>; friends: HallwayFriend[]; chosen: number }) {
  const { cases, length, lamps } = useMemo(() => hallwayFor(friends), [friends]);
  // The nearest bookcases get their books at once; the rest as a transition, which React renders in small slices, so
  // reaching a long hallway doesn't hold up the page.
  const [stocked, setStocked] = useState(NEAR_CASES);
  useEffect(() => {
    if (cases.length > NEAR_CASES) startTransition(() => setStocked(cases.length));
  }, [cases.length]);
  return (
    <>
      <Ceiling walk={walk} cam={cam} length={length} />
      <Floor walk={walk} cam={cam} length={length} />
      <SideWall walk={walk} cam={cam} side={-1} length={length} />
      <SideWall walk={walk} cam={cam} side={1} length={length} />
      <FarWall walk={walk} cam={cam} length={length} />
      {cases
        .map((c, i) => ({ c, i }))
        .reverse()
        .map(({ c, i }) => (
          <Fragment key={c.friend.key}>
            {/* Bookcases nearer than the chosen one darken themselves (they're drawn after it). */}
            {i === chosen && <Dim cam={cam} />}
            <SideCase walk={walk} cam={cam} friend={c.friend} side={c.side} near={c.near} withBooks={i < stocked} chosen={i === chosen} />
          </Fragment>
        ))}
      {[...lamps].reverse().map((z) => (
        <Lamp key={z} walk={walk} cam={cam} z={z} />
      ))}
    </>
  );
});

/**
 * Walking down a library hallway, with a bookcase for each friend along both walls, each with an aisle sign with their
 * name and picture. Dragging up or down walks, and stops at the nearest bookcase.
 *
 * Without `friends` it's the What's to come preview: made-up friends, and a loop of swiping down to walk further in.
 * With them it's the real Friends screen: it stays where you leave it, `onWalk` hears which bookcase is in front,
 * tapping a bookcase opens it, whichever it is (`onOpen`), and `walkTo` walks to a bookcase (each new `key` walks again). With `fill` it fills its
 * parent, edge to edge, and the hallway is as tall as the screen; otherwise it's a box the shape of the preview.
 *
 * Opening a friend's bookcase walks up the hallway to it and turns to face it, stepping up close, until it fills the
 * screen the way their shelf does; then their shelf opens over it. `onMoving` hears when that starts and when it's
 * over (back in the hallway), so the screen can clear its buttons out of the way.
 */
export function FriendsLibraryHallway({
  friends,
  onWalk,
  onOpen,
  walkTo,
  openRequest,
  onMoving,
  fill,
}: {
  friends?: HallwayFriend[];
  onWalk?: (index: number) => void;
  onOpen?: (index: number) => void;
  walkTo?: { index: number; key: number };
  /** Open this bookcase as if tapped (turning to it first); each new `key` opens again. */
  openRequest?: { index: number; key: number };
  onMoving?: (moving: boolean) => void;
  fill?: boolean;
}) {
  const demo = !friends;
  const list = useMemo(() => friends ?? demoFriends(), [friends]);
  const { reached, current } = usePageState();
  const reducedMotion = useReducedMotion();
  const focused = useIsFocused();
  // Dressed for the season it is when the hallway opens; snow only falls while it's on screen.
  const [season] = useState(currentSeason);
  const seasonState = useMemo(() => ({ season, playing: reached && current && focused && !reducedMotion }), [season, reached, current, focused, reducedMotion]);
  // The hallway is drawn once its size is known and its page reached. In a box it keeps the preview's shape; filling
  // the screen it's as tall as the screen, at most a portrait page wide (centred in a wide window).
  const [size, setSize] = useState({ width: 0, height: 0 });
  const pictureWidth = fill ? Math.min(size.width, size.height * 0.75) : size.width;
  const k = pictureWidth / W;
  const g = useMemo(() => (fill && size.height && pictureWidth ? geometry(Math.max(BOX_H, Math.round((W * size.height) / pictureWidth))) : BOX), [fill, size.height, pictureWidth]);

  const clock = useSharedValue(reducedMotion ? STILL_MS : 0);
  /** 1 while a drag has taken over from the loop, and always for real friends. */
  const manual = useSharedValue(demo ? 0 : 1);
  /**
   * Real friends: at stop j+1, bookcase j is the one most in view (the nearer one, diagonally across from the one just
   * ahead; see focusAt), so stops run from 1 to the number of bookcases and stop j+1 is bookcase j's. The preview walks
   * from the entrance.
   */
  const offset = demo ? 0 : 1;
  const manualWalk = useSharedValue(offset * STOP);
  const dragStart = useSharedValue(0);
  /** Darkens the picture while it fades back to the start after a drag. */
  const dim = useSharedValue(0);
  const looping = useSharedValue(0);
  const walk = useDerivedValue(() => (manual.value ? manualWalk.value : walkAt(clock.value)));

  const last = Math.max(0, list.length - 1);
  const firstStop = offset;
  const lastStop = last + offset;

  // Which bookcase is in front, for the screen around it.
  const [front, setFront] = useState(0);
  const reportWalk = (index: number) => {
    setFront(index);
    onWalk?.(index);
  };
  /** While walking to a bookcase to open it, it's the one in front all the way. */
  const holdFront = useSharedValue(-1);
  useAnimatedReaction(
    () => (holdFront.value >= 0 ? holdFront.value : clamp(Math.round(walk.value / STOP) - offset, 0, last)),
    (index, previous) => {
      if (index !== previous && !demo) scheduleOnRN(reportWalk, index);
    },
  );

  // Walk to a bookcase when asked (search), at an easy pace: further takes a little longer.
  useEffect(() => {
    if (!walkTo || demo) return;
    const target = (clamp(walkTo.index, 0, last) + offset) * STOP;
    cancelAnimation(manualWalk);
    manual.set(1);
    if (reducedMotion) manualWalk.set(target);
    else manualWalk.set(withTiming(target, { duration: Math.min(1400, 350 + Math.abs(target - manualWalk.get()) * 2), easing: Easing.inOut(Easing.cubic) }));
  }, [walkTo, demo, last, offset, reducedMotion, manual, manualWalk]);

  // Fewer bookcases than before (a request answered, a friend removed): stay within the hallway.
  useEffect(() => {
    if (!demo && manualWalk.get() > lastStop * STOP) manualWalk.set(lastStop * STOP);
  }, [demo, lastStop, manualWalk]);

  // Tapping opens the bookcase tapped, wherever it is on either wall: hit-tested where it's drawn from the walk right
  // now, nearest first (see hallwayHit). A tap that moves becomes a drag instead.
  const cases = useMemo(() => hallwayFor(list).cases, [list]);
  const viewAt = (walkNow: number): HallwayView => ({
    walk: walkNow,
    VX,
    VY: g.VY,
    EYE,
    W,
    H: g.H,
    HALF_WIDTH,
    FRONT_X,
    CASE_LENGTH,
    CASE_TOP: g.CASE_TOP,
    FLOOR: g.FLOOR,
    SIGN_SPAN,
    SIGN_BOTTOM: g.CASE_TOP + SIGN.drop + SIGN.height,
  });
  /** A point on the frame, in picture units. */
  const toPicture = (x: number, y: number) => ({ x: (x - size.width / 2) / k + W / 2, y: (y - (g.H * k) / 2) / k + g.H / 2 });
  // Opening a friend's bookcase: walk up the hallway until it's just ahead, then turn to face it while stepping up close,
  // until it fills the screen as their shelf will; then their shelf opens over it. Coming back, the camera turns back and
  // steps back to that bookcase's stop. Requests open their sheet at once, and with reduced motion so does all.
  const turn = useSharedValue(0);
  const turnTo = useSharedValue<TurnTarget>({ side: 0, x: 0, y: 0, z: 0 });
  const cam = useDerivedValue(() => cameraAt(turn.value, turnTo.value));
  /** 1 from a tap on a bookcase until back in the hallway: drags and taps wait. */
  const moving = useSharedValue(0);
  const turning = useRef(false);
  const [chosen, setChosen] = useState(-1);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const tapAt = (x: number, y: number) => {
    if (turning.current) return;
    const p = toPicture(x, y);
    const index = caseAt(cases, viewAt(walk.get()), p.x, p.y);
    if (index >= 0) openCase(index);
  };
  const settled = () => {
    turning.current = false;
    moving.set(0);
    holdFront.set(-1);
    startTransition(() => setChosen(-1));
    onMoving?.(false);
  };
  const cancelOpening = () => {
    turn.set(0);
    settled();
  };
  /**
   * Where the camera ends up facing a bookcase: close enough that a shelf is as tall as on the friend's shelf screen,
   * so its books are the same size, centred on it, with its top shelf where that screen's first shelf starts.
   */
  const faceTarget = (side: -1 | 1): TurnTarget => {
    const shelfRow = shelfMetrics(shelfZoom(windowWidth)).rowHeight;
    const distance = clamp((EYE * k * g.ROW_HEIGHT) / shelfRow, 50, FRONT_X + 60);
    // The first shelf with books on it (see CaseFront) goes where the shelf screen's first shelf is.
    const firstShelf = (insets.top + SHELF_HEADER + SHELF_COUNT_LINE) / k;
    const rise = g.CASE_TOP + CROWN + eyeShelfOf(g) * g.ROW_HEIGHT - ((firstShelf - g.VY) * distance) / EYE;
    return { side, x: side * (FRONT_X - distance), y: rise, z: STAND + CASE_LENGTH / 2 };
  };
  /** Walks up to a bookcase and turns to face it, then opens it; requests open at once. */
  const openCase = (index: number) => {
    const selected = cases[index];
    if (turning.current || !selected) return;
    if (reducedMotion || demo || selected.friend.request) {
      onOpen?.(index);
      return;
    }
    turning.current = true;
    moving.set(1);
    holdFront.set(index);
    // Drawing the bookcase in depth renders it again: in slices, while the walk to it goes on.
    startTransition(() => setChosen(index));
    onMoving?.(true);
    manual.set(1);
    cancelAnimation(manualWalk);
    cancelAnimation(turn);
    turn.set(0);
    turnTo.set(faceTarget(selected.side));
    // Stand with the bookcase's near end just ahead: further away walks a little longer, and faster.
    const stand = EYE - STAND - selected.near;
    const walkMs = clamp(WALK_MS + Math.abs(stand - manualWalk.get()) * 0.2, WALK_MS, WALK_MS_MAX);
    manualWalk.set(withTiming(stand, { duration: walkMs, easing: Easing.inOut(Easing.cubic) }));
    // Turning starts as the walk slows down.
    turn.set(
      withDelay(
        walkMs - TURN_OVERLAP_MS,
        withTiming(1, { duration: TURN_MS, easing: Easing.linear }, (finished) => {
          'worklet';
          if (finished) scheduleOnRN(opened, index);
          else scheduleOnRN(cancelOpening);
        }),
      ),
    );
  };
  // Asked to open a bookcase from outside the picture (the caption): the same way as a tap.
  const lastOpenRequest = useRef(openRequest?.key);
  useEffect(() => {
    if (!openRequest || openRequest.key === lastOpenRequest.current) return;
    lastOpenRequest.current = openRequest.key;
    openCase(openRequest.index);
    // openCase reads the latest walk and bookcases when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest]);
  // Facing the bookcase: its shelf opens over it. Taps stay off until the camera is back in the hallway.
  const opened = (index: number) => onOpen?.(index);
  useFocusEffect(
    useCallback(() => {
      // Back from a shelf: turn back to the hallway, and step back to that bookcase's stop as the turn ends.
      // The bookcase turned to is the one held in front.
      const index = holdFront.get();
      if (index < 0 || turn.get() === 0) return;
      const stop = (index + offset) * STOP;
      if (reducedMotion) {
        turn.set(0);
        manualWalk.set(stop);
        settled();
        return;
      }
      turn.set(withTiming(0, { duration: TURN_MS, easing: Easing.linear }));
      manualWalk.set(
        withDelay(
          TURN_MS * 0.55,
          withTiming(stop, { duration: WALK_BACK_MS, easing: Easing.inOut(Easing.cubic) }, () => {
            'worklet';
            scheduleOnRN(settled);
          }),
        ),
      );
      // settled reads only refs, shared values and the latest onMoving.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [turn, manualWalk, holdFront, offset, reducedMotion]),
  );
  const tap = useTapGesture({ enabled: !!onOpen && list.length > 0, runOnJS: true, maxDistance: 10, onActivate: (e) => tapAt(e.x, e.y) });
  // Each bookcase you can make out from where you stand is a button for screen readers, where it's drawn.
  const targets = useMemo(() => {
    if (demo || !pictureWidth) return [];
    const view = viewAt((front + offset) * STOP);
    return cases.flatMap((c, index) => {
      const box = caseBounds(c, view);
      if (!box) return [];
      const left = (box.x - W / 2) * k + size.width / 2;
      const top = (box.y - g.H / 2) * k + (g.H * k) / 2;
      return [{ index, friend: c.friend, style: { left, top, width: box.w * k, height: box.h * k } }];
    });
    // viewAt only reads geometry already listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, cases, front, offset, g, k, pictureWidth, size.width]);
  const drag = usePanGesture({
    // On the web, leave sideways swipes to the browser, so they still turn the page. Gesture handler reads this from the
    // config, but its types leave it out.
    // @ts-expect-error touchAction is a web-only gesture option missing from PanGestureConfig
    touchAction: 'pan-x',
    activeOffsetY: [-8, 8],
    failOffsetX: [-12, 12],
    onActivate: () => {
      'worklet';
      // Not while walking up to a bookcase to open it, or turning back from one.
      if (moving.value) return;
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
      if (moving.value) return;
      manualWalk.set(stretch(dragStart.value + e.translationY * DRAG_WALK, firstStop, lastStop));
    },
    onDeactivate: (e) => {
      'worklet';
      if (moving.value) return;
      // Like letting go of a list: a flick carries on, then the walk settles on the nearest bookcase. With reduced
      // motion it goes straight to the nearest one.
      const speed = e.velocityY * DRAG_WALK;
      if (reducedMotion) manualWalk.set(nearestStop(manualWalk.value, firstStop, lastStop));
      else manualWalk.set(withSpring(nearestStop(manualWalk.value + speed * MOMENTUM, firstStop, lastStop), { ...SETTLE, velocity: speed }));
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

  const playing = demo && reached && current && !reducedMotion;
  useEffect(() => {
    if (!demo) return;
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
  }, [demo, playing, clock, manual, dim, looping]);

  const gesture = useCompetingGestures(drag, tap);

  const darkness = useAnimatedStyle(() => ({ opacity: Math.max(dim.value, manual.value ? 0 : fadeAt(clock.value)) }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={fill ? styles.fill : styles.frame}
        onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        // The preview is one picture, described as such; with real friends, each bookcase is a button of its own (below).
        accessible={demo}
        accessibilityLabel={
          demo
            ? `A long library hallway seen at eye level, with ${list.length} bookcases full of books along both walls and a window at the far end. Each bookcase belongs to a friend and has an aisle sign with their name and a round photo: ${list.map((f) => f.name).join(', ')}. The picture walks down the hallway, as if swiping down; drag up or down on it to walk yourself, and it stops at the nearest bookcase.`
            : undefined
        }>
        {reached && pictureWidth > 0 && (
          <View
            style={[styles.hallway, { height: g.H, left: (size.width - W) / 2, top: (g.H * k - g.H) / 2, transform: [{ scale: k }] }]}
            pointerEvents="none">
            <GeometryContext value={g}>
              <SeasonContext value={seasonState}>
                <Hallway walk={walk} cam={cam} friends={list} chosen={chosen} />
              </SeasonContext>
              {demo && !reducedMotion && <SwipeHint clock={clock} manual={manual} />}
            </GeometryContext>
            <Animated.View style={[styles.darkness, darkness]} />
          </View>
        )}
        {fill && !demo && <ShelfTop cam={cam} top={insets.top} />}
        {targets.map(({ index, friend: f, style }) => (
          <Pressable
            key={f.key}
            style={[styles.target, style]}
            onPress={() => onOpen?.(index)}
            accessibilityRole="button"
            accessibilityLabel={`${f.name}’s bookcase${f.request === 'incoming' ? ', friend request' : f.request ? ', request sent' : f.news ? ', new activity' : ''}`}
          />
        ))}
      </View>
    </GestureDetector>
  );
}

/** An aisle sign: its size, how far below the top of the bookcase it hangs, and its brackets. */
const SIGN = { width: 56, height: 62, drop: 6, gap: 5, bracket: 4, bracketInset: 9, bracketReach: 6 };
/** From the wall to the sign's far edge: the bookcase's end, the gap the brackets span, and the sign. */
const SIGN_SPAN = CASE_DEPTH + SIGN.gap + SIGN.width;
/**
 * Opening a bookcase: the walk up to it stops when its near end is STAND ahead, taking WALK_MS to WALK_MS_MAX by how
 * far it is; then the turn to face it, which starts a little before the walk ends; coming back, the step back to its
 * stop. The rest darkens by DIM at most.
 */
const STAND = 60;
const WALK_MS = 250;
const WALK_MS_MAX = 400;
const TURN_MS = 520;
const TURN_OVERLAP_MS = 90;
const WALK_BACK_MS = 360;
const DIM = 0.85;
/**
 * Where a friend's shelf screen (friends/[id]) starts its first shelf, below its header and its line of counts, so the
 * camera can line the bookcase up with it.
 */
const SHELF_HEADER = Platform.select({ ios: 44, android: 56, default: 64 });
const SHELF_COUNT_LINE = 32;
/** How far the floor, ceiling and side walls carry on past the picture, behind the eye. */
const NEAR_Z = 2 * EYE;
/** Signs fade out as they come past the picture towards you, between these depths; lamps overhead too. */
const SIGN_FADE = 50;
const SIGN_HIDE = 100;
/** A bookcase whose near end has come this far past the picture is gone (hallwayHit uses the same). */
const CASE_HIDE = 100;
const LAMP_FADE = -140;
const LAMP_HIDE = -30;
/** How far down the hallway signs have faded out. */
const SIGN_GONE = 900;

/**
 * Whether a bookcase's front shows: hidden once all of it has come past the picture (with the camera turned, the eye).
 * Defined after CASE_HIDE, which a worklet captures where it's defined.
 */
const frontShows = (c: Camera, side: -1 | 1, nearZ: number) => {
  'worklet';
  const x = side * FRONT_X;
  return EYE + Math.min(camZ(c, x, nearZ), camZ(c, x, nearZ - CASE_LENGTH)) <= hideAt(c, CASE_HIDE);
};

const styles = StyleSheet.create({
  frame: { width: '100%', maxWidth: 432, aspectRatio: W / BOX_H, alignSelf: 'center', borderRadius: 14, overflow: 'hidden', backgroundColor: '#0d0905' },
  fill: { ...StyleSheet.absoluteFill, overflow: 'hidden', backgroundColor: '#0d0905' },
  hallway: { position: 'absolute', width: W },
  // Only for screen readers and keyboards: taps go through to the hallway, which hit-tests them itself.
  target: { position: 'absolute', pointerEvents: 'none' },
  darkness: { ...StyleSheet.absoluteFill, backgroundColor: '#0d0905' },
  casePlane: { position: 'absolute', left: VX - CASE_LENGTH / 2, width: CASE_LENGTH },
  caseFront: { width: CASE_LENGTH },
  potential: { opacity: 0.42 },
  potentialOutline: { ...StyleSheet.absoluteFill, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(232,200,117,0.85)', borderRadius: 3 },
  potentialTrim: { borderStyle: 'dashed', borderColor: 'rgba(232,200,117,0.9)', borderWidth: 1.5 },
  bookend: { width: 3, height: 15, marginLeft: 1, backgroundColor: '#2b2420', borderTopRightRadius: 1, borderTopWidth: 1, borderTopColor: '#6a5a4c' },
  shelves: { flex: 1, paddingHorizontal: POST },
  rowBack: { flex: 1, marginBottom: PLANK },
  rowBooks: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.32)' },
  plank: { height: PLANK, overflow: 'hidden' },
  plankTopFace: { height: 1.5 },
  plankFace: { flex: 1, borderTopWidth: 0.5, borderTopColor: 'rgba(236,190,126,0.55)' },
  caseBase: { height: BASE },
  post: { position: 'absolute', top: 0, bottom: 0, width: POST, borderLeftWidth: 2 },
  fog: { ...StyleSheet.absoluteFill, backgroundColor: '#0d0905' },
  signFog: { borderRadius: 5 },
  potentialSign: { opacity: 0.85, shadowOpacity: 0 },
  potentialSignFace: { borderStyle: 'dashed', borderColor: '#f3e3b0', borderWidth: 1.5, opacity: 0.9 },
  newsDot: { position: 'absolute', top: -5, width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.accent, borderWidth: 2, borderColor: '#2a1a0c' },
  requestDot: { backgroundColor: Colors.ribbon, borderColor: '#f6e7c1' },
  book: { position: 'relative', overflow: 'visible' },
  pages: { position: 'absolute', top: 2, right: 0, bottom: 0, backgroundColor: '#d8c49b', borderTopRightRadius: 1, borderRightWidth: 0.5, borderRightColor: 'rgba(255,244,218,0.45)' },
  spine: { position: 'absolute', top: 0, bottom: 0, borderTopLeftRadius: 1, borderTopRightRadius: 1, borderLeftWidth: 0.6, borderLeftColor: 'rgba(0,0,0,0.35)', overflow: 'hidden' },
  bands: { position: 'absolute', left: 0, right: 0, top: 3, bottom: 3, borderTopWidth: 1, borderBottomWidth: 1 },
  band: { position: 'absolute', left: 0, right: 0, top: 3, height: 3, opacity: 0.85 },
  spineFrame: { position: 'absolute', left: 1, right: 1, top: 2, bottom: 2, borderWidth: 0.6 },
  endPanel: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  oneSided: { backfaceVisibility: 'hidden' },
  shelfTop: { position: 'absolute', left: 0, right: 0, top: 0 },
  shelfHeader: { backgroundColor: Colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  shelfCounts: { height: SHELF_COUNT_LINE, backgroundColor: Colors.background },
  backShadow: { position: 'absolute', left: 0, right: 0, height: 26 },
  shelfSurface: { position: 'absolute', left: VX - CASE_LENGTH / 2, width: CASE_LENGTH, height: CASE_DEPTH },
  endTrim: { position: 'absolute', left: 4, right: 4, top: CROWN, bottom: BASE, borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)', borderRadius: 2 },
  sign: { position: 'absolute', top: 0, width: SIGN.width, height: SIGN.height, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  signFace: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 3, borderRadius: 5, borderWidth: 1.5, borderColor: '#7a5a22' },
  bracket: { position: 'absolute', width: SIGN.gap + 2 * SIGN.bracketReach, height: SIGN.bracket, borderRadius: 1, backgroundColor: '#2b2420', borderTopWidth: 1, borderTopColor: '#6a5a4c' },
  photoFrame: { width: 30, height: 30, borderRadius: 15, padding: 2.5, backgroundColor: '#4f311b' },
  photo: { flex: 1, borderRadius: 13, overflow: 'hidden', alignItems: 'center' },
  head: { width: 9, height: 9, borderRadius: 5, marginTop: 4, backgroundColor: 'rgba(255,245,228,0.85)' },
  initialPhoto: { justifyContent: 'center' },
  initial: { color: 'rgba(255,245,228,0.95)', fontFamily: Fonts.serif, fontSize: 14, fontWeight: '700' },
  shoulders: { width: 19, height: 14, borderRadius: 10, marginTop: 2, backgroundColor: 'rgba(255,245,228,0.85)' },
  name: { color: Wood.brassText, fontFamily: Fonts.serif, fontSize: 13, fontWeight: '700' },
  boards: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  board: { height: '100%', borderRightWidth: 1, borderRightColor: 'rgba(30,16,6,0.55)' },
  runner: { position: 'absolute', left: 116, right: 116, top: 0, bottom: 0, borderLeftWidth: 3, borderRightWidth: 3, borderColor: '#c99a4a' },
  runnerMotif: { position: 'absolute', left: HALF_WIDTH - 9, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.2, borderColor: 'rgba(221,184,102,0.7)', transform: [{ rotate: '45deg' }] },
  runnerMotifInner: { width: 6, height: 6, borderWidth: 1, borderColor: 'rgba(238,207,138,0.75)', backgroundColor: 'rgba(44,18,21,0.45)' },
  crosswise: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  joint: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(30,16,6,0.5)' },
  caseShadow: { position: 'absolute', width: 28, top: 0, bottom: 0 },
  beam: { position: 'absolute', left: 0, right: 0, height: 14, backgroundColor: '#3b281a', borderBottomWidth: 2, borderBottomColor: '#1c120b' },
  wallRail: { position: 'absolute', left: 0, right: 0, top: 70, height: 7, backgroundColor: '#67513a', borderTopWidth: 1, borderTopColor: 'rgba(220,184,119,0.55)', borderBottomWidth: 2, borderBottomColor: 'rgba(16,23,17,0.55)' },
  window: { position: 'absolute', left: 120, right: 120, top: '21%', bottom: '36%', borderTopLeftRadius: 50, borderTopRightRadius: 50, overflow: 'hidden', borderWidth: 6, borderColor: '#3a2817' },
  moon: { position: 'absolute', top: 30, right: 22, width: 18, height: 18, borderRadius: 9, backgroundColor: '#f1e8c8' },
  mullionV: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 4, marginLeft: -2, backgroundColor: '#3a2817' },
  mullionH: { position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: '#3a2817' },
  wreath: { position: 'absolute', left: HALF_WIDTH - 22 },
  sill: { position: 'absolute', left: 110, right: 110, bottom: '34%', height: 8, backgroundColor: '#5a3c22' },
  cone: { position: 'absolute', top: CONE_TOP, height: 0, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  pool: { position: 'absolute', height: 24, borderRadius: 999 },
  bulbGlow: { position: 'absolute', left: 46, top: 54, width: 28, height: 26, borderRadius: 14, backgroundColor: 'rgba(255,225,164,0.12)' },
  cord: { position: 'absolute', left: 59, top: 0, width: 2, height: 48, backgroundColor: '#15100b' },
  shade: { position: 'absolute', left: 40, top: 46, width: 40, height: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  shadeHighlight: { position: 'absolute', left: 7, top: 2, bottom: 2, width: 4, borderRadius: 2, backgroundColor: 'rgba(255,235,180,0.22)' },
  bulb: { position: 'absolute', left: 52, top: 62, width: 16, height: 9, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  hint: { position: 'absolute', right: 26, top: 92, width: 26, alignItems: 'center' },
  trail: { width: 10, height: 56, borderRadius: 5, marginBottom: -12 },
  finger: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,248,230,0.85)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.95)', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4 },
});
