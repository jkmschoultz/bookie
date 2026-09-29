import Papa from 'papaparse';

import { cleanIsbn, splitSeries } from '@/services/metadata/normalize';
import { emptyDraft, today, type NewBook, type ReadStatus } from '@/types';

type GoodreadsRow = Record<string, string | undefined>;

export interface GoodreadsImport {
  books: NewBook[];
  skipped: number;
}

/** Goodreads writes ISBNs as ="0439023483" so spreadsheets don't mangle them. */
function isbnField(v: string | undefined): string | null {
  return cleanIsbn(v?.replace(/^="?|"$/g, ''));
}

function num(v: string | undefined): number | null {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? n : null;
}

/** "2023/05/14" → "2023-05-14" */
function date(v: string | undefined): string | null {
  const m = v?.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
}

function statusFor(shelf: string | undefined, dateRead: string | null): ReadStatus {
  switch ((shelf ?? '').trim().toLowerCase()) {
    case 'read':
      return 'read';
    case 'currently-reading':
      return 'reading';
    case 'to-read':
      return 'want';
    case 'did-not-finish':
    case 'dnf':
    case 'abandoned':
      return 'dnf';
    default:
      return dateRead ? 'read' : 'owned';
  }
}

export function rowToBook(row: GoodreadsRow): NewBook | null {
  const rawTitle = row['Title']?.trim();
  if (!rawTitle) return null;
  const { title, series, seriesIndex } = splitSeries(rawTitle);
  const authors = [row['Author'], ...(row['Additional Authors'] ?? '').split(',')]
    .map((a) => a?.trim())
    .filter((a): a is string => !!a);
  const dateRead = date(row['Date Read']);
  const status = statusFor(row['Exclusive Shelf'], dateRead);
  const rating = num(row['My Rating']);
  const ownedCopies = num(row['Owned Copies']);
  const bookshelves = (row['Bookshelves'] ?? '').toLowerCase();

  return {
    ...emptyDraft(),
    source: 'goodreads',
    title,
    series,
    seriesIndex,
    authors: [...new Set(authors)],
    isbn13: isbnField(row['ISBN13']),
    isbn10: isbnField(row['ISBN']),
    pageCount: num(row['Number of Pages']),
    publishedYear: num(row['Original Publication Year']) ?? num(row['Year Published']),
    publisher: row['Publisher']?.trim() || null,
    status,
    rating,
    owned: ownedCopies != null || bookshelves.includes('owned') || status !== 'want',
    dateAdded: date(row['Date Added']) ?? today(),
    dateStarted: null,
    dateFinished: status === 'read' ? dateRead : null,
    notes: row['Private Notes']?.trim() || null,
  };
}

export function parseGoodreadsCsv(csv: string): GoodreadsImport {
  const parsed = Papa.parse<GoodreadsRow>(csv.replace(/^﻿/, ''), { header: true, skipEmptyLines: true });
  const books: NewBook[] = [];
  let skipped = 0;
  for (const row of parsed.data) {
    const book = rowToBook(row);
    if (book) books.push(book);
    else skipped++;
  }
  return { books, skipped };
}

export function looksLikeGoodreadsExport(csv: string): boolean {
  const header = csv.slice(0, 500);
  return header.includes('Title') && header.includes('Exclusive Shelf');
}

function splitUrl(url: string): { host: string; path: string } | null {
  const m = url.match(/^https?:\/\/([^/?#]+)([^?#]*)/i);
  return m ? { host: m[1].toLowerCase(), path: m[2] } : null;
}

const isGoodreadsHost = (host: string) => /(^|\.)goodreads\.com$/.test(host);

/** The finished export link, e.g. /review_porter/export/12345/goodreads_library_export.csv */
export function isExportDownload(url: string): boolean {
  const u = splitUrl(url);
  return !!u && isGoodreadsHost(u.host) && (/\.csv$/i.test(u.path) || /\/review_porter\/export\/\d+\/.+/.test(u.path));
}

/**
 * Part of signing in: Goodreads' own sign-in/sign-up pages, its Amazon-style
 * /ap/ flows (verification, 2FA), or another site entirely (Amazon, Apple).
 */
export function isSignInPage(url: string): boolean {
  const u = splitUrl(url);
  if (!u) return false;
  if (!isGoodreadsHost(u.host)) return true;
  return /^\/(user\/sign_(in|up)|ap\/)/i.test(u.path);
}
