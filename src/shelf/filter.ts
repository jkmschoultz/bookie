import type { Book, ReadStatus } from '@/types';

export interface BookFilter {
  /** Empty = any status. */
  statuses: ReadStatus[];
  /** true = only books on your shelf, false = only books you don't own, null = both. */
  owned: boolean | null;
}

export function filterBooks(books: Book[], { statuses, owned }: BookFilter): Book[] {
  return books.filter((b) => (!statuses.length || statuses.includes(b.status)) && (owned === null || b.owned === owned));
}
