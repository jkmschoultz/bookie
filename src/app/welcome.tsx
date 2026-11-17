import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SupportNote } from '@/components/SupportNote';
import { TOUR_STEPS, inBrowserTab } from '@/components/tourSteps';
import { Colors, Fonts } from '@/constants/theme';
import { markOnboardingSeen, tourSteps } from '@/library/onboarding';

/**
 * First-launch walkthrough, also reachable from Settings. Opened with `since` (the tour version someone last saw), it
 * shows only what's new since then.
 */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { since } = useLocalSearchParams<{ since?: string }>();
  const { steps, whatsNew } = useMemo(() => {
    const web = inBrowserTab();
    const fresh = since ? tourSteps(TOUR_STEPS, Number(since), { web }) : [];
    return fresh.length ? { steps: fresh, whatsNew: true } : { steps: tourSteps(TOUR_STEPS, null, { web }), whatsNew: false };
  }, [since]);
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const pager = useRef<ScrollViewInstance>(null);
  const last = index === steps.length - 1;

  // The steps sit side by side in a paging scroller, so they follow your finger and snap into place. The buttons
  // scroll it too. Swiping never finishes the tour: that stays a deliberate tap on the last step.
  const goTo = (i: number) => pager.current?.scrollTo({ x: i * width, animated: true });
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.min(steps.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width))));
  };

  const finish = async () => {
    await markOnboardingSeen();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.topBar}>
        <Text style={styles.whatsNew}>{whatsNew ? 'What’s new in Bookie' : ''}</Text>
        {!last && (
          <Pressable onPress={finish} hitSlop={12} accessibilityRole="button">
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.swipeArea} onLayout={(e) => setSize(e.nativeEvent.layout)}>
        {width > 0 && height > 0 && (
          <ScrollView
            ref={pager}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}>
            {steps.map((step, i) => (
              <ScrollView key={step.title} alwaysBounceVertical style={{ width, height }} contentContainerStyle={styles.content}>
                <View style={styles.step}>
                  <Text style={styles.icon}>{step.icon}</Text>
                  <Text style={styles.title}>{step.title}</Text>
                  {step.points.map((p) => (
                    <View key={p} style={styles.point}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.pointText}>{p}</Text>
                    </View>
                  ))}

                  {step.visual}

                  {!whatsNew && i === steps.length - 1 && (
                    <View style={styles.devNote}>
                      <Text style={styles.devTitle}>🚧 Still in development</Text>
                      <Text style={styles.devBody}>
                        Bookie is an early prototype. Things may change, and you may run into bugs or rough edges along the way. Thanks for
                        trying it out, and do share anything that breaks or feels off.
                      </Text>
                    </View>
                  )}
                  {!whatsNew && i === steps.length - 1 && <SupportNote />}
                </View>
              </ScrollView>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Fixed height, so the page doesn't shift when the hint goes away after the first step. */}
      <View style={styles.hintRow}>
        {index === 0 && steps.length > 1 && <Text style={styles.hint}>Swipe left or right to move through, or use the buttons</Text>}
      </View>

      {steps.length > 1 && (
        <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${steps.length}`}>
          {steps.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
      <View style={styles.buttons}>
        {index > 0 && (
          <Pressable style={styles.back} onPress={() => goTo(index - 1)} accessibilityRole="button">
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        )}
        <Pressable style={styles.next} onPress={last ? finish : () => goTo(index + 1)} accessibilityRole="button">
          <Text style={styles.nextText}>{!last ? 'Next' : whatsNew ? 'Got it' : 'Got it, let’s go'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 24 },
  topBar: { height: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  whatsNew: { color: Colors.accent, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  swipeArea: { flex: 1, marginHorizontal: -24 },
  hintRow: { height: 28, justifyContent: 'center', alignItems: 'center' },
  hint: { color: Colors.textMuted, fontSize: 13 },
  skip: { color: Colors.textMuted, fontSize: 15, fontWeight: '600' },
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  step: { gap: 14, maxWidth: 480, width: '100%', alignSelf: 'center', paddingHorizontal: 24 },
  icon: { fontSize: 44, color: Colors.accent, marginBottom: 4 },
  title: { color: Colors.text, fontSize: 28, fontFamily: Fonts.serif, fontWeight: '700', marginBottom: 6 },
  point: { flexDirection: 'row', gap: 10 },
  bullet: { color: Colors.accent, fontSize: 16, lineHeight: 23 },
  pointText: { flex: 1, color: Colors.textMuted, fontSize: 16, lineHeight: 23 },
  devNote: {
    marginTop: 14,
    padding: 16,
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: Colors.surface,
  },
  devTitle: { color: Colors.accent, fontSize: 16, fontWeight: '700' },
  devBody: { color: Colors.text, fontSize: 15, lineHeight: 22 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 18 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.accent, width: 20 },
  buttons: { flexDirection: 'row', gap: 12, maxWidth: 480, width: '100%', alignSelf: 'center' },
  back: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  backText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  next: { flex: 1, backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  nextText: { color: Colors.accentText, fontSize: 16, fontWeight: '700' },
});
