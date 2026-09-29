export type ReadStatus = 'want' | 'reading' | 'read' | 'owned' | 'dnf';

export const STATUS_LABELS: Record<ReadStatus, string> = {
  reading: 'Reading',
  read: 'Read',
  owned: 'Unread',
  want: 'Want to read',
  dnf: 'Did not finish',
};

/** Everything we know about a book before it is saved to the library. */
export interface BookDraft {
  isbn13: string | null;
  isbn10: string | null;
  title: string;
  subtitle: string | null;
  authors: string[];
  genres: string[];
  series: string | null;
  seriesIndex: number | null;
  pageCount: number | null;
  publishedYear: number | null;
  publisher: string | null;
  coverUrl: string | null;
  heightMm: number | null;
  /** Overrides the generated spine colour when set. */
  spineColor: string | null;
  source: 'openlibrary' | 'googlebooks' | 'goodreads' | 'manual' | 'sample';
}

/** A book in the user's library, including their reading record. */
export interface Book extends BookDraft {
  id: number;
  status: ReadStatus;
  rating: number | null;
  owned: boolean;
  dateAdded: string; // ISO date (YYYY-MM-DD)
  dateStarted: string | null;
  dateFinished: string | null;
  notes: string | null;
}

export type NewBook = Omit<Book, 'id'>;

export function emptyDraft(): BookDraft {
  return {
    isbn13: null,
    isbn10: null,
    title: '',
    subtitle: null,
    authors: [],
    genres: [],
    series: null,
    seriesIndex: null,
    pageCount: null,
    publishedYear: null,
    publisher: null,
    coverUrl: null,
    heightMm: null,
    spineColor: null,
    source: 'manual',
  };
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
