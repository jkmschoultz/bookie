import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

/**
 * The Friends hallway at Christmas (see library/season): a snowy night with a lit tree out of the window, a wreath on
 * the far wall, presents and a small tree at the far end, and a garland of lights along the top of the side walls.
 * All plain views, few of them, in the hallway's own units.
 */

const LIGHTS = ['#ffd77a', '#ff8a5c', '#fff1c4', '#e8b04a', '#ff6f61'];

/** A triangle pointing up, `w` wide at its base and `h` tall, from borders. */
function Triangle({ w, h, color, style }: { w: number; h: number; color: string; style?: object }) {
  return <View style={[{ width: 0, height: 0, borderLeftWidth: w / 2, borderRightWidth: w / 2, borderBottomWidth: h, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }, style]} />;
}

/** A fir tree `h` tall, its tiers dusted with snow (`snow`) or not, with a few warm lights and a star. */
function Tree({ h, snow, lights = 7 }: { h: number; snow?: boolean; lights?: number }) {
  const tiers = [
    { w: 0.78, h: 0.42, top: 0.48 },
    { w: 0.62, h: 0.38, top: 0.27 },
    { w: 0.44, h: 0.34, top: 0.08 },
  ];
  const width = h * 0.78;
  return (
    <View style={{ width, height: h }}>
      <View style={[styles.trunk, { left: width / 2 - h * 0.05, width: h * 0.1, height: h * 0.14 }]} />
      {tiers.map((t, i) => (
        <View key={i} style={{ position: 'absolute', top: t.top * h, left: (width - t.w * h) / 2 }}>
          <Triangle w={t.w * h} h={t.h * h} color={i % 2 ? '#24502f' : '#1e4428'} />
          {snow && <Triangle w={t.w * h * 0.42} h={t.h * h * 0.42} color="#e9f0f6" style={{ position: 'absolute', left: (t.w * h * 0.58) / 2, top: 0 }} />}
        </View>
      ))}
      {Array.from({ length: lights }, (_, i) => {
        // Spread down the tree in a loose zigzag, wider towards the bottom.
        const y = 0.24 + (0.66 * (i + 0.5)) / lights;
        const x = 0.5 + (i % 2 ? 1 : -1) * (0.08 + 0.26 * y) * (0.6 + 0.4 * ((i * 37) % 10) / 10);
        return <View key={i} style={[styles.light, { left: x * width - 1.6, top: y * h, backgroundColor: LIGHTS[i % LIGHTS.length] }]} />;
      })}
      <View style={[styles.star, { left: width / 2 - h * 0.04, top: h * 0.03, width: h * 0.08, height: h * 0.08 }]} />
    </View>
  );
}

/** Flakes as [x (share of the width), y (share of the height), size]: one screenful, drawn twice for a seamless loop. */
const FLAKES: [number, number, number][] = [
  [0.08, 0.05, 2.2], [0.3, 0.14, 1.6], [0.55, 0.02, 2], [0.8, 0.1, 1.5], [0.18, 0.33, 1.8], [0.68, 0.28, 2.3],
  [0.9, 0.42, 1.6], [0.42, 0.46, 2], [0.1, 0.62, 1.5], [0.6, 0.6, 1.8], [0.33, 0.78, 2.2], [0.82, 0.8, 1.6],
];

/** Snow falling past the window. `playing` false holds it still (off screen, or with reduced motion). */
function Snowfall({ height, playing }: { height: number; playing: boolean }) {
  const fall = useSharedValue(0);
  useEffect(() => {
    if (!playing) {
      cancelAnimation(fall);
      return;
    }
    fall.set(withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(fall);
  }, [playing, fall]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (fall.value - 1) * height }] }));
  return (
    <Animated.View style={[styles.snowLayer, { height: 2 * height }, style]} pointerEvents="none">
      {[0, 1].map((copy) =>
        FLAKES.map(([x, y, size], i) => (
          <View key={`${copy}-${i}`} style={[styles.flake, { left: `${x * 100}%`, top: (y + copy) * height, width: size, height: size, borderRadius: size }]} />
        )),
      )}
    </Animated.View>
  );
}

/** What's out of the window at Christmas: a snowy night, a lit tree on the snow, and falling snow. */
export function ChristmasWindow({ height, playing }: { height: number; playing: boolean }) {
  const tree = Math.min(110, height * 0.36);
  return (
    <>
      <LinearGradient colors={['#121c2e', '#283a58', '#3a4f70']} locations={[0, 0.65, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.hill} />
      <View style={[styles.treeOutside, { bottom: height * 0.11 }]}>
        <Tree h={tree} snow lights={8} />
      </View>
      <View style={styles.snowGround} />
      <Snowfall height={height} playing={playing} />
    </>
  );
}

/** A wreath with a red bow, for the far wall. */
export function Wreath({ size }: { size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.wreath, { width: size, height: size, borderRadius: size / 2, borderWidth: size * 0.22 }]} />
      {[0.15, 0.4, 0.68, 0.86].map((a, i) => {
        const angle = a * 2 * Math.PI - Math.PI / 2;
        const r = size * 0.39;
        return <View key={i} style={[styles.berry, { left: size / 2 + r * Math.cos(angle) - 2, top: size / 2 + r * Math.sin(angle) - 2 }]} />;
      })}
      <View style={[styles.bow, { left: size / 2 - size * 0.24, top: size * 0.8, width: size * 0.22, transform: [{ rotate: '-20deg' }] }]} />
      <View style={[styles.bow, { left: size / 2 + size * 0.02, top: size * 0.8, width: size * 0.22, transform: [{ rotate: '20deg' }] }]} />
    </View>
  );
}

/** Wrapped presents and a small lit tree, standing at the foot of the far wall. */
export function FarEndPresents() {
  const box = (w: number, h: number, color: string, ribbon: string, left: number) => (
    <View key={left} style={[styles.present, { width: w, height: h, left, backgroundColor: color }]}>
      <View style={[styles.ribbonV, { backgroundColor: ribbon, left: w / 2 - 1.5 }]} />
      <View style={[styles.ribbonH, { backgroundColor: ribbon, top: h / 2 - 1.5 }]} />
    </View>
  );
  return (
    <>
      <View style={styles.presentsLeft}>
        {box(34, 26, '#8e2430', '#e8c875', 0)}
        {box(22, 18, '#2f5a36', '#f3ead6', 38)}
        {box(26, 34, '#c9a24a', '#8e2430', 64)}
      </View>
      <View style={styles.smallTree}>
        <Tree h={96} lights={6} />
      </View>
    </>
  );
}

/**
 * A garland of swags with warm lights, along a wall `length` long. It slides along the wall as you walk, like the
 * bookcases, so it moves past in perspective instead of staying put on the screen. `side` is the wall's side: the near
 * end is on the left of the left wall's view and on the right of the right wall's. The lights' colours repeat every
 * LOOP, so sliding round by that much is seamless.
 */
export function Garland({ length, top, walk, side }: { length: number; top: number; walk: SharedValue<number>; side: -1 | 1 }) {
  const swags = Math.ceil(length / SWAG) + 2;
  const slide = useAnimatedStyle(() => {
    const along = ((walk.value % LOOP) + LOOP) % LOOP;
    return { transform: [{ translateX: side === -1 ? -along : along - LOOP }] };
  });
  return (
    <Animated.View style={[styles.garland, { top, width: (swags + LOOP / SWAG) * SWAG }, OWN_LAYER, slide]} pointerEvents="none">
      {Array.from({ length: swags + LOOP / SWAG }, (_, i) => (
        <View key={i} style={[styles.swag, { left: i * SWAG }]}>
          <View style={[styles.swagLight, { backgroundColor: LIGHTS[i % LIGHTS.length] }]} />
        </View>
      ))}
    </Animated.View>
  );
}

const SWAG = 80;
/** On the web the garland gets a layer of its own, so sliding it doesn't repaint the whole wall each frame. */
const OWN_LAYER = Platform.OS === 'web' ? ({ willChange: 'transform' } as object) : null;
/** The garland repeats every so many swags (one round of the lights' colours), so sliding by this much looks the same. */
const LOOP = SWAG * LIGHTS.length;

const styles = StyleSheet.create({
  trunk: { position: 'absolute', bottom: 0, backgroundColor: '#3b2a1c' },
  light: { position: 'absolute', width: 3.2, height: 3.2, borderRadius: 1.6 },
  star: { position: 'absolute', backgroundColor: '#ffd77a', transform: [{ rotate: '45deg' }] },
  snowLayer: { position: 'absolute', left: 0, right: 0, top: 0 },
  flake: { position: 'absolute', backgroundColor: 'rgba(240,246,255,0.9)' },
  hill: { position: 'absolute', left: '-30%', right: '-10%', bottom: '6%', height: '22%', borderRadius: 999, backgroundColor: '#9fb0c6' },
  snowGround: { position: 'absolute', left: '-20%', right: '-20%', bottom: '-8%', height: '22%', borderRadius: 999, backgroundColor: '#dfe7f0' },
  treeOutside: { position: 'absolute', left: '8%' },
  wreath: { borderColor: '#2b5a34' },
  berry: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: '#c9283a' },
  bow: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: '#b3202a' },
  presentsLeft: { position: 'absolute', left: 44, bottom: 0, width: 100, height: 36 },
  present: { position: 'absolute', bottom: 0, borderRadius: 1.5 },
  ribbonV: { position: 'absolute', top: 0, bottom: 0, width: 3 },
  ribbonH: { position: 'absolute', left: 0, right: 0, height: 3 },
  smallTree: { position: 'absolute', right: 46, bottom: 0 },
  garland: { position: 'absolute', left: 0, height: 18 },
  swag: { position: 'absolute', top: 0, width: SWAG, height: 14, borderBottomWidth: 3, borderLeftWidth: 0, borderRightWidth: 0, borderColor: '#2b5a34', borderBottomLeftRadius: SWAG / 2, borderBottomRightRadius: SWAG / 2 },
  swagLight: { position: 'absolute', left: SWAG / 2 - 2.5, bottom: -4, width: 5, height: 5, borderRadius: 2.5 },
});
