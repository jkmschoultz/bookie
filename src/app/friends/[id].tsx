import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccount } from '@/account/AccountProvider';
import {
  cachedFriendShelf,
  friendBookId,
  friendName,
  getFriendNews,
  getFriendShelf,
  markFriendNewsSeen,
  newsLine,
  removeFriend,
  type FriendNews,
  type FriendShelf,
} from '@/account/friends';
import { markViewed } from '@/account/friendSort';
import { alert } from '@/components/alert';
import { Bookcase } from '@/components/shelf/Bookcase';
import { Colors, Fonts } from '@/constants/theme';
import { PULL_OUT_MS, useBookFlight, type SpineRect } from '@/library/bookFlight';
import { useUi } from '@/store/uiStore';
import { STATUS_LABELS, type Book } from '@/types';

/** Lines of news shown at most; the rest is "and 3 more". */
const NEWS_LINES = 5;

/** A quick look at a friend's book (a long press): who wrote it, and where it stands on their shelf. */
function showBook(book: Book) {
  const by = book.authors.length ? `by ${book.authors.join(', ')}` : '';
  const where = [STATUS_LABELS[book.status], book.owned ? null : 'not on their shelf'].filter(Boolean).join(' · ');
  alert(book.title, [by, where].filter(Boolean).join('\n'));
}

/** Opened from the Friends hallway, which has turned to face this friend's bookcase: the shelf fades in over it. */
const FROM_HALLWAY = FadeIn.duration(450).reduceMotion(ReduceMotion.Never);
const BACK_TO_HALLWAY = FadeOut.duration(450).reduceMotion(ReduceMotion.Never);

/**
 * A friend's shelf, read-only: their books on a bookcase like yours, by genre; tapping one opens its page. What's changed
 * on it since you last looked pops up over it, once.
 */
export default function FriendShelfScreen() {
  const { id, name, from } = useLocalSearchParams<{ id: string; name?: string; from?: string }>();
  const insets = useSafeAreaInsets();
  const layoutMode = useUi((s) => s.layoutMode);
  const { setFriendBadge } = useAccount();
  const [shelf, setShelf] = useState<FriendShelf | null>(() => cachedFriendShelf(id) ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const [news, setNews] = useState<FriendNews[] | null>(null);

  useEffect(() => {
    // For sorting the hallway by "Recently viewed"; kept on this device only.
    markViewed(id);
    getFriendShelf(id, true)
      .then(setShelf)
      .catch((e) => setProblem(e instanceof Error ? e.message : 'Couldn’t load this shelf.'));
    // News since you last looked: shown once, then it's seen.
    getFriendNews(id)
      .then(({ news: all, seenUpTo }) => {
        const fresh = all.filter((n) => n.new);
        if (!fresh.length) return;
        setNews(fresh);
        // Seen: one friend fewer with news on the Friends button.
        markFriendNewsSeen(id, seenUpTo).catch(() => {});
        setFriendBadge((b) => ({ ...b, updated: Math.max(0, b.updated - 1) }));
      })
      .catch(() => {});
  }, [id, setFriendBadge]);

  const title = shelf ? friendName(shelf.friend) : (name ?? '');

  // Tapping a book opens its page, as on your own shelf: on the web it flies there from the shelf (see BookFlight).
  const reduceMotion = useReducedMotion();
  const startFlight = useBookFlight((f) => f.start);
  const openBook = (book: Book, from?: SpineRect) => {
    if (!shelf) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const open = () => router.push({ pathname: '/friends/[id]/book/[book]', params: { id, book: friendBookId(shelf, book), name: title } });
    if (from && Platform.OS === 'web' && !reduceMotion) {
      startFlight(book, from);
      setTimeout(open, PULL_OUT_MS);
    } else open();
  };

  const remove = () =>
    alert(`Remove ${title}?`, 'You stop seeing each other’s shelves. They aren’t told, and either of you can ask again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFriend(id);
            router.back();
          } catch (e) {
            alert('Couldn’t remove them', e instanceof Error ? e.message : undefined);
          }
        },
      },
    ]);

  return (
    <Animated.View
      style={styles.screen}
      entering={from === 'hallway' ? FROM_HALLWAY : undefined}
      exiting={from === 'hallway' ? BACK_TO_HALLWAY : undefined}>
      <Stack.Screen
        options={{
          title: title ? `${title}’s shelf` : 'Shelf',
          headerRight: () => (
            <Pressable onPress={remove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${title} as a friend`}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          ),
        }}
      />
      {problem && !shelf ? (
        <Text style={styles.message}>{problem}</Text>
      ) : !shelf ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 60 }} />
      ) : !shelf.friend.shelfVisible ? (
        <Text style={styles.message}>{title} keeps their shelf private for now.</Text>
      ) : !shelf.books.length ? (
        <Text style={styles.message}>{title}’s shelf is empty so far.</Text>
      ) : (
        <>
          <Text style={styles.count}>
            {shelf.books.length} {shelf.books.length === 1 ? 'book' : 'books'} · {shelf.books.filter((b) => b.status === 'read').length} read
          </Text>
          <Bookcase books={shelf.books} sortMode="genre" layoutMode={layoutMode} onOpen={openBook} onLongPress={showBook} bottomInset={insets.bottom} />
        </>
      )}
      {news && <NewsPopup news={news} onClose={() => setNews(null)} />}
    </Animated.View>
  );
}

/** What's changed on their shelf since you last looked, newest first, over the top of the shelf. Tap to close. */
function NewsPopup({ news, onClose }: { news: FriendNews[]; onClose: () => void }) {
  const more = news.length - NEWS_LINES;
  return (
    <Pressable style={styles.popupLayer} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close what’s new">
      <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOut.duration(150)} style={styles.popup} accessibilityLiveRegion="polite">
        <Text style={styles.popupTitle}>New since you last looked</Text>
        {news.slice(0, NEWS_LINES).map((n, i) => (
          <View key={i} style={styles.newsRow}>
            <View style={[styles.newsMark, n.kind === 'started' && styles.markStarted, n.kind === 'finished' && styles.markFinished]} />
            <Text style={styles.newsText} numberOfLines={2}>
              {newsLine(n)}
            </Text>
          </View>
        ))}
        {more > 0 && <Text style={styles.more}>and {more} more</Text>}
        <Text style={styles.ok}>OK</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  count: { color: Colors.textMuted, fontSize: 13, paddingHorizontal: 16, paddingVertical: 8 },
  message: { color: Colors.textMuted, fontSize: 15, textAlign: 'center', marginTop: 60, paddingHorizontal: 32, lineHeight: 21 },
  remove: { color: Colors.textMuted, fontSize: 15, paddingHorizontal: 4 },
  popupLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', paddingTop: 44, paddingHorizontal: 20, backgroundColor: 'rgba(10,6,3,0.35)' },
  popup: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 16,
    padding: 16,
    gap: 9,
    borderWidth: 1,
    borderColor: 'rgba(232,200,117,0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  popupTitle: { color: Colors.text, fontFamily: Fonts.serif, fontSize: 18, fontWeight: '700', marginBottom: 2 },
  newsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  newsMark: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.textMuted },
  markStarted: { backgroundColor: Colors.ribbon },
  markFinished: { backgroundColor: Colors.accent },
  newsText: { flex: 1, color: Colors.text, fontSize: 15, lineHeight: 20 },
  more: { color: Colors.textMuted, fontSize: 14, marginLeft: 18 },
  ok: { alignSelf: 'flex-end', color: Colors.accent, fontSize: 16, fontWeight: '700', paddingTop: 2 },
});
