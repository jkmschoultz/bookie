import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Colors, Fonts } from '@/constants/theme';
import type { SpineStyle } from '@/shelf/spineStyle';
import type { Book } from '@/types';

interface Props {
  book: Book;
  style: SpineStyle;
  onOpen: (book: Book) => void;
  onLongPress: (book: Book) => void;
}

const SHADING = ['rgba(0,0,0,0.38)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.3)'] as const;
const SHADING_STOPS = [0, 0.22, 0.55, 1] as const;
const TEXT_PAD = 14;

function Decoration({ s }: { s: SpineStyle }) {
  const band = { backgroundColor: s.accentColor, left: 0, right: 0, position: 'absolute' as const };
  switch (s.decoration) {
    case 'bands':
      return (
        <>
          <View style={[band, { top: 8, height: 2 }]} />
          <View style={[band, { top: 12, height: 1 }]} />
          <View style={[band, { bottom: 12, height: 1 }]} />
          <View style={[band, { bottom: 8, height: 2 }]} />
        </>
      );
    case 'band':
      return <View style={[band, { top: '14%', height: 10, opacity: 0.85 }]} />;
    case 'label':
      return <View style={[styles.label, { borderColor: s.accentColor }]} />;
    case 'frame':
      return <View style={[styles.frame, { borderColor: s.accentColor }]} />;
    default:
      return null;
  }
}

function SpineComponent({ book, style: s, onOpen, onLongPress }: Props) {
  const lift = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: -14 * lift.value }, { scale: 1 + 0.04 * lift.value }],
    zIndex: lift.value > 0 ? 10 : 0,
  }));

  const titleSize = Math.max(7, Math.min(13, s.width * 0.42));
  const showAuthor = s.width >= 20;
  const textLength = s.height - TEXT_PAD * 2;
  const faded = book.status === 'want' && !book.owned;

  const open = () => {
    lift.value = withTiming(1, { duration: 140 });
    setTimeout(() => {
      onOpen(book);
      lift.value = withSpring(0, { damping: 14 });
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
      <Animated.View style={[{ width: s.width, height: s.height, opacity: faded ? 0.5 : 1 }, animated]}>
        <View style={[styles.spine, { backgroundColor: s.color }]}>
          <Decoration s={s} />
          <LinearGradient
            colors={SHADING}
            locations={SHADING_STOPS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {book.status === 'dnf' && <View style={styles.dnf} />}
          {/* Text is laid out horizontally, then rotated to run top-to-bottom. */}
          <View
            style={[
              styles.textRow,
              {
                width: textLength,
                height: s.width,
                left: (s.width - textLength) / 2,
                top: (s.height - s.width) / 2,
              },
            ]}>
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                color: s.textColor,
                fontSize: titleSize,
                fontFamily: s.font === 'serif' ? Fonts.serif : Fonts.sans,
                fontWeight: s.font === 'sans' ? '700' : '600',
                letterSpacing: s.uppercase ? 0.8 : 0.2,
              }}>
              {s.uppercase ? book.title.toUpperCase() : book.title}
            </Text>
            {showAuthor && (
              <Text numberOfLines={1} style={[styles.author, { color: s.textColor, fontSize: Math.max(7, titleSize * 0.72), maxWidth: textLength * 0.4 }]}>
                {book.authors[0]?.split(' ').at(-1) ?? ''}
              </Text>
            )}
          </View>
        </View>
        {book.status === 'reading' && <View style={styles.bookmark} />}
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
    top: '30%',
    bottom: '30%',
    left: 3,
    right: 3,
    borderWidth: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,248,230,0.12)',
  },
  frame: {
    position: 'absolute',
    top: 5,
    bottom: 5,
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
