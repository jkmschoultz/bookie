import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Colors, Fonts } from '@/constants/theme';
import { registerSpine, useBookFlight, type Rect, type SpineRect } from '@/library/bookFlight';
import { creases, ghostColors, GHOST_FILL, MARKER_REACH, spineCues } from '@/shelf/spineCues';
import { labelBoxHeight } from '@/shelf/spineBoxes';
import { DECORATION, LABEL_WASH, type SpineStyle } from '@/shelf/spineStyle';
import { LINE_HEIGHT } from '@/shelf/spineText';
import { byZoom } from '@/shelf/zoom';
import type { Book } from '@/types';

interface Props {
  book: Book;
  style: SpineStyle;
  onOpen: (book: Book, from?: SpineRect) => void;
  onLongPress: (book: Book) => void;
}

const SHADING = ['rgba(0,0,0,0.38)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.3)'] as const;
const SHADING_STOPS = [0, 0.22, 0.55, 1] as const;
/** A soft highlight down an unread book's crisp spine. */
const SHEEN = ['rgba(255,255,255,0)', 'rgba(255,255,255,0.24)', 'rgba(255,255,255,0)'] as const;
const SHEEN_STOPS = [0.26, 0.36, 0.5] as const;
/** A crease's pale line, clear at both ends so it can fade in and out. */
const CREASE = ['rgba(255,250,238,0)', 'rgba(255,250,238,0.34)', 'rgba(255,250,238,0.34)', 'rgba(255,250,238,0)'] as const;
const CREASE_WIDTH = 1;

/**
 * Spine ornaments, where spineBoxes says they are: getSpineStyle only picks one that stays clear of the text (a frame
 * on a thin spine becomes bands), and the label box wraps the title.
 */
function Decoration({ s }: { s: SpineStyle }) {
  const z = s.zoom;
  const styles = stylesFor(z);
  const band = { backgroundColor: s.accentColor, left: 0, right: 0, position: 'absolute' as const };
  const { bands } = DECORATION;
  switch (s.decoration) {
    case 'bands':
      return (
        <>
          <View style={[band, { top: bands.outer * z, height: 2 * z }]} />
          <View style={[band, { top: bands.inner * z, height: z }]} />
          <View style={[band, { bottom: bands.inner * z, height: z }]} />
          <View style={[band, { bottom: bands.outer * z, height: 2 * z }]} />
        </>
      );
    case 'band':
      return <View style={[band, { top: DECORATION.band.top * z, height: DECORATION.band.height * z, opacity: 0.85 }]} />;
    case 'label': {
      const pad = DECORATION.labelPad * z;
      const top = s.text.start - pad;
      const height = labelBoxHeight(s.height / z, { ...s.text, start: s.text.start / z, end: s.text.end / z, titleLength: s.text.titleLength / z }) * z;
      return <View style={[styles.label, { top, height, borderColor: s.accentColor }]} />;
    }
    case 'frame':
      return <View style={[styles.frame, { top: DECORATION.frame * z, bottom: DECORATION.frame * z, borderColor: s.accentColor }]} />;
    default:
      return null;
  }
}

/** How a spine looks: colour, ornaments, shading, its upright title and its status cue. Also drawn tipped over in a pile, and by the book flying to its page. */
export function SpineFace({ book, style: s }: { book: Book; style: SpineStyle }) {
  const { text, zoom } = s;
  const styles = stylesFor(zoom);
  const cues = spineCues(book);
  const ghost = cues.ghost ? ghostColors(s.color) : null;
  // The text runs between its insets, which differ per decoration (e.g. more room below a band at the top).
  const textLength = s.height - text.start - text.end;
  return (
    <>
      <View style={styles.spine}>
        {/* A ghost book (wanted, not owned) is only a see-through fill inside a dashed outline. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: s.color }, ghost && { opacity: GHOST_FILL }]}>
          <Decoration s={s} />
          <LinearGradient colors={SHADING} locations={SHADING_STOPS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </View>
        {cues.creases && <Creases book={book} style={s} />}
        {cues.sheen && (
          <LinearGradient colors={SHEEN} locations={SHEEN_STOPS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        )}
        {ghost && <View style={[styles.ghostOutline, { borderColor: ghost.outline }]} />}
        {/* Text is laid out horizontally, then rotated to run top-to-bottom. */}
        <View
          style={[
            styles.textRow,
            {
              width: textLength,
              height: s.width,
              left: (s.width - textLength) / 2,
              top: (s.height - s.width) / 2 + (text.start - text.end) / 2,
            },
          ]}>
          {/* Lines are pre-fitted to the spine (shrunk or wrapped), so nothing should be cut off. */}
          <Text
            numberOfLines={text.numberOfLines}
            style={{
              flexShrink: 1,
              color: ghost?.text ?? s.textColor,
              fontSize: text.fontSize,
              lineHeight: text.fontSize * LINE_HEIGHT,
              textAlign: text.lines.length > 1 ? 'center' : 'left',
              fontFamily: s.font === 'serif' ? Fonts.serif : Fonts.sans,
              fontWeight: s.font === 'sans' ? '700' : '600',
              letterSpacing: (s.uppercase ? 0.8 : 0.2) * zoom,
            }}>
            {text.lines.join('\n')}
          </Text>
          {text.author && (
            <Text
              numberOfLines={1}
              style={[styles.author, { color: ghost?.text ?? s.textColor, fontSize: text.authorSize, maxWidth: textLength * 0.4 }]}>
              {text.author}
            </Text>
          )}
        </View>
      </View>
      {/* Markers tucked into the pages stick out of the top, behind the spine. */}
      {cues.ribbon && <View style={styles.bookmark} />}
      {cues.tab && <View style={styles.tab} />}
      {cues.slip && <View style={styles.slip} />}
    </>
  );
}

/**
 * A read book's spine creases: pale lines where the ink cracked off the cover, each with a faint shadow along one side,
 * fading out where the crease starts, stops or breaks off. Each piece is a thin line turned to join its two ends.
 */
function Creases({ book, style: s }: { book: Book; style: SpineStyle }) {
  const z = s.zoom;
  const styles = stylesFor(z);
  // Placed on the spine at its normal size, then drawn bigger, so a zoomed spine has the very same creases.
  return (
    <>
      {creases(book.id, s.width / z, s.height / z, s.textBoxes).flatMap((crease, i) =>
        crease.map((piece, j) => {
          const { strength, fadeStart, fadeEnd } = piece;
          const [x1, y1, x2, y2] = [piece.x1 * z, piece.y1 * z, piece.x2 * z, piece.y2 * z];
          const length = Math.hypot(x2 - x1, y2 - y1);
          const fade = Math.min(0.35, (10 * z) / length);
          return (
            <LinearGradient
              key={`${i}-${j}`}
              colors={CREASE}
              locations={[0, fadeStart ? fade : 0, fadeEnd ? 1 - fade : 1, 1]}
              style={[
                styles.crease,
                {
                  left: (x1 + x2) / 2 - (CREASE_WIDTH * z) / 2,
                  top: (y1 + y2) / 2 - length / 2,
                  height: length,
                  opacity: strength,
                  transform: [{ rotate: `${(Math.atan2(x1 - x2, y2 - y1) * 180) / Math.PI}deg` }],
                },
              ]}>
              <View style={[styles.creaseShadow, { top: `${fadeStart ? 20 : 0}%`, bottom: `${fadeEnd ? 20 : 0}%` }]} />
            </LinearGradient>
          );
        }),
      )}
    </>
  );
}

function SpineComponent({ book, style: s, onOpen, onLongPress }: Props) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const lift = useSharedValue(0);
  const liftBy = 14 * s.zoom;
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: -liftBy * lift.value }, { scale: 1 + 0.04 * lift.value }],
    zIndex: lift.value > 0 ? 10 : 0,
  }));
  // While this book is flying to or from its page it isn't on the shelf.
  const away = useBookFlight((f) => f.flight?.book.id === book.id);
  // Let a book coming back from its page find where to land.
  useEffect(
    () =>
      registerSpine(
        book.id,
        () =>
          new Promise((resolve) => {
            if (!ref.current) resolve(null);
            else ref.current.measureInWindow((x, y, width, height) => resolve({ x, y, width, height, style: s }));
          }),
      ),
    [book.id, s],
  );

  const open = () => {
    lift.value = withTiming(1, { duration: 140 });
    setTimeout(() => {
      const done = (from?: Rect) => {
        onOpen(book, from && { ...from, style: s });
        lift.value = withSpring(0, { damping: 14 });
      };
      // Where the lifted book is on screen, for the flight to its page to start from.
      if (ref.current) ref.current.measureInWindow((x, y, width, height) => done({ x, y, width, height }));
      else done();
    }, 150);
  };

  return (
    <Pressable
      onPress={open}
      onLongPress={() => onLongPress(book)}
      onPressIn={() => (lift.value = withTiming(0.35, { duration: 90 }))}
      onPressOut={() => (lift.value = withTiming(0, { duration: 160 }))}
      accessibilityRole="button"
      accessibilityLabel={`${book.title} by ${book.authors.join(', ')}`}>
      <Animated.View
        ref={ref}
        style={[{ width: s.width, height: s.height, opacity: away ? 0 : spineCues(book).opacity }, animated]}>
        <SpineFace book={book} style={s} />
      </Animated.View>
    </Pressable>
  );
}

export const Spine = memo(SpineComponent);

const stylesFor = byZoom((z) =>
  StyleSheet.create({
    spine: {
      flex: 1,
      borderTopLeftRadius: 2 * z,
      borderTopRightRadius: 2 * z,
      overflow: 'hidden',
    },
    textRow: {
      position: 'absolute',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8 * z,
      transform: [{ rotate: '90deg' }],
    },
    author: {
      flexShrink: 0,
      opacity: 0.85,
      fontStyle: 'italic',
    },
    label: {
      position: 'absolute',
      left: DECORATION.side * z,
      right: DECORATION.side * z,
      borderWidth: DECORATION.line * z,
      borderRadius: z,
      backgroundColor: `${LABEL_WASH.color}${Math.round(LABEL_WASH.opacity * 255).toString(16).padStart(2, '0')}`,
    },
    frame: {
      position: 'absolute',
      left: DECORATION.side * z,
      right: DECORATION.side * z,
      borderWidth: Math.min(DECORATION.line, StyleSheet.hairlineWidth * 2) * z,
    },
    crease: {
      position: 'absolute',
      width: CREASE_WIDTH * z,
    },
    creaseShadow: {
      position: 'absolute',
      left: CREASE_WIDTH * z,
      width: z,
      backgroundColor: 'rgba(0,0,0,0.16)',
    },
    ghostOutline: {
      ...StyleSheet.absoluteFill,
      borderWidth: 1.5 * z,
      borderStyle: 'dashed',
      borderRadius: 2 * z,
    },
    bookmark: {
      position: 'absolute',
      top: -MARKER_REACH.ribbon * z,
      right: '18%',
      width: 6 * z,
      height: 16 * z,
      backgroundColor: Colors.ribbon,
      borderTopLeftRadius: z,
      borderTopRightRadius: z,
      zIndex: -1,
    },
    tab: {
      position: 'absolute',
      top: -MARKER_REACH.tab * z,
      left: '20%',
      width: 8 * z,
      height: 12 * z,
      backgroundColor: Colors.tab,
      borderTopLeftRadius: z,
      borderTopRightRadius: z,
      zIndex: -1,
    },
    slip: {
      position: 'absolute',
      top: (-MARKER_REACH.slip + 2) * z,
      left: '24%',
      width: 7 * z,
      height: 22 * z,
      backgroundColor: Colors.paper,
      transform: [{ rotate: '-14deg' }],
      zIndex: -1,
    },
  }),
);
