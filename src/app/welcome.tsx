import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { markOnboardingSeen } from '@/library/onboarding';

interface Step {
  icon: string;
  title: string;
  points: string[];
}

const STEPS: Step[] = [
  {
    icon: '📚',
    title: 'Welcome to Bookie',
    points: [
      'Your books, on a virtual bookshelf.',
      'Swipe left and right along a shelf, and up and down the bookcase.',
      'Spines are sized by page count and the book’s real height.',
    ],
  },
  {
    icon: '＋',
    title: 'Fill your shelves',
    points: [
      'Tap ＋ to search for a book, scan the barcode on its back cover, or type in the details.',
      'Already on Goodreads? Import your whole library in one go.',
      'No books yet? You can start with a sample library.',
    ],
  },
  {
    icon: '⇅',
    title: 'Arrange and track',
    points: [
      'Sort shelves by genre, author, title, publish date or what you read recently.',
      'Filter by Reading, Read, Unread, Want to read or Did not finish.',
      'Tap a book for its details, rating and notes. Press and hold one to change its status quickly.',
    ],
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

/** First-launch walkthrough. Also reachable from Settings. */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

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

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View key={index} entering={FadeIn.duration(220)} style={styles.step}>
          <Text style={styles.icon}>{step.icon}</Text>
          <Text style={styles.title}>{step.title}</Text>
          {step.points.map((p) => (
            <View key={p} style={styles.point}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.pointText}>{p}</Text>
            </View>
          ))}

          {last && (
            <View style={styles.devNote}>
              <Text style={styles.devTitle}>🚧 Still in development</Text>
              <Text style={styles.devBody}>
                Bookie is an early prototype. Things may change, and you may run into bugs or rough edges along the way. Thanks for
                trying it out, and do share anything that breaks or feels off.
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      <View style={styles.buttons}>
        {index > 0 && (
          <Pressable style={styles.back} onPress={() => setIndex(index - 1)} accessibilityRole="button">
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        )}
        <Pressable style={styles.next} onPress={last ? finish : () => setIndex(index + 1)} accessibilityRole="button">
          <Text style={styles.nextText}>{last ? 'Got it, let’s go' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 24 },
  topBar: { height: 24, alignItems: 'flex-end' },
  skip: { color: Colors.textMuted, fontSize: 15, fontWeight: '600' },
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  step: { gap: 14, maxWidth: 480, width: '100%', alignSelf: 'center' },
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
