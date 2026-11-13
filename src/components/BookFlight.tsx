import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { flightFrame, PULL_OUT_MS, useBookFlight, type Flight, type Rect } from '@/library/bookFlight';

import { COVER_ASPECT, Cover } from './Cover';
import { SpineFace } from './shelf/Spine';

const DURATION = 620;
/**
 * Coming out of the shelf, towards you. The page opens underneath after PULL_OUT_MS; the pull keeps easing out a
 * little longer, so the book is still moving while the page lays out and reports where its cover is.
 */
const PULL_MS = PULL_OUT_MS + 180;
const PULL_LIFT = 26;
const PULL_GROW = 0.12;
/** How long to wait for the book page before giving up and letting it show its own cover. */
const WAIT_FOR_PAGE = 2000;
const PERSPECTIVE = 900;

/** Draws the book flying from its shelf to its page, above every screen. Nothing while no book is flying. */
export function BookFlight() {
  const flight = useBookFlight((s) => s.flight);
  if (!flight) return null;
  return <FlyingBook key={`${flight.book.id}:${flight.from.x}:${flight.from.y}`} flight={flight} />;
}

/**
 * The book as two faces meeting at a corner: the spine on the left of the corner, the front cover on the right, at
 * right angles. Turning both faces together about that corner, with perspective, turns the book from its spine to its
 * cover. Both are drawn at the spine's shelf size and the whole book is scaled up on the way.
 */
function FlyingBook({ flight }: { flight: Flight }) {
  const { book, from, to } = flight;
  const finish = useBookFlight((s) => s.finish);
  const style = from.style;
  const coverWidth = style.height / COVER_ASPECT;
  // The page's cover is drawn at its full size and shrunk to the face, so it's sharp when it lands.
  const landedWidth = to?.width ?? coverWidth;
  const p = useSharedValue(0);
  const out = useSharedValue(0);

  useEffect(() => {
    out.value = withTiming(1, { duration: PULL_MS, easing: Easing.out(Easing.quad) });
  }, [out]);

  useEffect(() => {
    if (!to) {
      const giveUp = setTimeout(finish, WAIT_FOR_PAGE);
      return () => clearTimeout(giveUp);
    }
    p.value = withTiming(1, { duration: DURATION, easing: Easing.inOut(Easing.cubic) });
    const landed = setTimeout(finish, DURATION + 30);
    return () => clearTimeout(landed);
  }, [to, finish, p]);

  // Until the page reports where its cover is, aim at the spine's own spot so nothing moves.
  const target: Rect = to ?? { x: from.x + from.width, y: from.y, width: coverWidth, height: from.height };
  const startScale = from.height / style.height;

  const book3d = useAnimatedStyle(() => {
    const f = flightFrame(from, target, p.value);
    // The pull out of the shelf fades into the flight, so it lands exactly on the page's cover.
    const pull = out.value * (1 - p.value);
    return {
      left: f.hingeX,
      top: f.top - PULL_LIFT * pull,
      transform: [{ scale: startScale * f.scale * (1 + PULL_GROW * pull) }],
    };
  });
  const spineFace = useAnimatedStyle(() => {
    const { turn } = flightFrame(from, target, p.value);
    return { transform: [{ perspective: PERSPECTIVE }, { rotateY: `${turn}deg` }] };
  });
  const coverFace = useAnimatedStyle(() => {
    const { turn } = flightFrame(from, target, p.value);
    return { transform: [{ perspective: PERSPECTIVE }, { rotateY: `${turn - 90}deg` }] };
  });
  // Each face darkens as it turns away from you.
  const spineShade = useAnimatedStyle(() => ({ opacity: (flightFrame(from, target, p.value).turn / 90) * 0.55 }));
  const coverShade = useAnimatedStyle(() => ({ opacity: (1 - flightFrame(from, target, p.value).turn / 90) * 0.55 }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.book, { height: style.height }, book3d]}>
        <Animated.View style={[styles.face, styles.spine, { left: -style.width, width: style.width, height: style.height }, spineFace]}>
          <SpineFace book={book} style={style} />
          <Animated.View style={[styles.shade, spineShade]} />
        </Animated.View>
        <Animated.View style={[styles.face, styles.cover, { width: coverWidth, height: style.height }, coverFace]}>
          <View style={{ width: landedWidth, transform: [{ scale: coverWidth / landedWidth }], transformOrigin: 'left top' }}>
            <Cover book={book} width={landedWidth} />
          </View>
          <Animated.View style={[styles.shade, coverShade]} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // A zero-width box at the corner where spine meets cover; scaling about its top-left grows the book from there.
  book: { position: 'absolute', width: 0, transformOrigin: 'left top' },
  face: { position: 'absolute', top: 0, backfaceVisibility: 'hidden' },
  spine: { transformOrigin: 'right center' },
  cover: { left: 0, transformOrigin: 'left center', overflow: 'hidden', borderRadius: 4 },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: '#000' },
});
