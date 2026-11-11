import { today, type Book, type NewBook, type ReadStatus } from '@/types';

/**
 * Moving a book you don't own out of "Want to read" is the moment you probably got it, so it's worth asking
 * whether it's on your shelf now. Other changes never ask, and never change ownership.
 */
export function asksAboutOwnership(book: Pick<Book, 'status' | 'owned'>, status: ReadStatus): boolean {
  return book.status === 'want' && !book.owned && (status === 'reading' || status === 'owned' || status === 'read');
}

/**
 * Date bookkeeping when a book changes status (e.g. finishing sets dateFinished).
 * Whether you own the book is a separate choice and is never changed by a status change.
 */
export function statusPatch(book: Book, status: ReadStatus): Partial<NewBook> {
  const patch: Partial<NewBook> = { status };
  if (status === 'reading' && !book.dateStarted) patch.dateStarted = today();
  if (status === 'read') patch.dateFinished = book.dateFinished ?? today();
  if (status === 'reading' || status === 'want' || status === 'owned') patch.dateFinished = null;
  return patch;
}
