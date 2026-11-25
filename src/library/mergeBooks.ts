import type { Book, NewBook } from '@/types';

/**
 * The shelf in memory after changes were saved: each book with its saved changes applied (the same ones the database
 * got, including any time stamped on the way), and the removed books left out.
 */
export function applyChanges(books: Book[], changes: Map<number, Partial<NewBook>>, removed: Set<number> = new Set()): Book[] {
  return books
    .filter((b) => !removed.has(b.id))
    .map((b) => {
      const change = changes.get(b.id);
      return change ? { ...b, ...change } : b;
    });
}
