import { router } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeScreenGuide } from '@/components/HomeScreenGuide';
import { HomeAnimation } from '@/components/HomeAnimation';
import { OwnershipExample } from '@/components/OwnershipExample';
import { ReadingExample } from '@/components/ReadingExample';
import { SizeExample } from '@/components/SizeExample';
import { SupportNote } from '@/components/SupportNote';
import { Colors, Fonts } from '@/constants/theme';
import { markOnboardingSeen } from '@/library/onboarding';

interface Step {
  icon: string;
  title: string;
  points: string[];
  /** Shown under the points. */
  visual?: ReactNode;
  /** Only worth showing in a browser: the native app is already an app. */
  webOnly?: boolean;
}

const ALL_STEPS: Step[] = [
  {
    icon: '📚',
    title: 'Welcome to Bookie',
    points: [
      'Your books, on a virtual bookshelf.',
      'Swipe left and right to browse along a shelf, and up and down across the bookcase.',
      'Book sizes represent the real size of the books.',
    ],
    visual: <HomeAnimation />,
  },
  {
    icon: '＋',
    title: 'Fill your shelves',
    points: [
      'Tap ＋ to search for a book, scan the barcode on its back cover, or type in the details.',
      'Already on Goodreads? Import your whole library in one go, or start with a sample library.',
      'Each book is drawn to size: thicker means more pages, taller means a bigger book.',
    ],
    visual: <SizeExample />,
  },
  {
    icon: '⇅',
    title: 'Arrange and track',
    points: [
      'Sort shelves by genre, author, title, publish date or what you read recently.',
      'Filter by reading progress: Reading, Read, Unread, Want to read or Did not finish.',
      'Tap a book for its details, or press and hold to change its status. A book you’re reading holds a bookmark.',
    ],
    visual: <ReadingExample />,
  },
  {
    icon: '📖',
    title: 'Books you own, and books you don’t',
    points: [
      'A book on your shelf looks solid. One you don’t own, such as a book you want or one you’ve borrowed, is faded.',
      'Choose which when you add a book. You’ll be asked again when you start a book you wanted, and you can switch it any time from its page or by pressing and holding it.',
    ],
    visual: <OwnershipExample />,
  },
  {
    icon: '📲',
    title: 'Keep it on your home screen',
    points: [
      'Add Bookie to your home screen to open it like an app, full screen.',
      'Do this before adding books: the home-screen app can have its own empty library, separate from the browser. Settings → Export backup and Restore moves books across.',
    ],
    visual: <HomeScreenGuide />,
    webOnly: true,
  },
  {
    icon: '🔒',
    title: 'Your library stays with you',
    points: [
      'Everything is stored on this device only, with no account and no cloud.',
      'Use Settings → Export backup now and then to keep a copy somewhere safe.',
    ],
  },
];

/** Already launched from the home screen, so there's nothing left to explain. */
const installed = () =>
  Platform.OS === 'web' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

/** First-launch walkthrough. Also reachable from Settings. */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const STEPS = useMemo(() => ALL_STEPS.filter((s) => !s.webOnly || (Platform.OS === 'web' && !installed())), []);
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const pager = useRef<ScrollViewInstance>(null);
  const last = index === STEPS.length - 1;

  // The steps sit side by side in a paging scroller, so they follow your finger and snap into place. The buttons
  // scroll it too. Swiping never finishes the tour: that stays a deliberate tap on the last step.
  const goTo = (i: number) => pager.current?.scrollTo({ x: i * width, animated: true });
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.min(STEPS.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width))));
  };

  const finish = async () => {
    await markOnboardingSeen();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.topBar}>
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
            {STEPS.map((step, i) => (
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

                  {i === STEPS.length - 1 && (
                    <View style={styles.devNote}>
                      <Text style={styles.devTitle}>🚧 Still in development</Text>
                      <Text style={styles.devBody}>
                        Bookie is an early prototype. Things may change, and you may run into bugs or rough edges along the way. Thanks for
                        trying it out, and do share anything that breaks or feels off.
                      </Text>
                    </View>
                  )}
                  {i === STEPS.length - 1 && <SupportNote />}
                </View>
              </ScrollView>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Fixed height, so the page doesn't shift when the hint goes away after the first step. */}
      <View style={styles.hintRow}>
        {index === 0 && <Text style={styles.hint}>Swipe left or right to move through, or use the buttons</Text>}
      </View>

      <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      <View style={styles.buttons}>
        {index > 0 && (
          <Pressable style={styles.back} onPress={() => goTo(index - 1)} accessibilityRole="button">
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        )}
        <Pressable style={styles.next} onPress={last ? finish : () => goTo(index + 1)} accessibilityRole="button">
          <Text style={styles.nextText}>{last ? 'Got it, let’s go' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 24 },
  topBar: { height: 24, alignItems: 'flex-end' },
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
