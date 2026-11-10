import type { Book, NewBook, ReadStatus } from '@/types';

/** One set of duplicates: the copy that stays, what to change on it, and the copies to remove. */
export interface DuplicateMerge {
  keep: Book;
  patch: Partial<NewBook>;
  remove: Book[];
}

/** Lowercase, no accents, "&" as "and", punctuation as spaces. */
function normalise(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Same title and first author. Spaces are dropped from the author so "J.R.R." matches "J. R. R.". */
export function duplicateKey(book: Pick<Book, 'title' | 'authors'>): string {
  return `${normalise(book.title)}|${normalise(book.authors[0] ?? '').replace(/ /g, '')}`;
}

const filled = (v: unknown) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0);

/** Fields that count towards "has more info" when choosing which copy to keep. */
const INFO_FIELDS = [
  'isbn13', 'isbn10', 'subtitle', 'genres', 'series', 'seriesIndex', 'pageCount', 'publishedYear', 'publisher',
  'coverUrl', 'heightMm', 'spineColor', 'rating', 'notes', 'dateStarted', 'dateFinished',
] as const satisfies readonly (keyof Book)[];

function infoScore(book: Book): number {
  return INFO_FIELDS.filter((k) => filled(book[k])).length;
}

/** Further along wins: re-reading beats read, any reading beats unread. */
const STATUS_RANK: Record<ReadStatus, number> = { reading: 5, read: 4, dnf: 3, owned: 2, want: 1 };

/** Simple details: the kept copy's value, or the first other copy (most info first) that has one. */
const FILL_GAPS = [
  'isbn13', 'isbn10', 'subtitle', 'pageCount', 'publishedYear', 'publisher', 'heightMm', 'spineColor', 'rating',
] as const satisfies readonly (keyof NewBook)[];

const latest = (dates: (string | null)[]) => dates.filter((d): d is string => !!d).sort().at(-1) ?? null;
const earliest = (dates: string[]) => [...dates].sort()[0];

/** All copies merged into one record, with nothing worth keeping lost. `copies` is ordered keeper first. */
function merged(copies: Book[]): NewBook {
  const [keep] = copies;
  const { id: _, ...book } = keep;
  for (const key of FILL_GAPS) {
    const from = copies.find((c) => filled(c[key]));
    if (from) (book as Record<string, unknown>)[key] = from[key];
  }
  // A series and its number belong together, and so do a cover and the colours read from it.
  const series = copies.find((c) => filled(c.series));
  if (series) Object.assign(book, { series: series.series, seriesIndex: series.seriesIndex });
  const cover = copies.find((c) => filled(c.coverUrl));
  if (cover) Object.assign(book, { coverUrl: cover.coverUrl, coverPalette: cover.coverPalette });

  book.genres = [...new Set(copies.flatMap((c) => c.genres))];
  book.notes = [...new Set(copies.map((c) => c.notes?.trim()).filter((n): n is string => !!n))].join('\n\n') || null;
  book.status = copies.reduce((best, c) => (STATUS_RANK[c.status] > STATUS_RANK[best] ? c.status : best), keep.status);
  book.owned = copies.some((c) => c.owned);
  book.dateAdded = earliest(copies.map((c) => c.dateAdded));
  book.dateStarted = latest(copies.map((c) => c.dateStarted));
  book.dateFinished = latest(copies.map((c) => c.dateFinished));
  return book;
}

/** Every set of duplicates in the library, and how to fold each into a single book. */
export function findDuplicates(books: Book[]): DuplicateMerge[] {
  const groups = new Map<string, Book[]>();
  for (const b of books) {
    const key = duplicateKey(b);
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  const merges: DuplicateMerge[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // Most info first; on a tie, the copy added first.
    const copies = [...group].sort((a, b) => infoScore(b) - infoScore(a) || a.id - b.id);
    const [keep, ...remove] = copies;
    const book = merged(copies);
    const patch: Partial<NewBook> = {};
    for (const key of Object.keys(book) as (keyof NewBook)[]) {
      if (JSON.stringify(book[key]) !== JSON.stringify(keep[key])) (patch as Record<string, unknown>)[key] = book[key];
    }
    merges.push({ keep, patch, remove });
  }
  return merges;
}
