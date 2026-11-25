import type { SyncBook } from '../shared/books';
import type { NewBook, ReadStatus } from '../src/types';
import { badRequest } from './http';

/** What a synced book may hold. Anything else is refused, so a client can't store arbitrary data in an account. */

const STATUSES: ReadStatus[] = ['want', 'reading', 'read', 'owned', 'dnf'];
const SOURCES: NewBook['source'][] = ['openlibrary', 'googlebooks', 'goodreads', 'manual'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** A book is a few hundred bytes; this leaves plenty of room for long notes. */
const MAX_BOOK_BYTES = 24_000;

const text = (v: unknown, max: number): string | null => {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') throw invalid();
  return v.slice(0, max);
};
const num = (v: unknown, lo: number, hi: number): number | null => {
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw invalid();
  return Math.min(hi, Math.max(lo, v));
};
const list = (v: unknown, maxItems: number, maxLength: number): string[] => {
  if (v == null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw invalid();
  return v.slice(0, maxItems).map((x: string) => x.slice(0, maxLength));
};
/** A time, stored in one form (ISO, UTC) whatever the client sent. */
const instant = (v: unknown): string | null => {
  const s = text(v, 40);
  if (s == null) return null;
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) throw invalid();
  return new Date(ms).toISOString();
};
const day = (v: unknown): string | null => {
  const s = text(v, 10);
  if (s != null && !DAY.test(s)) throw invalid();
  return s;
};
const invalid = () => badRequest('A book in that request isn’t valid.', 'invalid_book');

function book(raw: unknown): NewBook {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid();
  if (JSON.stringify(raw).length > MAX_BOOK_BYTES) throw badRequest('A book in that request is too large.', 'invalid_book');
  const b = raw as Record<string, unknown>;
  const title = text(b.title, 500);
  if (!title) throw invalid();
  const cover = text(b.coverUrl, 2000);
  const palette = b.coverPalette == null ? null : list(b.coverPalette, 4, 9);
  const colour = text(b.spineColor, 9);
  return {
    isbn13: text(b.isbn13, 13),
    isbn10: text(b.isbn10, 10),
    title,
    subtitle: text(b.subtitle, 500),
    authors: list(b.authors, 20, 200),
    genres: list(b.genres, 20, 100),
    series: text(b.series, 300),
    seriesIndex: num(b.seriesIndex, 0, 10_000),
    pageCount: num(b.pageCount, 0, 100_000),
    publishedYear: num(b.publishedYear, -5000, 10_000),
    publisher: text(b.publisher, 300),
    // Only covers on the web travel; photos stay on the device they were taken on.
    coverUrl: cover && /^https?:\/\//i.test(cover) ? cover : null,
    heightMm: num(b.heightMm, 0, 1000),
    spineColor: colour && /^#[0-9a-f]{3,8}$/i.test(colour) ? colour : null,
    coverPalette: palette ? palette.filter((c) => /^#[0-9a-f]{6}$/i.test(c)) : null,
    source: SOURCES.includes(b.source as NewBook['source']) ? (b.source as NewBook['source']) : 'manual',
    status: STATUSES.includes(b.status as ReadStatus) ? (b.status as ReadStatus) : 'owned',
    rating: num(b.rating, 0, 5),
    owned: b.owned !== false,
    dateAdded: day(b.dateAdded) ?? '1970-01-01',
    dateStarted: day(b.dateStarted),
    dateFinished: day(b.dateFinished),
    statusChangedAt: instant(b.statusChangedAt),
    notes: text(b.notes, 20_000),
  };
}

/** The changes in a sync request, checked. Sample books are never meant to sync, so they're refused too. */
export function syncChanges(raw: unknown, now: number, max: number): SyncBook[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw badRequest('Changes must be a list.');
  if (raw.length > max) throw badRequest(`Send at most ${max} changes at a time.`);
  const seen = new Set<string>();
  return raw.map((c) => {
    if (!c || typeof c !== 'object') throw invalid();
    const { id, updatedAt, deletedAt } = c as Record<string, unknown>;
    if (typeof id !== 'string' || !ID.test(id) || seen.has(id)) throw invalid();
    seen.add(id);
    if (typeof updatedAt !== 'number' || !Number.isSafeInteger(updatedAt) || updatedAt <= 0) throw invalid();
    // A clock far ahead would make a change impossible to override, so the future is capped at a day.
    const at = Math.min(updatedAt, now + 24 * 60 * 60 * 1000);
    if (deletedAt != null) {
      if (typeof deletedAt !== 'number' || !Number.isSafeInteger(deletedAt)) throw invalid();
      return { id, updatedAt: at, deletedAt: Math.min(deletedAt, at), book: null };
    }
    const raw = (c as Record<string, unknown>).book as Record<string, unknown> | undefined;
    if (raw && raw.source === 'sample') throw badRequest('Sample books don’t sync.', 'invalid_book');
    return { id, updatedAt: at, deletedAt: null, book: book(raw) };
  });
}
