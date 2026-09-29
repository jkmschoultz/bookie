import { emptyDraft, type BookDraft } from '@/types';

import { cleanIsbn, mapGenres, parseHeightMm, parseYear, splitSeries } from './normalize';

const BASE = 'https://openlibrary.org';
const SEARCH_FIELDS = 'key,title,subtitle,author_name,first_publish_year,isbn,number_of_pages_median,cover_i,subject,publisher';

export interface OLSearchDoc {
  key: string;
  title: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  number_of_pages_median?: number;
  cover_i?: number;
  subject?: string[];
  publisher?: string[];
}

interface OLEdition {
  title?: string;
  subtitle?: string;
  number_of_pages?: number;
  pagination?: string;
  publish_date?: string;
  publishers?: string[];
  covers?: number[];
  physical_dimensions?: string;
  isbn_10?: string[];
  isbn_13?: string[];
  series?: string[];
}

export function coverUrl(coverId: number | undefined | null, size: 'S' | 'M' | 'L' = 'M'): string | null {
  return coverId && coverId > 0 ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg` : null;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function pickIsbn13(isbns: string[] | undefined): string | null {
  return isbns?.map(cleanIsbn).find((i): i is string => !!i && i.length === 13) ?? null;
}

export function draftFromSearchDoc(doc: OLSearchDoc): BookDraft {
  const { title, series, seriesIndex } = splitSeries(doc.title);
  return {
    ...emptyDraft(),
    source: 'openlibrary',
    title,
    series,
    seriesIndex,
    subtitle: doc.subtitle ?? null,
    authors: doc.author_name ?? [],
    genres: mapGenres(doc.subject ?? []),
    pageCount: doc.number_of_pages_median ?? null,
    publishedYear: doc.first_publish_year ?? null,
    publisher: doc.publisher?.[0] ?? null,
    coverUrl: coverUrl(doc.cover_i),
    isbn13: pickIsbn13(doc.isbn),
  };
}

export async function searchOpenLibrary(query: string, signal?: AbortSignal): Promise<OLSearchDoc[]> {
  const url = `${BASE}/search.json?q=${encodeURIComponent(query)}&fields=${SEARCH_FIELDS}&limit=25`;
  const data = await getJson<{ docs: OLSearchDoc[] }>(url, signal);
  return data?.docs ?? [];
}

/** Look up one specific edition by ISBN. Returns null when Open Library doesn't know it. */
export async function lookupOpenLibraryIsbn(isbn: string, signal?: AbortSignal): Promise<BookDraft | null> {
  const [edition, search] = await Promise.all([
    getJson<OLEdition>(`${BASE}/isbn/${isbn}.json`, signal).catch(() => null),
    getJson<{ docs: OLSearchDoc[] }>(`${BASE}/search.json?q=isbn:${isbn}&fields=${SEARCH_FIELDS}&limit=1`, signal).catch(() => null),
  ]);
  const doc = search?.docs?.[0];
  if (!edition && !doc) return null;

  const fromWork = doc ? draftFromSearchDoc(doc) : { ...emptyDraft(), source: 'openlibrary' as const };
  const pages = edition?.number_of_pages ?? (edition?.pagination ? Number(edition.pagination.match(/\d+/)?.[0]) || null : null);
  const editionTitle = edition?.title ? splitSeries(edition.title) : null;
  return {
    ...fromWork,
    title: editionTitle?.title || fromWork.title,
    subtitle: edition?.subtitle ?? fromWork.subtitle,
    series: fromWork.series ?? editionTitle?.series ?? edition?.series?.[0]?.replace(/[;,]?\s*(no\.|#|v\.)?\s*\d+.*$/i, '') ?? null,
    pageCount: pages ?? fromWork.pageCount,
    publishedYear: fromWork.publishedYear ?? parseYear(edition?.publish_date),
    publisher: edition?.publishers?.[0] ?? fromWork.publisher,
    coverUrl: coverUrl(edition?.covers?.[0]) ?? fromWork.coverUrl,
    heightMm: parseHeightMm(edition?.physical_dimensions),
    isbn13: pickIsbn13(edition?.isbn_13) ?? (isbn.length === 13 ? isbn : fromWork.isbn13),
    isbn10: cleanIsbn(edition?.isbn_10?.[0]) ?? (isbn.length === 10 ? isbn : null),
  };
}
