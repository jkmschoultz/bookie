import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Colors, Fonts } from '@/constants/theme';
import { registerSpine, useBookFlight, type Rect, type SpineRect } from '@/library/bookFlight';
import { DECORATION, UNOWNED_OPACITY, type SpineStyle } from '@/shelf/spineStyle';
import { LINE_HEIGHT } from '@/shelf/spineText';
import type { Book } from '@/types';

interface Props {
  book: Book;
  style: SpineStyle;
  onOpen: (book: Book, from?: SpineRect) => void;
  onLongPress: (book: Book) => void;
}

const SHADING = ['rgba(0,0,0,0.38)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.3)'] as const;
const SHADING_STOPS = [0, 0.22, 0.55, 1] as const;

/** Spine ornaments. The text is set clear of them (see TEXT_INSETS in spineStyle), and the label box wraps the title. */
function Decoration({ s }: { s: SpineStyle }) {
  const band = { backgroundColor: s.accentColor, left: 0, right: 0, position: 'absolute' as const };
  const { bands } = DECORATION;
  switch (s.decoration) {
    case 'bands':
      return (
        <>
          <View style={[band, { top: bands.outer, height: 2 }]} />
          <View style={[band, { top: bands.inner, height: 1 }]} />
          <View style={[band, { bottom: bands.inner, height: 1 }]} />
          <View style={[band, { bottom: bands.outer, height: 2 }]} />
        </>
      );
    case 'band':
      return <View style={[band, { top: DECORATION.band.top, height: DECORATION.band.height, opacity: 0.85 }]} />;
    case 'label': {
      const pad = DECORATION.labelPad;
      const top = s.text.start - pad;
      const height = Math.min(s.text.titleLength + 2 * pad, s.height - top - s.text.end + pad);
      return <View style={[styles.label, { top, height, borderColor: s.accentColor }]} />;
    }
    case 'frame':
      return <View style={[styles.frame, { top: DECORATION.frame, bottom: DECORATION.frame, borderColor: s.accentColor }]} />;
    default:
      return null;
  }
}

/** How a spine looks: colour, ornaments, shading and its upright title. Also drawn by the book flying to its page. */
export function SpineFace({ book, style: s }: { book: Book; style: SpineStyle }) {
  const { text } = s;
  // The text runs between its insets, which differ per decoration (e.g. more room below a band at the top).
  const textLength = s.height - text.start - text.end;
  return (
    <>
      <View style={[styles.spine, { backgroundColor: s.color }]}>
        <Decoration s={s} />
        <LinearGradient colors={SHADING} locations={SHADING_STOPS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        {book.status === 'dnf' && <View style={styles.dnf} />}
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
              color: s.textColor,
              fontSize: text.fontSize,
              lineHeight: text.fontSize * LINE_HEIGHT,
              textAlign: text.lines.length > 1 ? 'center' : 'left',
              fontFamily: s.font === 'serif' ? Fonts.serif : Fonts.sans,
              fontWeight: s.font === 'sans' ? '700' : '600',
              letterSpacing: s.uppercase ? 0.8 : 0.2,
            }}>
            {text.lines.join('\n')}
          </Text>
          {text.author && (
            <Text numberOfLines={1} style={[styles.author, { color: s.textColor, fontSize: text.authorSize, maxWidth: textLength * 0.4 }]}>
              {text.author}
            </Text>
          )}
        </View>
      </View>
      {book.status === 'reading' && <View style={styles.bookmark} />}
    </>
  );
}

function SpineComponent({ book, style: s, onOpen, onLongPress }: Props) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const lift = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: -14 * lift.value }, { scale: 1 + 0.04 * lift.value }],
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
        style={[{ width: s.width, height: s.height, opacity: away ? 0 : book.owned ? 1 : UNOWNED_OPACITY }, animated]}>
        <SpineFace book={book} style={s} />
      </Animated.View>
    </Pressable>
  );
}

export const Spine = memo(SpineComponent);

const styles = StyleSheet.create({
  spine: {
    flex: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    overflow: 'hidden',
  },
  textRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    transform: [{ rotate: '90deg' }],
  },
  author: {
    flexShrink: 0,
    opacity: 0.85,
    fontStyle: 'italic',
  },
  label: {
    position: 'absolute',
    left: 3,
    right: 3,
    borderWidth: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,248,230,0.12)',
  },
  frame: {
    position: 'absolute',
    left: 3,
    right: 3,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  dnf: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(20,12,6,0.35)',
  },
  bookmark: {
    position: 'absolute',
    top: -11,
    right: '18%',
    width: 6,
    height: 16,
    backgroundColor: Colors.ribbon,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
    zIndex: -1,
  },
});
