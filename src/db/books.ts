import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import type { Book, NewBook } from '@/types';

interface BookRow {
  id: number;
  isbn13: string | null;
  isbn10: string | null;
  title: string;
  subtitle: string | null;
  authors: string;
  genres: string;
  series: string | null;
  series_index: number | null;
  page_count: number | null;
  published_year: number | null;
  publisher: string | null;
  cover_url: string | null;
  height_mm: number | null;
  spine_color: string | null;
  source: Book['source'];
  status: Book['status'];
  rating: number | null;
  owned: number;
  date_added: string;
  date_started: string | null;
  date_finished: string | null;
  notes: string | null;
}

/** Book field → column name. The single source of truth for the mapping. */
const COLUMNS = {
  isbn13: 'isbn13',
  isbn10: 'isbn10',
  title: 'title',
  subtitle: 'subtitle',
  authors: 'authors',
  genres: 'genres',
  series: 'series',
  seriesIndex: 'series_index',
  pageCount: 'page_count',
  publishedYear: 'published_year',
  publisher: 'publisher',
  coverUrl: 'cover_url',
  heightMm: 'height_mm',
  spineColor: 'spine_color',
  source: 'source',
  status: 'status',
  rating: 'rating',
  owned: 'owned',
  dateAdded: 'date_added',
  dateStarted: 'date_started',
  dateFinished: 'date_finished',
  notes: 'notes',
} as const satisfies Record<keyof NewBook, keyof BookRow>;

function fromRow(r: BookRow): Book {
  return {
    id: r.id,
    isbn13: r.isbn13,
    isbn10: r.isbn10,
    title: r.title,
    subtitle: r.subtitle,
    authors: JSON.parse(r.authors),
    genres: JSON.parse(r.genres),
    series: r.series,
    seriesIndex: r.series_index,
    pageCount: r.page_count,
    publishedYear: r.published_year,
    publisher: r.publisher,
    coverUrl: r.cover_url,
    heightMm: r.height_mm,
    spineColor: r.spine_color,
    source: r.source,
    status: r.status,
    rating: r.rating,
    owned: !!r.owned,
    dateAdded: r.date_added,
    dateStarted: r.date_started,
    dateFinished: r.date_finished,
    notes: r.notes,
  };
}

function toValue(key: keyof NewBook, value: unknown): SQLiteBindValue {
  if (key === 'authors' || key === 'genres') return JSON.stringify(value ?? []);
  if (key === 'owned') return value ? 1 : 0;
  return (value ?? null) as SQLiteBindValue;
}

export async function getAllBooks(db: SQLiteDatabase): Promise<Book[]> {
  const rows = await db.getAllAsync<BookRow>('SELECT * FROM books');
  return rows.map(fromRow);
}

export async function insertBook(db: SQLiteDatabase, book: NewBook): Promise<Book> {
  const keys = Object.keys(COLUMNS) as (keyof NewBook)[];
  const sql = `INSERT INTO books (${keys.map((k) => COLUMNS[k]).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
  const res = await db.runAsync(sql, keys.map((k) => toValue(k, book[k])));
  return { ...book, id: res.lastInsertRowId };
}

export async function insertBooks(db: SQLiteDatabase, books: NewBook[]): Promise<Book[]> {
  const saved: Book[] = [];
  await db.withTransactionAsync(async () => {
    for (const b of books) saved.push(await insertBook(db, b));
  });
  return saved;
}

export async function updateBook(db: SQLiteDatabase, id: number, patch: Partial<NewBook>): Promise<void> {
  const keys = (Object.keys(patch) as (keyof NewBook)[]).filter((k) => k in COLUMNS);
  if (!keys.length) return;
  const sql = `UPDATE books SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')} WHERE id = ?`;
  await db.runAsync(sql, [...keys.map((k) => toValue(k, patch[k])), id]);
}

export async function deleteBook(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM books WHERE id = ?', id);
}

export async function findByIsbn(db: SQLiteDatabase, isbn13: string): Promise<Book | null> {
  const row = await db.getFirstAsync<BookRow>('SELECT * FROM books WHERE isbn13 = ?', isbn13);
  return row ? fromRow(row) : null;
}
