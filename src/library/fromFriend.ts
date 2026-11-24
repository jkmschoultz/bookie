import { emptyDraft, today, type Book, type BookDraft, type NewBook } from '@/types';

/** What a book is, as opposed to how someone reads it: all that comes across from a friend's shelf. */
const DETAILS = [
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
] as const satisfies readonly (keyof BookDraft)[];

/**
 * A book on a friend's shelf, as a new book of your own: its details, never their status, rating, dates or whether
 * they own it. `status` is 'owned' for one on your shelf, unread (as a book you add starts), or 'want' for one you want
 * to read and don't have.
 */
export function fromFriend(book: Book, status: 'owned' | 'want'): NewBook {
  const details = Object.fromEntries(DETAILS.map((k) => [k, book[k]])) as Pick<BookDraft, (typeof DETAILS)[number]>;
  return {
    ...emptyDraft(),
    ...details,
    status,
    owned: status === 'owned',
    rating: null,
    dateAdded: today(),
    dateStarted: null,
    dateFinished: null,
    notes: null,
  };
}
