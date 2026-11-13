import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { findSpine, flightFrame, PULL_OUT_MS, useBookFlight, type Flight, type Rect } from '@/library/bookFlight';
import { getSpineStyle } from '@/shelf/spineStyle';

import { COVER_ASPECT, Cover } from './Cover';
import { SpineFace } from './shelf/Spine';

const DURATION = 620;
/**
 * Coming out of the shelf, towards you. The page opens underneath after PULL_OUT_MS; the pull keeps easing out a
 * little longer, so the book is still moving while the page lays out and reports where its cover is.
 */
const PULL_MS = PULL_OUT_MS + 180;
/** Sliding back into its gap on the shelf, at the end of the way back. */
const PUSH_IN_MS = 200;
const PULL_LIFT = 26;
const PULL_GROW = 0.12;
/** How long to wait for the other end before giving up and letting the screens show their own book. */
const WAIT = 2000;
const PERSPECTIVE = 900;
/** The real cover (photo or title) shows over the blank one only for the last part of the way in. */
const REAL_COVER_FROM = 0.8;

/** Draws a book flying between its shelf and its page, above every screen. Nothing while no book is flying. */
export function BookFlight() {
  const flight = useBookFlight((s) => s.flight);
  if (!flight) return null;
  return <FlyingBook key={`${flight.direction}:${flight.book.id}`} flight={flight} />;
}

/**
 * The book as two faces meeting at a corner: the spine on the left of the corner, the front cover on the right, at
 * right angles, the way a real book's cloth wraps from spine to cover. Turning both together about that corner, with
 * perspective, turns the book from its spine to its cover; the corner ends up along the cover's left edge. Both are
 * drawn at the spine's shelf size and the whole book is scaled on the way.
 *
 * In flight the cover is blank, cloth in the spine's colour; the real cover fades in over it just before it lands
 * (and out again just after it leaves, on the way back).
 */
function FlyingBook({ flight }: { flight: Flight }) {
  const { book, direction, spine, cover } = flight;
  const finish = useBookFlight((s) => s.finish);
  const shelve = useBookFlight((s) => s.shelve);
  const screen = useWindowDimensions();
  const style = spine?.style ?? getSpineStyle(book);
  const coverWidth = style.height / COVER_ASPECT;
  // The real cover is drawn at its landed size and shrunk to the face, so it's sharp when it lands.
  const landedWidth = cover?.width ?? coverWidth;

  // 0 = on the shelf, 1 = on the page. `out` is how far it's pulled out of the shelf, towards you.
  const opening = direction === 'open';
  const p = useSharedValue(opening ? 0 : 1);
  const out = useSharedValue(opening ? 0 : 1);
  const fade = useSharedValue(1);

  // Way there: come out of the shelf straight away; fly once the page says where its cover is.
  useEffect(() => {
    if (!opening) return;
    out.set(withTiming(1, { duration: PULL_MS, easing: Easing.out(Easing.quad) }));
  }, [opening, out]);
  useEffect(() => {
    if (!opening) return;
    if (!cover) {
      const giveUp = setTimeout(finish, WAIT);
      return () => clearTimeout(giveUp);
    }
    p.set(withTiming(1, { duration: DURATION, easing: Easing.inOut(Easing.cubic) }));
    const landed = setTimeout(finish, DURATION + 30);
    return () => clearTimeout(landed);
  }, [opening, cover, finish, p]);

  // Way back: find the spine once the shelf is showing, fly to it, then slide back into the gap.
  useEffect(() => {
    if (opening || spine) return;
    let cancelled = false;
    const look = setTimeout(async () => {
      const found = await findSpine(book.id, screen);
      if (cancelled) return;
      if (found) shelve(book.id, found);
      else {
        // Its spine isn't on a shelf in view (filtered out, scrolled away, deleted): just fade out.
        fade.set(withTiming(0, { duration: 180 }));
        setTimeout(finish, 190);
      }
    }, 30);
    return () => {
      cancelled = true;
      clearTimeout(look);
    };
  }, [opening, spine, book.id, screen, shelve, finish, fade]);
  useEffect(() => {
    if (opening || !spine) return;
    p.set(withTiming(0, { duration: DURATION, easing: Easing.inOut(Easing.cubic) }));
    out.set(withDelay(DURATION, withTiming(0, { duration: PUSH_IN_MS, easing: Easing.inOut(Easing.quad) })));
    const shelved = setTimeout(finish, DURATION + PUSH_IN_MS + 30);
    return () => clearTimeout(shelved);
  }, [opening, spine, finish, p, out]);

  // Whichever end isn't known yet stands in as the other end, so nothing moves until it is.
  const from: Rect = spine ?? { x: cover!.x - style.width, y: cover!.y, width: style.width, height: style.height };
  const to: Rect = cover ?? { x: from.x + from.width, y: from.y, width: coverWidth, height: from.height };
  const baseScale = from.height / style.height;

  const book3d = useAnimatedStyle(() => {
    const f = flightFrame(from, to, p.value);
    // Coming out of the shelf blends into the flight, so it lands exactly on the page's cover (and back).
    const pull = out.value * (1 - p.value);
    return {
      left: f.hingeX,
      top: f.top - PULL_LIFT * pull,
      opacity: fade.value,
      transform: [{ scale: baseScale * f.scale * (1 + PULL_GROW * pull) }],
    };
  });
  const spineFace = useAnimatedStyle(() => ({
    transform: [{ perspective: PERSPECTIVE }, { rotateY: `${flightFrame(from, to, p.value).turn}deg` }],
  }));
  const coverFace = useAnimatedStyle(() => ({
    transform: [{ perspective: PERSPECTIVE }, { rotateY: `${flightFrame(from, to, p.value).turn - 90}deg` }],
  }));
  const realCover = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, (p.value - REAL_COVER_FROM) / (1 - REAL_COVER_FROM))),
  }));
  // Each face darkens as it turns away from you.
  const spineShade = useAnimatedStyle(() => ({ opacity: (flightFrame(from, to, p.value).turn / 90) * 0.55 }));
  const coverShade = useAnimatedStyle(() => ({ opacity: (1 - flightFrame(from, to, p.value).turn / 90) * 0.55 }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.book, { height: style.height }, book3d]}>
        <Animated.View style={[styles.face, styles.spine, { left: -style.width, width: style.width, height: style.height }, spineFace]}>
          <SpineFace book={book} style={style} />
          <Animated.View style={[styles.shade, spineShade]} />
        </Animated.View>
        <Animated.View style={[styles.face, styles.cover, { width: coverWidth, height: style.height }, coverFace]}>
          <BlankCover color={style.color} />
          <Animated.View style={[StyleSheet.absoluteFill, realCover]}>
            <View style={{ width: landedWidth, transform: [{ scale: coverWidth / landedWidth }], transformOrigin: 'left top' }}>
              <Cover book={book} width={landedWidth} />
            </View>
          </Animated.View>
          <Animated.View style={[styles.shade, coverShade]} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** The front board, carried on from the spine: same cloth and colour, with the hinge groove next to the spine. */
function BlankCover({ color }: { color: string }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: color }]}>
      <LinearGradient
        colors={['rgba(0,0,0,0.32)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.18)']}
        locations={[0, 0.1, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.groove} />
    </View>
  );
}

const styles = StyleSheet.create({
  // A zero-width box at the corner where spine meets cover; scaling about its top-left grows the book from there.
  book: { position: 'absolute', width: 0, transformOrigin: 'left top' },
  face: { position: 'absolute', top: 0, backfaceVisibility: 'hidden' },
  spine: { transformOrigin: 'right center' },
  cover: { left: 0, transformOrigin: 'left center', overflow: 'hidden', borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  groove: { position: 'absolute', top: 0, bottom: 0, left: '7%', width: 2, backgroundColor: 'rgba(0,0,0,0.22)' },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: '#000' },
});
