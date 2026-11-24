import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cachedFriendShelf, friendBook, friendName, getFriendShelf, type FriendShelf } from '@/account/friends';
import { alert } from '@/components/alert';
import { BookPageCover, BookTitle, Section } from '@/components/BookPage';
import { Chip } from '@/components/Chip';
import { StarRating } from '@/components/StarRating';
import { Colors, Fonts } from '@/constants/theme';
import { findCopy } from '@/library/duplicates';
import { fromFriend } from '@/library/fromFriend';
import { useLibrary } from '@/library/LibraryProvider';
import { STATUS_LABELS, type Book } from '@/types';

/** One of a friend's books, opened from their shelf: kept for the visit, or fetched when the page is opened afresh. */
export default function FriendBookScreen() {
  const { id, book: bookId, name } = useLocalSearchParams<{ id: string; book: string; name?: string }>();
  const [shelf, setShelf] = useState<FriendShelf | null>(() => cachedFriendShelf(id) ?? null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (shelf) return;
    getFriendShelf(id)
      .then(setShelf)
      .catch((e) => setProblem(e instanceof Error ? e.message : 'Couldn’t load this book.'));
  }, [id, shelf]);

  const who = shelf ? friendName(shelf.friend) : (name ?? 'your friend');
  const book = shelf && friendBook(shelf, bookId);
  if (!shelf) return <View style={styles.missing}>{problem ? <Text style={styles.muted}>{problem}</Text> : <ActivityIndicator color={Colors.accent} />}</View>;
  if (!book)
    return (
      <View style={styles.missing}>
        <Text style={styles.muted}>This book is no longer on {who}’s shelf.</Text>
      </View>
    );
  return <FriendBookDetails book={book} who={who} />;
}

/**
 * A friend's book, laid out like your own book's page but read-only: where it stands on their shelf, their rating and
 * reading dates if they gave them (never their notes). Below, adding it to your own shelf, or seeing it's there already.
 */
function FriendBookDetails({ book, who }: { book: Book; who: string }) {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(0);
  const { books, addBook } = useLibrary();
  const mine = findCopy(books, book);
  const [adding, setAdding] = useState(false);
  /** Added from this page, rather than on your shelf already. */
  const [added, setAdded] = useState(false);

  const add = async (status: 'owned' | 'want') => {
    setAdding(true);
    try {
      await addBook(fromFriend(book, status));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAdded(true);
    } catch (e) {
      alert('Couldn’t add it', e instanceof Error ? e.message : undefined);
    } finally {
      setAdding(false);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      alwaysBounceVertical
      onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={32}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <BookPageCover book={book} scrollY={scrollY} />
      <BookTitle book={book} />

      <Section title={`${who}’s shelf`}>
        <View style={styles.wrap}>
          <Chip label={STATUS_LABELS[book.status]} selected />
          <Chip label={book.owned ? 'On their shelf' : 'Not owned'} selected={book.owned} />
        </View>
      </Section>

      {book.rating != null && (
        <Section title={`${who}’s rating`}>
          <StarRating value={book.rating} />
        </Section>
      )}

      {(book.dateStarted || book.dateFinished) && (
        <Section title="Dates">
          <View style={styles.dates}>
            {book.dateStarted && <ReadingDate label="Started" date={book.dateStarted} />}
            {book.dateFinished && <ReadingDate label="Finished" date={book.dateFinished} />}
          </View>
        </Section>
      )}

      <Section title="Your shelf">
        {mine ? (
          <Animated.View entering={added ? FadeIn.duration(250) : undefined} style={styles.yours}>
            <View style={{ flex: 1 }}>
              <Text style={styles.yoursTitle}>{added ? 'Added to your shelf' : 'On your shelf already'}</Text>
              <Text style={styles.yoursLine}>
                {STATUS_LABELS[mine.status]}
                {mine.owned || mine.status === 'want' ? '' : ' · not owned'}
              </Text>
            </View>
            <Action title="Open my copy" primary onPress={() => router.push({ pathname: '/book/[id]', params: { id: String(mine.id) } })} />
          </Animated.View>
        ) : (
          <View style={styles.actions}>
            <Action title="Add to my shelf" primary grow disabled={adding} onPress={() => add('owned')} />
            <Action title="Want to read" grow disabled={adding} onPress={() => add('want')} />
          </View>
        )}
      </Section>

      {book.isbn13 && <Text style={styles.hint}>ISBN {book.isbn13}</Text>}
    </ScrollView>
  );
}

function ReadingDate({ label, date }: { label: string; date: string }) {
  return (
    <View style={styles.date}>
      <Text style={styles.hint}>{label}</Text>
      <Text style={styles.dateText}>{date}</Text>
    </View>
  );
}

function Action({ title, onPress, primary, grow, disabled }: { title: string; onPress: () => void; primary?: boolean; grow?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      style={[styles.action, primary && styles.actionPrimary, grow && { flex: 1 }, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button">
      <Text style={[styles.actionText, primary && { color: Colors.accentText }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 22 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dates: { flexDirection: 'row', gap: 12 },
  date: { flex: 1, gap: 4 },
  dateText: { color: Colors.text, fontSize: 16 },
  hint: { color: Colors.textMuted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  actionPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  actionText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  yours: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  yoursTitle: { color: Colors.text, fontSize: 16, fontFamily: Fonts.serif, fontWeight: '700' },
  yoursLine: { color: Colors.textMuted, fontSize: 14, marginTop: 2 },
});
