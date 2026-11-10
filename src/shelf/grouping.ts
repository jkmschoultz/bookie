import type { Book } from '@/types';

export type SortMode = 'genre' | 'author' | 'title' | 'published' | 'recent';

export const SORT_LABELS: Record<SortMode, string> = {
  genre: 'Genre',
  author: 'Author',
  title: 'Title',
  published: 'Published',
  recent: 'Recently read',
};

export interface ShelfGroup {
  key: string;
  label: string;
  books: Book[];
  /** Set on groups that can be combined with their neighbours into ranges: a letter ("A–D") or a decade ("1960s–1980s"). */
  span?: string;
}

/** Authors with at least this many books get a shelf of their own. */
export const OWN_SHELF_MIN_BOOKS = 3;

const UNCATEGORISED = 'Uncategorised';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
const cmp = (a: string, b: string) => collator.compare(a, b);

/** "Ursula K. Le Guin" → "Le Guin"; "Tolkien, J.R.R." → "Tolkien". */
export function authorSurname(name: string): string {
  const trimmed = name.trim();
  if (trimmed.includes(',')) return trimmed.split(',')[0].trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return trimmed;
  const particles = new Set(['de', 'da', 'del', 'della', 'van', 'von', 'der', 'le', 'la', 'du', 'di', 'st.', 'mac']);
  let i = parts.length - 1;
  // Skip generational suffixes: "Martin Luther King Jr."
  if (/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(parts[i]) && i > 0) i--;
  let start = i;
  while (start > 1 && particles.has(parts[start - 1].toLowerCase())) start--;
  return parts.slice(start, i + 1).join(' ');
}

export function primaryAuthor(book: Book): string {
  return book.authors[0] ?? 'Unknown author';
}

/** Title with leading articles removed, for alphabetising. */
export function sortableTitle(title: string): string {
  return title.replace(/^(the|a|an)\s+/i, '').trim();
}

function initialOf(text: string): string {
  const c = text.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

/** Books by the same author sit together, series in order, then by year. */
export function compareShelfOrder(a: Book, b: Book): number {
  return (
    cmp(authorSurname(primaryAuthor(a)), authorSurname(primaryAuthor(b))) ||
    cmp(a.series ?? '', b.series ?? '') ||
    (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0) ||
    (a.publishedYear ?? 9999) - (b.publishedYear ?? 9999) ||
    cmp(sortableTitle(a.title), sortableTitle(b.title))
  );
}

function compareTitle(a: Book, b: Book): number {
  return cmp(sortableTitle(a.title), sortableTitle(b.title)) || compareShelfOrder(a, b);
}

function bucket<K extends string>(books: Book[], keyOf: (b: Book) => K): Map<K, Book[]> {
  const map = new Map<K, Book[]>();
  for (const b of books) {
    const k = keyOf(b);
    const list = map.get(k);
    if (list) list.push(b);
    else map.set(k, [b]);
  }
  return map;
}

function byGenre(books: Book[]): ShelfGroup[] {
  const groups = bucket(books, (b) => b.genres[0] ?? UNCATEGORISED);
  return [...groups.entries()]
    .sort(([a], [b]) => (a === UNCATEGORISED ? 1 : b === UNCATEGORISED ? -1 : cmp(a, b)))
    .map(([genre, list]) => ({ key: `genre:${genre}`, label: genre, books: list.sort(compareShelfOrder) }));
}

function byAuthor(books: Book[]): ShelfGroup[] {
  const perAuthor = bucket(books, primaryAuthor);
  const groups: (ShelfGroup & { sortKey: string })[] = [];
  const loose: Book[] = [];
  for (const [author, list] of perAuthor) {
    if (list.length >= OWN_SHELF_MIN_BOOKS) {
      groups.push({ key: `author:${author}`, label: author, books: list.sort(compareShelfOrder), sortKey: authorSurname(author) });
    } else {
      loose.push(...list);
    }
  }
  for (const [letter, list] of bucket(loose, (b) => initialOf(authorSurname(primaryAuthor(b))))) {
    groups.push({
      key: `author-letter:${letter}`,
      label: letter,
      books: list.sort(compareShelfOrder),
      sortKey: letter === '#' ? '￿' : letter,
      span: letter === '#' ? undefined : letter,
    });
  }
  return groups.sort((a, b) => cmp(a.sortKey, b.sortKey)).map(({ sortKey: _, ...g }) => g);
}

function byTitle(books: Book[]): ShelfGroup[] {
  const groups = bucket(books, (b) => initialOf(sortableTitle(b.title)));
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : cmp(a, b)))
    .map(([letter, list]) => ({
      key: `title:${letter}`,
      label: letter,
      books: list.sort(compareTitle),
      span: letter === '#' ? undefined : letter,
    }));
}

function byPublished(books: Book[]): ShelfGroup[] {
  const groups = bucket(books, (b) => (b.publishedYear == null ? 'unknown' : String(Math.floor(b.publishedYear / 10) * 10)));
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'unknown' ? 1 : b === 'unknown' ? -1 : Number(b) - Number(a)))
    .map(([decade, list]) => ({
      key: `published:${decade}`,
      label: decade === 'unknown' ? 'Unknown date' : `${decade}s`,
      span: decade === 'unknown' ? undefined : `${decade}s`,
      books: list.sort((a, b) => (b.publishedYear ?? 0) - (a.publishedYear ?? 0) || compareShelfOrder(a, b)),
    }));
}

function byRecent(books: Book[]): ShelfGroup[] {
  const reading = books.filter((b) => b.status === 'reading');
  const finished = books.filter((b) => b.dateFinished && b.status !== 'reading');
  const undated = books.filter((b) => !b.dateFinished && b.status !== 'reading');
  // Read with no finish date (common in Goodreads imports, where "Date Read" is often blank) is still read.
  const readUndated = undated.filter((b) => b.status === 'read');
  const dnfUndated = undated.filter((b) => b.status === 'dnf');
  const unread = undated.filter((b) => b.status === 'owned' || b.status === 'want');
  const newestAdded = (a: Book, b: Book) => cmp(b.dateAdded, a.dateAdded);

  const groups: ShelfGroup[] = [];
  if (reading.length) {
    groups.push({
      key: 'recent:reading',
      label: 'Currently reading',
      books: reading.sort((a, b) => cmp(b.dateStarted ?? '', a.dateStarted ?? '')),
    });
  }
  // Read books with no finish date start the read section, by author, ahead of the dated months.
  if (readUndated.length) groups.push({ key: 'recent:read-undated', label: 'Read', books: readUndated.sort(compareShelfOrder) });
  const months = bucket(finished, (b) => b.dateFinished!.slice(0, 7));
  for (const month of [...months.keys()].sort().reverse()) {
    const [y, m] = month.split('-').map(Number);
    groups.push({
      key: `recent:${month}`,
      label: `${MONTHS[m - 1]} ${y}`,
      books: months.get(month)!.sort((a, b) => cmp(b.dateFinished!, a.dateFinished!)),
    });
  }
  if (dnfUndated.length) groups.push({ key: 'recent:dnf', label: 'Did not finish', books: dnfUndated.sort(newestAdded) });
  if (unread.length) groups.push({ key: 'recent:unread', label: 'Not yet read', books: unread.sort(newestAdded) });
  return groups;
}

/** Split a run of combinable groups into `parts` consecutive pieces of as equal a width as possible. */
function splitEvenly(run: ShelfGroup[], widths: number[], parts: number): ShelfGroup[][] {
  const ideal = widths.reduce((a, b) => a + b, 0) / parts;
  const pieces: ShelfGroup[][] = [];
  let piece: ShelfGroup[] = [];
  let width = 0;
  run.forEach((group, i) => {
    // Close the piece when this group would take it further from the ideal than stopping here.
    const closer = Math.abs(width + widths[i] - ideal) <= Math.abs(width - ideal);
    if (piece.length && !closer && pieces.length < parts - 1) {
      pieces.push(piece);
      piece = [];
      width = 0;
    }
    piece.push(group);
    width += widths[i];
  });
  if (piece.length) pieces.push(piece);
  return pieces;
}

function rangeGroup(piece: ShelfGroup[]): ShelfGroup {
  const [first] = piece;
  const last = piece[piece.length - 1];
  if (piece.length === 1) return first;
  // Label low to high whichever way the shelves run (decades are newest first): "A–D", "1960s–1980s".
  const [low, high] = [first.span!, last.span!].sort(cmp);
  return { key: `${first.key}–${last.span}`, label: `${low}–${high}`, books: piece.flatMap((g) => g.books) };
}

/**
 * Combines neighbouring letter or decade groups into ranges ("A–D", "1960s–1980s", …) of about `target` width
 * each, so a shelf holds roughly a screen of books. Groups are never split, so a range runs on to the end of its
 * last letter or decade. Other groups (an author's own shelf, "#", "Unknown date") stay as they are and break the runs.
 */
export function combineRanges(groups: ShelfGroup[], target: number, widthOf: (group: ShelfGroup) => number): ShelfGroup[] {
  const out: ShelfGroup[] = [];
  let run: ShelfGroup[] = [];
  const flush = () => {
    if (!run.length) return;
    const widths = run.map(widthOf);
    const parts = Math.max(1, Math.round(widths.reduce((a, b) => a + b, 0) / target));
    out.push(...splitEvenly(run, widths, parts).map(rangeGroup));
    run = [];
  };
  for (const group of groups) {
    if (group.span) {
      run.push(group);
    } else {
      flush();
      out.push(group);
    }
  }
  flush();
  return out;
}

export function groupBooks(books: Book[], mode: SortMode): ShelfGroup[] {
  const copy = [...books];
  switch (mode) {
    case 'genre':
      return byGenre(copy);
    case 'author':
      return byAuthor(copy);
    case 'title':
      return byTitle(copy);
    case 'published':
      return byPublished(copy);
    case 'recent':
      return byRecent(copy);
  }
}
