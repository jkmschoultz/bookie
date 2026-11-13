import { usePathname } from 'expo-router';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { useBookFlight } from '@/library/bookFlight';
import { nextTransition } from '@/library/screenTransition';

/**
 * Animates moving between screens on web, where the stack swaps screens instantly: new screens slide in from the right
 * and back slides in from the left; sheets rise from the bottom and fade away when closed. Phones already animate
 * natively, so this does nothing there. Stays still while a book flies to or from its page, which is its own animation.
 */
export function ScreenTransitions({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return children;
  return <WebTransitions>{children}</WebTransitions>;
}

function WebTransitions({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const trail = useRef<string[] | null>(null);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // A layout effect, so the new screen starts from its offset before the browser paints it in place.
  useLayoutEffect(() => {
    if (!trail.current) {
      trail.current = [path];
      return;
    }
    const next = nextTransition(trail.current, path);
    trail.current = next.trail;
    if (!next.transition || reduceMotion || useBookFlight.getState().flight) return;

    const start = {
      forward: { x: width * 0.3, y: 0, scale: 1, opacity: 0.4 },
      back: { x: -width * 0.22, y: 0, scale: 1, opacity: 0.5 },
      'sheet-open': { x: 0, y: height * 0.22, scale: 1, opacity: 0 },
      'sheet-close': { x: 0, y: 0, scale: 0.96, opacity: 0.35 },
    }[next.transition];
    const timing = { duration: next.transition === 'sheet-open' ? 300 : 260, easing: Easing.out(Easing.cubic) };
    x.set(start.x);
    y.set(start.y);
    scale.set(start.scale);
    opacity.set(start.opacity);
    x.set(withTiming(0, timing));
    y.set(withTiming(0, timing));
    scale.set(withTiming(1, timing));
    opacity.set(withTiming(1, timing));
  }, [path, width, height, reduceMotion, x, y, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
