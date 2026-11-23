import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccount } from '@/account/AccountProvider';
import {
  acceptFriend,
  askFriend,
  declineFriend,
  friendBadgeOf,
  friendColour,
  friendName,
  getFriends,
  getFriendShelf,
  removeFriend,
  type Friend,
  type FriendLists,
  type FriendRequest,
} from '@/account/friends';
import { DEFAULT_FRIEND_SORT, FRIEND_SORTS, loadFriendSort, loadViewed, saveFriendSort, sortFriends, type FriendSort } from '@/account/friendSort';
import { PrimaryButton } from '@/components/account/Form';
import { alert } from '@/components/alert';
import { FriendsLibraryHallway, type HallwayFriend } from '@/components/FriendsLibraryHallway';
import { Sheet } from '@/components/Sheet';
import { Colors, Fonts } from '@/constants/theme';
import { usernameProblem } from '@shared/account';
import type { Book } from '@/types';

/** A friend's shelf, opened from the hallway: it fades in over the bookcase the hallway has turned to (see [id]). */
const openShelf = (f: Friend) => router.push({ pathname: '/friends/[id]', params: { id: f.userId, name: friendName(f), from: 'hallway' } });

const NOT_VIEWED: Record<string, number> = {};

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** One bookcase in the hallway: a friend, or a request (a "potential" bookcase). */
type Entry = { kind: 'friend'; friend: Friend } | { kind: 'incoming' | 'outgoing'; request: FriendRequest };

const entryName = (e: Entry) => friendName(e.kind === 'friend' ? e.friend : e.request);
const entryUser = (e: Entry) => (e.kind === 'friend' ? e.friend : e.request);

/**
 * Friends: the whole screen is a hallway, with a bookcase for each friend. Requests are "potential" bookcases (incoming
 * near the entrance, sent ones at the far end). A search button at the top walks to a friend, or sends a request to a
 * username. Needs an account.
 */
export default function FriendsScreen() {
  const { status, account, setFriendBadge } = useAccount();
  const insets = useSafeAreaInsets();
  const [lists, setLists] = useState<FriendLists | null>(null);
  const [shelves, setShelves] = useState<Record<string, Book[]>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [front, setFront] = useState(0);
  const [walkTo, setWalkTo] = useState<{ index: number; key: number } | undefined>();
  /** The caption opens the bookcase in front through the hallway, so it turns to it like a tap does. */
  const [openRequest, setOpenRequest] = useState<{ index: number; key: number } | undefined>();
  const [answering, setAnswering] = useState<Entry | null>(null);
  /** The buttons and caption step aside while the hallway walks up to a bookcase and turns to it, and come back after. */
  const chrome = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  /** While it moves, the faded buttons and caption take no taps either. */
  const [moving, setMoving] = useState(false);
  const onMoving = useCallback(
    (now: boolean) => {
      setMoving(now);
      chrome.set(reducedMotion ? (now ? 0 : 1) : withTiming(now ? 0 : 1, { duration: now ? 160 : 220 }));
    },
    [chrome, reducedMotion],
  );
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));
  /** After a reload, walk to this person's bookcase (a request just sent or accepted): their user id or username. */
  const walkToUser = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await getFriends();
      setFriendBadge(friendBadgeOf(next));
      // Each friend's books, for their bookcase in the hallway; the hallway is drawn once, with them.
      const loaded = await Promise.all(next.friends.map(async (f) => [f.userId, (await getFriendShelf(f.userId, true).catch(() => null))?.books ?? []] as const));
      setLists(next);
      setShelves(Object.fromEntries(loaded));
      setProblem(null);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Couldn’t load your friends.');
    }
  }, [setFriendBadge]);

  // The order of friends' bookcases, as last chosen on this device.
  const [sort, setSort] = useState<FriendSort>(DEFAULT_FRIEND_SORT);
  const [viewed, setViewed] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      if (status === 'signedIn') load();
    }, [status, load]),
  );

  // When shelves were last opened is read on opening the screen and on choosing a sort, not on coming back from a
  // shelf: "Recently viewed" would otherwise reorder the hallway behind you, and you'd turn back to someone else.
  useEffect(() => {
    loadFriendSort().then(setSort);
    loadViewed().then(setViewed);
  }, []);
  const chooseSort = (next: FriendSort) => {
    setSort(next);
    saveFriendSort(next);
    loadViewed().then(setViewed);
    // Back to the entrance, where the new order starts.
    setWalkTo({ index: 0, key: Date.now() });
  };

  // When shelves were last opened only matters to "Recently viewed"; otherwise it changing doesn't redraw the hallway.
  const viewedForSort = sort === 'viewed' ? viewed : NOT_VIEWED;
  const entries = useMemo<Entry[]>(
    () =>
      lists
        ? [
            ...lists.incoming.map((request) => ({ kind: 'incoming' as const, request })),
            // Requests keep their places, whatever the order: incoming at the entrance, sent ones at the far end.
            ...sortFriends(lists.friends, sort, { viewed: viewedForSort, sizes: Object.fromEntries(Object.entries(shelves).map(([id, books]) => [id, books.length])) }).map((friend) => ({
              kind: 'friend' as const,
              friend,
            })),
            ...lists.outgoing.map((request) => ({ kind: 'outgoing' as const, request })),
          ]
        : [],
    [lists, sort, viewedForSort, shelves],
  );

  // Each bookcase's friend, made once per load, so changing the order only moves bookcases and doesn't redraw their books.
  const bookcases = useMemo(() => {
    const made = new Map<string, HallwayFriend>();
    if (!lists) return made;
    const add = (e: Entry) => {
      const person = entryUser(e);
      made.set(`${e.kind}:${person.userId}`, {
        key: person.userId,
        name: entryName(e),
        initial: entryName(e).slice(0, 1).toUpperCase(),
        color: friendColour(person.username),
        books: e.kind === 'friend' ? (shelves[e.friend.userId] ?? []) : [],
        request: e.kind === 'friend' ? undefined : e.kind,
        news: e.kind === 'friend' && (e.friend.unseen ?? 0) > 0,
      });
    };
    lists.incoming.forEach((request) => add({ kind: 'incoming', request }));
    lists.friends.forEach((friend) => add({ kind: 'friend', friend }));
    lists.outgoing.forEach((request) => add({ kind: 'outgoing', request }));
    return made;
  }, [lists, shelves]);
  const hallway = useMemo<HallwayFriend[]>(() => entries.map((e) => bookcases.get(`${e.kind}:${entryUser(e).userId}`)!), [entries, bookcases]);

  // Walk to someone once they're in the hallway.
  useEffect(() => {
    if (!walkToUser.current) return;
    const who = walkToUser.current.toLowerCase();
    const index = entries.findIndex((e) => entryUser(e).userId.toLowerCase() === who || entryUser(e).username.toLowerCase() === who);
    if (index < 0) return;
    walkToUser.current = null;
    setWalkTo({ index, key: Date.now() });
  }, [entries]);

  const walk = useCallback((index: number) => setWalkTo({ index, key: Date.now() }), []);

  const open = (index: number) => {
    const e = entries[index];
    if (!e) return;
    if (e.kind === 'friend') openShelf(e.friend);
    else setAnswering(e);
  };

  if (status !== 'signedIn' || !account) return <SignedOut status={status} />;

  const inFront = entries[Math.min(front, entries.length - 1)];

  return (
    <View style={styles.screen}>
      <FriendsLibraryHallway fill friends={lists ? hallway : []} onWalk={setFront} onOpen={open} walkTo={walkTo} openRequest={openRequest} onMoving={onMoving} />

      {!lists && !problem && <ActivityIndicator color={Colors.accent} style={StyleSheet.absoluteFill} />}
      {problem && (
        <View style={[styles.centre, { top: insets.top + 80 }]} pointerEvents="box-none">
          <Text style={styles.noteText}>{problem}</Text>
        </View>
      )}
      {lists && !entries.length && (
        <View style={styles.centre} pointerEvents="none">
          <View style={styles.note}>
            <Text style={styles.noteTitle}>No friends here yet</Text>
            <Text style={styles.noteText}>Tap the search button above and type a friend’s username. Their bookcase appears here once they accept.</Text>
          </View>
        </View>
      )}

      <Animated.View style={[StyleSheet.absoluteFill, styles.chrome, chromeStyle]} pointerEvents={moving ? 'none' : 'box-none'}>
        {inFront && <FrontCaption entry={inFront} bottom={insets.bottom + 18} onPress={() => setOpenRequest({ index: Math.min(front, entries.length - 1), key: Date.now() })} />}

        <TopBar
          inactive={moving}
          top={insets.top + 8}
          entries={entries}
          username={account.username}
          shelfHidden={!account.shelfVisible}
          onWalk={walk}
          sort={sort}
          onSort={chooseSort}
          onSent={(username) => {
            walkToUser.current = username;
            load();
          }}
        />
      </Animated.View>

      <RequestSheet
        entry={answering}
        onClose={() => setAnswering(null)}
        onDone={(walkToUserId) => {
          setAnswering(null);
          walkToUser.current = walkToUserId;
          load();
        }}
      />
    </View>
  );
}

/** The close button and the search button, floating over the top of the hallway. The search button opens into a field. */
function TopBar({
  inactive,
  top,
  entries,
  username,
  shelfHidden,
  onWalk,
  sort,
  onSort,
  onSent,
}: {
  /** Taps nothing (while the hallway walks up to a bookcase and turns to it). */
  inactive?: boolean;
  top: number;
  entries: Entry[];
  username: string;
  shelfHidden: boolean;
  onWalk: (index: number) => void;
  sort: FriendSort;
  onSort: (sort: FriendSort) => void;
  /** A request was sent (or made you friends): walk to their bookcase. */
  onSent: (username: string) => void;
}) {
  const reducedMotion = useReducedMotion();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [rowWidth, setRowWidth] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [sorting, setSorting] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const opened = useSharedValue(0);

  useEffect(() => {
    opened.set(reducedMotion ? (searching ? 1 : 0) : withTiming(searching ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) }));
    if (searching) setTimeout(() => input.current?.focus(), reducedMotion ? 0 : 120);
  }, [searching, reducedMotion, opened]);

  // The field grows from the round button to the width of the bar, beside the close button.
  const full = Math.max(BUTTON, rowWidth - BUTTON - 10);
  const field = useAnimatedStyle(() => ({ width: BUTTON + (full - BUTTON) * opened.value }));
  const fieldContent = useAnimatedStyle(() => ({ opacity: opened.value }));

  const q = query.trim().replace(/^@/, '');
  const matches = useMemo(() => {
    if (!q) return [];
    const needle = q.toLowerCase();
    return entries
      .map((e, index) => ({ e, index }))
      .filter(({ e }) => entryName(e).toLowerCase().includes(needle) || entryUser(e).username.toLowerCase().includes(needle))
      .sort((a, b) => Number(!entryUser(b.e).username.toLowerCase().startsWith(needle)) - Number(!entryUser(a.e).username.toLowerCase().startsWith(needle)));
  }, [q, entries]);

  // Typing walks to the first friend that matches.
  const first = matches[0]?.index;
  useEffect(() => {
    if (first != null) onWalk(first);
  }, [first, onWalk]);

  const collapse = () => {
    setSearching(false);
    setQuery('');
    setMessage(null);
    input.current?.blur();
  };

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await askFriend(q);
      setMessage({ text: result === 'friends' ? `You and @${q} are friends now.` : `Request sent to @${q}.`, error: false });
      setQuery('');
      onSent(q);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Couldn’t send the request.', error: true });
    } finally {
      setBusy(false);
    }
  };

  const canAsk = !!q && !matches.length && !usernameProblem(q) && q.toLowerCase() !== username.toLowerCase();

  return (
    <View style={[styles.topBar, { top }]} pointerEvents={inactive ? 'none' : 'box-none'}>
      <View style={styles.topRow} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)} pointerEvents={inactive ? 'none' : 'box-none'}>
        <Pressable style={styles.roundButton} onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={6}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        {/* Sorting sits beside search; the search field opens over it. */}
        {!searching && (
          <Pressable
            style={[styles.roundButton, styles.sortButton, sorting && styles.sortOpen]}
            onPress={() => setSorting((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel={`Sort friends: ${FRIEND_SORTS.find((x) => x.sort === sort)?.label}`}
            accessibilityState={{ expanded: sorting }}
            hitSlop={6}>
            <SortGlyph />
          </Pressable>
        )}
        <Animated.View style={[styles.field, field]}>
          <Pressable
            style={styles.searchIcon}
            onPress={() => {
              setSorting(false);
              if (searching) input.current?.focus();
              else setSearching(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={searching ? 'Search friends' : 'Search friends, or add one'}
            hitSlop={6}>
            <SearchGlyph />
          </Pressable>
          {searching && (
            <Animated.View style={[styles.fieldInner, fieldContent]}>
              <TextInput
                ref={input}
                value={query}
                onChangeText={(t) => {
                  setQuery(t);
                  setMessage(null);
                }}
                placeholder="Find a friend or add a username"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType={canAsk ? 'send' : 'search'}
                onSubmitEditing={() => (canAsk ? send() : first != null && onWalk(first))}
                onKeyPress={(e) => e.nativeEvent.key === 'Escape' && collapse()}
                accessibilityLabel="Friend’s name or username"
              />
              <Pressable onPress={collapse} accessibilityRole="button" accessibilityLabel="Close search" hitSlop={8} style={styles.clear}>
                <Text style={styles.clearText}>✕</Text>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      </View>

      {sorting && !searching && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(100)} style={styles.sortMenu} accessibilityRole="menu">
          <Text style={styles.sortTitle}>Sort friends</Text>
          {FRIEND_SORTS.map(({ sort: option, label }) => (
            <Pressable
              key={option}
              style={styles.sortRow}
              onPress={() => {
                setSorting(false);
                onSort(option);
              }}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: option === sort }}>
              <Text style={[styles.sortLabel, option === sort && styles.sortChosen]}>{label}</Text>
              {option === sort && <Text style={styles.sortCheck}>✓</Text>}
            </Pressable>
          ))}
        </Animated.View>
      )}
      {searching && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.panel}>
          {!q && !message && (
            <Text style={styles.panelText}>
              Find a friend, or add one by their exact username. Yours is <Text style={styles.strong}>{username}</Text>.
              {shelfHidden ? ' Your shelf is hidden from friends; show it again in Settings → Account & sync.' : ''}
            </Text>
          )}
          {matches.length > 0 && (
            <View style={styles.matches}>
              {matches.slice(0, 4).map(({ e, index }) => (
                <Pressable key={entryUser(e).userId} style={[styles.match, index === first && styles.matchFirst]} onPress={() => onWalk(index)} accessibilityRole="button">
                  <Text style={styles.matchText} numberOfLines={1}>
                    {entryName(e)}
                    {e.kind === 'incoming' ? ' · asking' : e.kind === 'outgoing' ? ' · request sent' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {canAsk && <PrimaryButton title={`Send friend request to @${q}`} busy={busy} onPress={send} />}
          {!!q && !matches.length && !canAsk && (
            <Text style={styles.panelText}>{q.toLowerCase() === username.toLowerCase() ? 'That’s your own username.' : `No friend called “${q}”. ${usernameProblem(q) ?? ''}`}</Text>
          )}
          {message && <Text style={[styles.panelText, message.error && styles.error]}>{message.text}</Text>}
        </Animated.View>
      )}
    </View>
  );
}

const BUTTON = 44;

/** Three bars, longest first: sorting. */
function SortGlyph() {
  return (
    <View style={styles.sortGlyph} accessible={false}>
      {[18, 13, 8].map((w) => (
        <View key={w} style={[styles.sortBar, { width: w }]} />
      ))}
    </View>
  );
}

/** A magnifying glass: a ring and a handle. */
function SearchGlyph() {
  return (
    <View style={styles.glyph} accessible={false}>
      <View style={styles.glyphRing} />
      <View style={styles.glyphHandle} />
    </View>
  );
}

/** Who's in front, floating at the bottom of the hallway: their name, and what tapping does. */
function FrontCaption({ entry, bottom, onPress }: { entry: Entry; bottom: number; onPress: () => void }) {
  const name = entryName(entry);
  const line = entry.kind === 'friend' ? friendLine(entry.friend) : entry.kind === 'incoming' ? 'Wants to be friends · tap to answer' : 'Request sent';
  return (
    <Pressable style={[styles.caption, { bottom }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}. ${line}`}>
      <Text style={styles.captionName} numberOfLines={1}>
        {entry.kind === 'friend' ? `${name}’s shelf` : name}
      </Text>
      <Text style={styles.captionLine}>{line}</Text>
    </Pressable>
  );
}

function friendLine(f: Friend): string {
  if (!f.shelfVisible) return 'Keeps their shelf private';
  return f.unseen ? 'New on their shelf · tap to look' : 'Tap to look at their shelf';
}

/** Tapping a potential bookcase: answer a request, or see that yours is waiting (and take it back). */
function RequestSheet({ entry, onClose, onDone }: { entry: Entry | null; onClose: () => void; onDone: (walkToUserId: string | null) => void }) {
  // Kept while the sheet slides away.
  const [shown, setShown] = useState(entry);
  if (entry && entry !== shown) setShown(entry);
  const [busy, setBusy] = useState(false);
  const act = async (action: () => Promise<unknown>, walkTo: string | null) => {
    setBusy(true);
    try {
      await action();
      onDone(walkTo);
    } catch (e) {
      alert('Couldn’t do that', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };
  if (!shown || shown.kind === 'friend') return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const r = shown.request;
  const name = friendName(r);
  return (
    <Sheet visible={!!entry} onClose={onClose} accessibilityLabel={shown.kind === 'incoming' ? `${name} wants to be friends` : 'Request sent'}>
      <View style={styles.sheetHead}>
        <View style={[styles.avatar, { backgroundColor: friendColour(r.username) }]}>
          <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetTitle}>{shown.kind === 'incoming' ? `${name} wants to be friends` : 'Request sent'}</Text>
          <Text style={styles.sheetText}>
            {shown.kind === 'incoming' ? `@${r.username}. Friends see each other’s shelves, not notes, ratings or dates.` : `${name} (@${r.username}) hasn’t answered yet.`}
          </Text>
        </View>
      </View>
      {shown.kind === 'incoming' ? (
        <View style={styles.sheetButtons}>
          <SheetButton title="Decline" disabled={busy} onPress={() => act(() => declineFriend(r.requestId), null)} />
          <SheetButton title="Accept" primary disabled={busy} onPress={() => act(() => acceptFriend(r.requestId), r.userId)} />
        </View>
      ) : (
        <View style={styles.sheetButtons}>
          <SheetButton title="Cancel request" danger disabled={busy} onPress={() => act(() => removeFriend(r.userId), null)} />
          <SheetButton title="OK" primary onPress={onClose} />
        </View>
      )}
    </Sheet>
  );
}

function SheetButton({ title, onPress, primary, danger, disabled }: { title: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      style={[styles.sheetButton, primary && styles.sheetButtonPrimary, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button">
      <Text style={[styles.sheetButtonText, primary && { color: Colors.accentText }, danger && { color: Colors.danger }]}>{title}</Text>
    </Pressable>
  );
}

/** Without an account: the preview hallway, and what friends need. */
function SignedOut({ status }: { status: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <FriendsLibraryHallway fill />
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable style={styles.roundButton} onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={6}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
      <ScrollView style={[styles.signedOut, { bottom: insets.bottom + 16 }]} contentContainerStyle={styles.signedOutContent}>
        <Text style={styles.noteTitle}>Your friends’ library</Text>
        {status === 'unavailable' ? (
          <Text style={styles.noteText}>Friends need an account, and accounts aren’t available here yet. Your library stays on this device.</Text>
        ) : (
          <>
            <Text style={styles.noteText}>
              Add friends and walk past their bookcases, here in a hallway. Friends need an account, so Bookie can share your shelf with the people you
              choose. Without one, everything stays on this device.
            </Text>
            <PrimaryButton title="Create an account or sign in" disabled={status === 'checking'} onPress={() => router.push('/account')} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const GLASS = 'rgba(26,18,12,0.78)';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0d0905' },
  // Its own layer on the web, so fading it doesn't repaint the hallway's page.
  chrome: Platform.OS === 'web' ? ({ willChange: 'opacity' } as object) : {},
  topBar: { position: 'absolute', left: 12, right: 12, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundButton: { width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, backgroundColor: GLASS, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(232,200,117,0.25)' },
  closeText: { color: Colors.text, fontSize: 17, fontWeight: '600' },
  sortButton: { position: 'absolute', right: BUTTON + 10 },
  sortOpen: { borderColor: Colors.accent },
  sortGlyph: { width: 18, gap: 3.5, alignItems: 'flex-start' },
  sortBar: { height: 2.4, borderRadius: 1.2, backgroundColor: Colors.text },
  sortMenu: { alignSelf: 'flex-end', marginRight: BUTTON + 10, width: 220, backgroundColor: 'rgba(26,18,12,0.95)', borderRadius: 14, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  sortTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 14, paddingVertical: 6 },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  sortLabel: { color: Colors.text, fontSize: 15 },
  sortChosen: { color: Colors.accent, fontWeight: '700' },
  sortCheck: { color: Colors.accent, fontSize: 15, fontWeight: '700' },
  field: { height: BUTTON, borderRadius: BUTTON / 2, backgroundColor: GLASS, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(232,200,117,0.25)' },
  searchIcon: { width: BUTTON - 2, height: BUTTON - 2, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  fieldInner: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minWidth: 0, color: Colors.text, fontSize: 16, paddingVertical: 8, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  clear: { paddingHorizontal: 14, paddingVertical: 8 },
  clearText: { color: Colors.textMuted, fontSize: 15 },
  glyph: { width: 20, height: 20 },
  glyphRing: { position: 'absolute', left: 1, top: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2.2, borderColor: Colors.text },
  glyphHandle: { position: 'absolute', left: 12.5, top: 13.5, width: 7, height: 2.4, borderRadius: 1.2, backgroundColor: Colors.text, transform: [{ rotate: '45deg' }] },
  panel: { alignSelf: 'flex-end', width: '100%', maxWidth: 420, backgroundColor: 'rgba(26,18,12,0.92)', borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: Colors.border },
  panelText: { color: Colors.textMuted, fontSize: 14, lineHeight: 20 },
  strong: { color: Colors.text, fontWeight: '700' },
  error: { color: Colors.danger },
  matches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  match: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, maxWidth: '100%' },
  matchFirst: { borderColor: Colors.accent, backgroundColor: 'rgba(217,164,65,0.15)' },
  matchText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  centre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 28 },
  note: { backgroundColor: GLASS, borderRadius: 16, padding: 18, gap: 8, maxWidth: 360, borderWidth: 1, borderColor: 'rgba(232,200,117,0.2)' },
  noteTitle: { color: Colors.text, fontSize: 20, fontFamily: Fonts.serif, fontWeight: '700' },
  noteText: { color: Colors.textMuted, fontSize: 15, lineHeight: 21 },
  caption: { position: 'absolute', alignSelf: 'center', maxWidth: '86%', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, backgroundColor: GLASS, borderWidth: 1, borderColor: 'rgba(232,200,117,0.25)' },
  captionName: { color: Colors.text, fontSize: 16, fontFamily: Fonts.serif, fontWeight: '700' },
  captionLine: { color: Colors.textMuted, fontSize: 13, marginTop: 1 },
  sheetHead: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  sheetTitle: { color: Colors.text, fontSize: 18, fontFamily: Fonts.serif, fontWeight: '700' },
  sheetText: { color: Colors.textMuted, fontSize: 14, lineHeight: 19, marginTop: 2 },
  sheetButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  sheetButton: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  sheetButtonPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  sheetButtonText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff8ea', fontFamily: Fonts.serif, fontSize: 22, fontWeight: '700' },
  signedOut: { position: 'absolute', left: 12, right: 12, maxHeight: '55%', backgroundColor: 'rgba(26,18,12,0.9)', borderRadius: 18, borderWidth: 1, borderColor: Colors.border },
  signedOutContent: { padding: 18, gap: 10 },
});
