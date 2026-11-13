import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { Rect } from '@/library/bookFlight';
import { largeCoverUrl } from '@/services/metadata/openLibrary';
import type { Book } from '@/types';

import { COVER_ASPECT, Cover } from './Cover';

const OPEN_MS = 280;
const CLOSE_MS = 220;

interface Props {
  book: Book;
  /** Where the cover is on the page: it grows from there, and shrinks back there. */
  from: Rect;
  onClose: () => void;
}

/** The cover, lifted off the page and shown big over a darkened screen. Tapping anywhere puts it back. */
export function CoverZoom({ book, from, onClose }: Props) {
  const screen = useWindowDimensions();
  const width = Math.min(screen.width - 48, (screen.height - 120) / COVER_ASPECT, 460);
  const height = width * COVER_ASPECT;
  const target = { x: (screen.width - width) / 2, y: (screen.height - height) / 2 };
  const startScale = from.width / width;

  const p = useSharedValue(0);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    p.set(withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) }));
  }, [p]);
  const close = () => {
    if (closing) return;
    setClosing(true);
    p.set(withTiming(0, { duration: CLOSE_MS, easing: Easing.inOut(Easing.cubic) }));
    setTimeout(onClose, CLOSE_MS);
  };

  const backdrop = useAnimatedStyle(() => ({ opacity: p.value }));
  const cover = useAnimatedStyle(() => ({
    transform: [
      { translateX: (from.x - target.x) * (1 - p.value) },
      { translateY: (from.y - target.y) * (1 - p.value) },
      { scale: startScale + (1 - startScale) * p.value },
    ],
  }));

  const large = largeCoverUrl(book.coverUrl);
  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close the cover">
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]} />
        <Animated.View style={[styles.cover, { left: target.x, top: target.y, width, height }, cover]}>
          <Cover book={book} width={width} />
          {/* The sharper large photo, over the medium one once it has loaded. */}
          {large && large !== book.coverUrl && (
            <View style={StyleSheet.absoluteFill}>
              <Image source={large} style={[StyleSheet.absoluteFill, styles.large]} contentFit="cover" transition={250} />
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(10,6,3,0.88)' },
  cover: { position: 'absolute', transformOrigin: 'left top' },
  large: { borderRadius: 4 },
});
