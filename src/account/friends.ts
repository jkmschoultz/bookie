import type { FriendBook } from '@shared/books';
import { emptyDraft, type Book } from '@/types';

import { api } from './api';

export interface Friend {
  userId: string;
  username: string;
  displayName: string | null;
  shelfVisible: boolean;
  /** News on their shelf you haven't seen (books added, started, finished). */
  unseen?: number;
  /** 1 for the friend with the newest news, 2 for the next…; null without news. For sorting, never a time. */
  activeRank?: number | null;
}

export interface FriendRequest {
  requestId: string;
  userId: string;
  username: string;
  displayName: string | null;
}

export interface FriendLists {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

/** For the badge on the Friends button. */
export interface FriendBadge {
  requests: number;
  /** Friends with news you haven't seen. */
  updated: number;
}
export const NO_BADGE: FriendBadge = { requests: 0, updated: 0 };
export const friendBadgeOf = (lists: FriendLists): FriendBadge => ({ requests: lists.incoming.length, updated: lists.friends.filter((f) => (f.unseen ?? 0) > 0).length });

/** One piece of a friend's news. `title` is null for "added N books" (`count`). */
export interface FriendNews {
  kind: 'added' | 'started' | 'finished' | 'added_many';
  title: string | null;
  count: number;
  new: boolean;
}

export const getFriendNews = (userId: string) =>
  api<{ news: FriendNews[]; unseen: number; seenUpTo: string }>('GET', `/api/friends/${encodeURIComponent(userId)}/activity`);
/** Marks the news from getFriendNews seen, up to its `seenUpTo`: anything newer stays new. */
export const markFriendNewsSeen = (userId: string, upTo: string) => api('POST', `/api/friends/${encodeURIComponent(userId)}/activity/seen`, { upTo });

/** A line of news, e.g. "Started reading Piranesi". */
export function newsLine(n: FriendNews): string {
  switch (n.kind) {
    case 'added':
      return `Added ${n.title}`;
    case 'started':
      return `Started reading ${n.title}`;
    case 'finished':
      return `Finished ${n.title}`;
    default:
      return `Added ${n.count} books`;
  }
}

export const friendName = (f: { username: string; displayName: string | null }) => f.displayName ?? f.username;

export const getFriends = () => api<FriendLists>('GET', '/api/friends');
/** Resolves to 'friends' when they had already asked you, else 'requested'. */
export const askFriend = async (username: string) => (await api<{ status: 'friends' | 'requested' }>('POST', '/api/friends/requests', { username })).status;
export const acceptFriend = (requestId: string) => api('POST', `/api/friends/requests/${encodeURIComponent(requestId)}/accept`, {});
export const declineFriend = (requestId: string) => api('POST', `/api/friends/requests/${encodeURIComponent(requestId)}/decline`, {});
/** Removes a friend, or takes back a request you sent. */
export const removeFriend = (userId: string) => api('DELETE', `/api/friends/${encodeURIComponent(userId)}`);

export interface FriendShelf {
  friend: Friend;
  books: Book[];
  /** Each book's id in their account, in the same order as `books`: for opening one (see friendBookId). */
  bookIds: string[];
}

/** A friend's books, kept for the visit so the hallway and their shelf don't fetch them twice. */
const shelves = new Map<string, FriendShelf>();

/**
 * A friend's shelf, as books the shelf components can draw. Friends only get what's on the shelf (FRIEND_FIELDS), so
 * the rest is left empty, and each book gets a local number of its own.
 */
export async function getFriendShelf(userId: string, fresh = false): Promise<FriendShelf> {
  const known = shelves.get(userId);
  if (known && !fresh) return known;
  const res = await api<{ friend: Friend; books: (FriendBook & { id: string })[] }>('GET', `/api/friends/${encodeURIComponent(userId)}/books`);
  const books = res.books.map(({ id: _uid, ...b }, i) => ({
    ...emptyDraft(),
    ...b,
    id: -(i + 1),
    source: 'manual' as const,
    dateAdded: '',
    // Private to you, so friends never have it: nothing to show or sort by.
    statusChangedAt: null,
    notes: null,
  }));
  const shelf = { friend: res.friend, books, bookIds: res.books.map((b) => b.id) };
  shelves.set(userId, shelf);
  return shelf;
}

/** The id that opens one of a friend's books, which stays the same however their shelf changes. */
export const friendBookId = (shelf: FriendShelf, book: Book) => shelf.bookIds[-book.id - 1];
/** The book on a friend's shelf with that id, if it's still there. */
export const friendBook = (shelf: FriendShelf, bookId: string): Book | undefined => shelf.books[shelf.bookIds.indexOf(bookId)];

export const cachedFriendShelf = (userId: string) => shelves.get(userId);

/** A steady colour for a friend's sign, from their username. */
const SIGN_COLOURS = ['#b66b4b', '#557d83', '#7b6e9a', '#a5713a', '#6b8f5e', '#b0587a', '#4f6fa0', '#8a7a3a', '#3f8a80', '#9a4f4f'];
export function friendColour(username: string): string {
  let h = 0;
  for (const c of username.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SIGN_COLOURS[h % SIGN_COLOURS.length];
}
