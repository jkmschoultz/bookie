import { bookKey, emptyDraft, today, type Book, type NewBook } from '@/types';

const VERSION = 1;

interface BackupFile {
  app: 'bookie';
  version: number;
  exportedAt: string;
  books: NewBook[];
}

/** Covers saved as device files (file://, content://) don't exist anywhere else, so they're left out. */
const portableCover = (url: string | null) => (url && /^(https?|data):/.test(url) ? url : null);

export function backupFileName(date = today()): string {
  return `bookie-backup-${date}.json`;
}

/** The whole library as JSON. Ids are dropped; they're reassigned on restore. */
export function toBackup(books: Book[], exportedAt = new Date().toISOString()): string {
  const file: BackupFile = {
    app: 'bookie',
    version: VERSION,
    exportedAt,
    books: books.map(({ id, ...b }) => ({ ...b, coverUrl: portableCover(b.coverUrl) })),
  };
  return JSON.stringify(file, null, 2);
}

/** Books from a backup file, with missing fields defaulted. Throws a readable error for anything else. */
export function parseBackup(text: string): NewBook[] {
  let file: Partial<BackupFile>;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a Bookie backup.");
  }
  if (file?.app !== 'bookie' || !Array.isArray(file.books)) throw new Error("That file isn't a Bookie backup.");
  if ((file.version ?? 0) > VERSION) throw new Error('That backup is from a newer version of Bookie. Update the app and try again.');

  const defaults: NewBook = {
    ...emptyDraft(),
    status: 'owned',
    rating: null,
    owned: true,
    dateAdded: today(),
    dateStarted: null,
    dateFinished: null,
    notes: null,
  };
  const keys = Object.keys(defaults) as (keyof NewBook)[];
  return file.books
    .filter((b) => b && typeof b.title === 'string' && b.title.trim())
    .map((b) => {
      const book = { ...defaults };
      for (const k of keys) if (b[k] !== undefined) (book as Record<string, unknown>)[k] = b[k];
      return book;
    });
}

/** The restored books that aren't already on the shelves (same ISBN, or same title and first author). */
export function onlyNewBooks(restored: NewBook[], existing: Pick<Book, 'isbn13' | 'title' | 'authors'>[]): NewBook[] {
  const known = new Set(existing.map(bookKey));
  return restored.filter((b) => !known.has(bookKey(b)));
}
