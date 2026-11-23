import type { NewBook } from '../src/types';

/**
 * Books as they travel between a device and the account: what's synced, what friends may see, and which version of a
 * book wins when two devices changed it.
 */

/** One book's latest version. A deleted book is a tombstone: `deletedAt` set and no fields. */
export interface SyncBook {
  /** The book's id everywhere (a UUID). Each device also keeps its own local number for it. */
  id: string;
  /** When it last changed, in ms. The newest version wins. */
  updatedAt: number;
  deletedAt: number | null;
  book: NewBook | null;
}

/** What friends see on your shelf: the book and where it stands, not your notes, ratings or reading dates. */
export const FRIEND_FIELDS = [
  'isbn13',
  'isbn10',
  'title',
  'subtitle',
  'authors',
  'genres',
  'series',
  'seriesIndex',
  'pageCount',
  'publishedYear',
  'publisher',
  'coverUrl',
  'heightMm',
  'spineColor',
  'coverPalette',
  'status',
  'owned',
] as const satisfies readonly (keyof NewBook)[];

export type FriendBook = Pick<NewBook, (typeof FRIEND_FIELDS)[number]>;

/** Kept with your account, but only for you. */
export const PRIVATE_FIELDS = ['rating', 'dateAdded', 'dateStarted', 'dateFinished', 'notes', 'source'] as const satisfies readonly (keyof NewBook)[];

/** A cover that is only on this device: a photo saved as a file, or kept inline (data:) on the web. */
export function isDeviceCover(url: string | null): boolean {
  return !!url && !/^https?:/i.test(url);
}

/** Covers saved as device files or inline photos don't exist anywhere else, so they're left out of backups and sync. */
export function portableCover(url: string | null): string | null {
  return url && /^(https?|data):/.test(url) ? url : null;
}

/** The book as sent to the account: everything but a cover photo that only lives on this device. */
export function outgoingBook(book: NewBook): NewBook {
  return isDeviceCover(book.coverUrl) ? { ...book, coverUrl: null } : book;
}

/**
 * The book as kept on this device when a newer version arrives from the account. Cover photos don't sync, so a photo
 * on this device stays unless the other device chose a real cover (a web address) since.
 */
export function incomingBook(remote: NewBook, local: Pick<NewBook, 'coverUrl'> | null): NewBook {
  if (remote.coverUrl == null && local && isDeviceCover(local.coverUrl)) return { ...remote, coverUrl: local.coverUrl };
  return remote;
}

/**
 * Whether `incoming` replaces `current`: last writer wins, by `updatedAt`. Ties keep what's there, so sending the same
 * version twice changes nothing. A deletion is a version like any other, so a later edit brings a book back.
 */
export function wins(incoming: Pick<SyncBook, 'updatedAt'>, current: Pick<SyncBook, 'updatedAt'> | null | undefined): boolean {
  return !current || incoming.updatedAt > current.updatedAt;
}

/** The time to stamp an edit with: now, or just after the version it replaces if this device's clock is behind. */
export function nextUpdatedAt(previous: number, now = Date.now()): number {
  return Math.max(now, previous + 1);
}

/** Split a book into what friends may see and the rest. */
export function splitBook(book: NewBook): { shared: FriendBook; personal: Pick<NewBook, (typeof PRIVATE_FIELDS)[number]> } {
  const shared = Object.fromEntries(FRIEND_FIELDS.map((k) => [k, book[k]])) as FriendBook;
  const personal = Object.fromEntries(PRIVATE_FIELDS.map((k) => [k, book[k]])) as Pick<NewBook, (typeof PRIVATE_FIELDS)[number]>;
  return { shared, personal };
}
