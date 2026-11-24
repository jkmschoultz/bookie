import { randomUUID } from 'expo-crypto';
import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import { incomingBook, outgoingBook, wins, type SyncBook } from '@shared/books';
import type { Book, NewBook } from '@/types';

/*
 * Every book also has a `uid`, the same on every device, for syncing with an account. Changes stamp `updated_at` and
 * set `dirty` until they've been sent. Deleting keeps a tombstone (`deleted_at`) until that's been sent too; the shelf
 * never sees tombstones. Without an account nothing is ever sent, and tombstones are cleared away (purgeTombstones).
 */

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
  cover_palette: string | null;
  source: Book['source'];
  status: Book['status'];
  rating: number | null;
  owned: number;
  date_added: string;
  date_started: string | null;
  date_finished: string | null;
  status_changed_at: string | null;
  notes: string | null;
  uid: string;
  updated_at: number;
  deleted_at: number | null;
  dirty: number;
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
  coverPalette: 'cover_palette',
  source: 'source',
  status: 'status',
  rating: 'rating',
  owned: 'owned',
  dateAdded: 'date_added',
  dateStarted: 'date_started',
  dateFinished: 'date_finished',
  statusChangedAt: 'status_changed_at',
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
    coverPalette: r.cover_palette == null ? null : JSON.parse(r.cover_palette),
    source: r.source,
    status: r.status,
    rating: r.rating,
    owned: !!r.owned,
    dateAdded: r.date_added,
    dateStarted: r.date_started,
    dateFinished: r.date_finished,
    statusChangedAt: r.status_changed_at,
    notes: r.notes,
  };
}

function toValue(key: keyof NewBook, value: unknown): SQLiteBindValue {
  if (key === 'authors' || key === 'genres') return JSON.stringify(value ?? []);
  if (key === 'owned') return value ? 1 : 0;
  if (key === 'coverPalette') return value == null ? null : JSON.stringify(value);
  return (value ?? null) as SQLiteBindValue;
}

export async function getAllBooks(db: SQLiteDatabase): Promise<Book[]> {
  const rows = await db.getAllAsync<BookRow>('SELECT * FROM books WHERE deleted_at IS NULL');
  return rows.map(fromRow);
}

const KEYS = Object.keys(COLUMNS) as (keyof NewBook)[];

async function insertRow(db: SQLiteDatabase, book: NewBook, uid: string, updatedAt: number, dirty: boolean): Promise<number> {
  const sql = `INSERT INTO books (${KEYS.map((k) => COLUMNS[k]).join(', ')}, uid, updated_at, dirty) VALUES (${KEYS.map(() => '?').join(', ')}, ?, ?, ?)`;
  const res = await db.runAsync(sql, [...KEYS.map((k) => toValue(k, book[k])), uid, updatedAt, dirty ? 1 : 0]);
  return res.lastInsertRowId;
}

export async function insertBook(db: SQLiteDatabase, book: NewBook): Promise<Book> {
  return { ...book, id: await insertRow(db, book, randomUUID(), Date.now(), true) };
}

export async function insertBooks(db: SQLiteDatabase, books: NewBook[]): Promise<Book[]> {
  const saved: Book[] = [];
  await db.withTransactionAsync(async () => {
    for (const b of books) saved.push(await insertBook(db, b));
  });
  return saved;
}

/** Marks a book changed: stamped now, or just after its last change if this device's clock is behind. */
const CHANGED = 'updated_at = max(?, updated_at + 1), dirty = 1';

/** Saves a change to a book. Returns what was saved, including any stamp it got, so the shelf in memory can match. */
export async function updateBook(db: SQLiteDatabase, id: number, patch: Partial<NewBook>): Promise<Partial<NewBook>> {
  let changes = patch;
  // A new status is stamped as changed now, unless the caller says when.
  if ('status' in patch && !('statusChangedAt' in patch)) {
    const row = await db.getFirstAsync<Pick<BookRow, 'status'>>('SELECT status FROM books WHERE id = ?', id);
    if (row && row.status !== patch.status) changes = { ...patch, statusChangedAt: new Date().toISOString() };
  }
  const keys = (Object.keys(changes) as (keyof NewBook)[]).filter((k) => k in COLUMNS);
  if (!keys.length) return {};
  const sql = `UPDATE books SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')}, ${CHANGED} WHERE id = ?`;
  await db.runAsync(sql, [...keys.map((k) => toValue(k, changes[k])), Date.now(), id]);
  return changes;
}

export async function deleteBook(db: SQLiteDatabase, id: number): Promise<void> {
  await deleteBooks(db, [id]);
}

export async function deleteBooks(db: SQLiteDatabase, ids: number[]): Promise<void> {
  if (!ids.length) return;
  const now = Date.now();
  await db.runAsync(`UPDATE books SET deleted_at = ?, ${CHANGED} WHERE id IN (${ids.map(() => '?').join(', ')})`, [now, now, ...ids]);
}

export async function deleteAllBooks(db: SQLiteDatabase): Promise<void> {
  const now = Date.now();
  await db.runAsync(`UPDATE books SET deleted_at = ?, ${CHANGED} WHERE deleted_at IS NULL`, [now, now]);
}

export async function findByIsbn(db: SQLiteDatabase, isbn13: string): Promise<Book | null> {
  const row = await db.getFirstAsync<BookRow>('SELECT * FROM books WHERE isbn13 = ? AND deleted_at IS NULL', isbn13);
  return row ? fromRow(row) : null;
}

/** Changes not yet sent to the account, oldest first. Sample books never leave the device. */
export async function pendingChanges(db: SQLiteDatabase, limit: number): Promise<SyncBook[]> {
  const rows = await db.getAllAsync<BookRow>("SELECT * FROM books WHERE dirty = 1 AND source != 'sample' ORDER BY updated_at LIMIT ?", limit);
  return rows.map((r) => {
    const { id, ...book } = fromRow(r);
    return { id: r.uid, updatedAt: r.updated_at, deletedAt: r.deleted_at, book: r.deleted_at == null ? outgoingBook(book) : null };
  });
}

/** Marks sent changes as sent, unless the book changed again while they were on their way. */
export async function markSent(db: SQLiteDatabase, sent: Pick<SyncBook, 'id' | 'updatedAt'>[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const c of sent) await db.runAsync('UPDATE books SET dirty = 0 WHERE uid = ? AND updated_at = ?', c.id, c.updatedAt);
  });
}

/**
 * Takes in changes from the account, keeping whichever version of each book is newest. A local edit that's newer
 * stays, to be sent next. Returns how many books changed here.
 */
export async function applyRemote(db: SQLiteDatabase, changes: SyncBook[]): Promise<number> {
  let applied = 0;
  await db.withTransactionAsync(async () => {
    for (const remote of changes) {
      const local = await db.getFirstAsync<Pick<BookRow, 'id' | 'updated_at' | 'cover_url'>>('SELECT id, updated_at, cover_url FROM books WHERE uid = ?', remote.id);
      const current = local && { updatedAt: local.updated_at };
      if (!wins(remote, current)) {
        // The same version came back: nothing left to send.
        if (local && local.updated_at === remote.updatedAt) await db.runAsync('UPDATE books SET dirty = 0 WHERE id = ?', local.id);
        continue;
      }
      applied++;
      if (remote.deletedAt != null || !remote.book) {
        if (local) await db.runAsync('DELETE FROM books WHERE id = ?', local.id);
        continue;
      }
      const book = incomingBook(remote.book, local && { coverUrl: local.cover_url });
      if (!local) {
        await insertRow(db, book, remote.id, remote.updatedAt, false);
        continue;
      }
      const sql = `UPDATE books SET ${KEYS.map((k) => `${COLUMNS[k]} = ?`).join(', ')}, updated_at = ?, deleted_at = NULL, dirty = 0 WHERE id = ?`;
      await db.runAsync(sql, [...KEYS.map((k) => toValue(k, book[k])), remote.updatedAt, local.id]);
    }
  });
  return applied;
}

/** Books on the shelf that would sync: not deleted, not samples. */
export async function countSyncable(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM books WHERE deleted_at IS NULL AND source != 'sample'");
  return row?.n ?? 0;
}

/** Removes every book from this device for good, tombstones too: before taking in an account's library instead. */
export async function clearLibrary(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM books');
}

/** Everything on this device is to be sent, e.g. when signing in to an account for the first time here. */
export async function markAllUnsent(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('UPDATE books SET dirty = 1');
}

/** Clears away tombstones that have been sent, or all of them when there's no account to send them to. */
export async function purgeTombstones(db: SQLiteDatabase, all: boolean): Promise<void> {
  await db.runAsync(`DELETE FROM books WHERE deleted_at IS NOT NULL AND (dirty = 0 OR source = 'sample' OR ?)`, all ? 1 : 0);
}
