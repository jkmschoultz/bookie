import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { COVER_ASPECT, Cover } from '@/components/Cover';
import { CoverZoom } from '@/components/CoverZoom';
import { Colors, Fonts } from '@/constants/theme';
import { useBookFlight, type Rect } from '@/library/bookFlight';
import type { Book } from '@/types';

/* The parts a book's page is made of, for yours (book/[id]) and a friend's (friends/[id]/book/[book]) alike. */

const COVER_WIDTH = 170;

/**
 * The cover at the top of a book's page. A book opened from its shelf flies here (see BookFlight), and back again when
 * the page closes; tapping the cover shows it big. `scrollY` is how far the page has scrolled, for the flight back.
 */
export function BookPageCover({ book, scrollY }: { book: Book; scrollY: RefObject<number> }) {
  // Keep this cover hidden until the flying book lands on it.
  const landing = useBookFlight((f) => f.flight?.book.id === book.id);
  const [flewIn] = useState(landing);
  const land = useBookFlight((f) => f.land);
  const coverRef = useRef<ComponentRef<typeof View>>(null);
  // Where the cover was last seen on screen, and the scroll position then, for the flight back to the shelf.
  const coverSeen = useRef<{ rect: Rect; scrollY: number } | null>(null);
  const reportCover = () =>
    coverRef.current?.measureInWindow((x, y, width) => {
      const rect = { x: x + (width - COVER_WIDTH) / 2, y, width: COVER_WIDTH, height: COVER_WIDTH * COVER_ASPECT };
      coverSeen.current = { rect, scrollY: scrollY.current };
      land(book.id, rect);
    });
  const reduceMotion = useReducedMotion();
  const latest = useRef(book);
  useEffect(() => {
    latest.current = book;
  }, [book]);
  // Leaving the page sends the book back to its shelf, the way it came. A layout effect, so the flight is already
  // underway when the shelf screen shows (and its own screen transition sees it and stays put).
  useLayoutEffect(() => {
    const openedAt = Date.now();
    return () => {
      const { flight, finish, returnToShelf } = useBookFlight.getState();
      // Leaving before it landed (a quick Back) calls the trip here off first.
      if (flight?.book.id === latest.current.id) finish();
      const seen = coverSeen.current;
      // (Development runs effects twice on mount; that isn't leaving.)
      if (Platform.OS !== 'web' || reduceMotion || !seen || Date.now() - openedAt < 300) return;
      // Where the page has scrolled to by now, on leaving, is the position wanted here.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const rect = { ...seen.rect, y: seen.rect.y - (scrollY.current - seen.scrollY) };
      if (rect.y + rect.height > 0) returnToShelf(latest.current, rect);
    };
  }, [reduceMotion, scrollY]);

  // Tapping the cover shows it big (CoverZoom), growing from where it is on the page.
  const [zoomFrom, setZoomFrom] = useState<Rect | null>(null);
  const zoomCover = () =>
    coverRef.current?.measureInWindow((x, y, width) =>
      setZoomFrom({ x: x + (width - COVER_WIDTH) / 2, y, width: COVER_WIDTH, height: COVER_WIDTH * COVER_ASPECT }),
    );

  return (
    <>
      <Animated.View
        ref={coverRef}
        onLayout={reportCover}
        entering={flewIn ? undefined : ZoomIn.springify().damping(16)}
        style={[styles.coverWrap, landing && { opacity: 0 }]}>
        <Pressable
          onPress={zoomCover}
          accessibilityRole="button"
          accessibilityLabel="Show the cover bigger"
          // While it's shown big, its place on the page is empty.
          style={zoomFrom && { opacity: 0 }}>
          <Cover book={book} width={COVER_WIDTH} />
        </Pressable>
      </Animated.View>
      {zoomFrom && <CoverZoom book={book} from={zoomFrom} onClose={() => setZoomFrom(null)} />}
    </>
  );
}

/** The book's title, who wrote it, its series, pages, year, publisher and genres; only what's known. */
export function BookTitle({ book }: { book: Book }) {
  const meta = [book.pageCount && `${book.pageCount} pages`, book.publishedYear && String(book.publishedYear), book.publisher].filter(Boolean);
  return (
    <Animated.View entering={FadeInDown.delay(80)} style={styles.center}>
      <Text style={styles.title}>{book.title}</Text>
      {book.subtitle && <Text style={styles.subtitle}>{book.subtitle}</Text>}
      <Text style={styles.authors}>{book.authors.join(', ') || 'Unknown author'}</Text>
      {book.series && (
        <Text style={styles.muted}>
          {book.series}
          {book.seriesIndex != null && ` · Book ${book.seriesIndex}`}
        </Text>
      )}
      {meta.length > 0 && <Text style={styles.muted}>{meta.join(' · ')}</Text>}
      {book.genres.length > 0 && (
        <View style={styles.genres}>
          {book.genres.map((g) => (
            <Text key={g} style={styles.genre}>
              {g}
            </Text>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

/** A titled part of the page. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  coverWrap: { alignItems: 'center', marginTop: 8 },
  center: { alignItems: 'center', gap: 4 },
  title: { color: Colors.text, fontSize: 24, fontWeight: '700', fontFamily: Fonts.serif, textAlign: 'center' },
  subtitle: { color: Colors.textMuted, fontSize: 16, textAlign: 'center' },
  authors: { color: Colors.accent, fontSize: 17, marginTop: 2, textAlign: 'center' },
  muted: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 8 },
  genre: {
    color: Colors.textMuted,
    fontSize: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  section: { gap: 10 },
  sectionTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
});
