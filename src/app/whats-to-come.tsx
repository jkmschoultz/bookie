import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageStateContext } from '@/components/PageState';
import { WHATS_TO_COME_PAGES as PAGES } from '@/components/whatsToComePages';
import { Colors, Fonts } from '@/constants/theme';
import { markWhatsToComeSeen } from '@/library/onboarding';

/**
 * A click-through preview of ideas for later. Offered once on its own (see `shouldShowWhatsToCome`), and any time from
 * Settings. Nothing in it works yet.
 */
export default function WhatsToComeScreen() {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  // The farthest page shown so far, or being moved to. Pictures on later pages wait to draw (see PageState).
  const [reached, setReached] = useState(0);
  const reach = (i: number) => setReached((r) => Math.max(r, Math.min(PAGES.length - 1, i)));
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const pager = useRef<ScrollViewInstance>(null);
  const last = index === PAGES.length - 1;

  // Pages sit side by side in a paging scroller, as in the welcome tour, so they can be swiped or stepped through.
  const goTo = (i: number) => {
    reach(i);
    pager.current?.scrollTo({ x: i * width, animated: true });
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return;
    const at = e.nativeEvent.contentOffset.x / width;
    setIndex(Math.min(PAGES.length - 1, Math.max(0, Math.round(at))));
    // Start drawing the next page as soon as it begins to slide in.
    reach(Math.ceil(at - 0.01));
  };

  const close = async () => {
    await markWhatsToComeSeen();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.topBar}>
        {!last && (
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
            <Text style={styles.close}>Close</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.swipeArea} onLayout={(e) => setSize(e.nativeEvent.layout)}>
        {width > 0 && height > 0 && (
          <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
            {PAGES.map((page, i) => (
              <ScrollView key={page.title} alwaysBounceVertical style={{ width, height }} contentContainerStyle={styles.content}>
                <View style={styles.page}>
                  <Text style={styles.tag}>{page.tag}</Text>
                  <Text style={styles.icon}>{page.icon}</Text>
                  <Text style={styles.title}>{page.title}</Text>
                  <Text style={styles.body}>{page.body}</Text>
                  <PageStateContext.Provider value={{ reached: i <= reached, current: i === index }}>{page.visual}</PageStateContext.Provider>
                </View>
              </ScrollView>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.dots} accessibilityLabel={`Page ${index + 1} of ${PAGES.length}`}>
        {PAGES.map((p, i) => (
          <View key={p.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      <View style={styles.buttons}>
        {index > 0 && (
          <Pressable style={styles.back} onPress={() => goTo(index - 1)} accessibilityRole="button">
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        )}
        <Pressable style={styles.next} onPress={last ? close : () => goTo(index + 1)} accessibilityRole="button">
          <Text style={styles.nextText}>{last ? 'Close' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 24 },
  topBar: { height: 24, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  close: { color: Colors.textMuted, fontSize: 15, fontWeight: '600' },
  swipeArea: { flex: 1, marginHorizontal: -24 },
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  page: { gap: 12, maxWidth: 480, width: '100%', alignSelf: 'center', paddingHorizontal: 24 },
  tag: {
    alignSelf: 'flex-start',
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  icon: { fontSize: 40, color: Colors.accent },
  title: { color: Colors.text, fontSize: 28, fontFamily: Fonts.serif, fontWeight: '700' },
  body: { color: Colors.textMuted, fontSize: 16, lineHeight: 23, marginBottom: 6 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12, marginBottom: 18 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.accent, width: 20 },
  buttons: { flexDirection: 'row', gap: 12, maxWidth: 480, width: '100%', alignSelf: 'center' },
  back: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  backText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  next: { flex: 1, backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  nextText: { color: Colors.accentText, fontSize: 16, fontWeight: '700' },
});
