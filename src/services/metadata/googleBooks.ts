import { emptyDraft, type BookDraft } from '@/types';

import { cleanIsbn, mapGenres, parseHeightMm, parseYear } from './normalize';

/**
 * Google Books is a fallback for page counts, categories and physical height.
 * Keyless requests share a tiny global quota, so set EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY
 * for reliable results. Every function here resolves to null on failure.
 */
const KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;
const BASE = 'https://www.googleapis.com/books/v1/volumes';

interface GBVolume {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
    dimensions?: { height?: string; width?: string; thickness?: string };
  };
}

function withKey(url: string) {
  return KEY ? `${url}&key=${KEY}` : url;
}

async function firstVolume(query: string, signal?: AbortSignal): Promise<GBVolume | null> {
  try {
    const res = await fetch(withKey(`${BASE}?q=${encodeURIComponent(query)}&maxResults=1`), { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: GBVolume[] };
    const hit = data.items?.[0];
    if (!hit) return null;
    // The list endpoint omits dimensions; the volume endpoint sometimes has them.
    const full = await fetch(withKey(`${BASE}/${hit.id}?projection=full`), { signal }).catch(() => null);
    return full?.ok ? ((await full.json()) as GBVolume) : hit;
  } catch {
    return null;
  }
}

function toDraft(v: GBVolume): BookDraft {
  const info = v.volumeInfo;
  const ids = info.industryIdentifiers ?? [];
  return {
    ...emptyDraft(),
    source: 'googlebooks',
    title: info.title ?? '',
    subtitle: info.subtitle ?? null,
    authors: info.authors ?? [],
    genres: mapGenres(info.categories ?? []),
    pageCount: info.pageCount || null,
    publishedYear: parseYear(info.publishedDate),
    publisher: info.publisher ?? null,
    coverUrl: info.imageLinks?.thumbnail?.replace('http://', 'https://') ?? null,
    heightMm: parseHeightMm(info.dimensions?.height),
    isbn13: cleanIsbn(ids.find((i) => i.type === 'ISBN_13')?.identifier),
    isbn10: cleanIsbn(ids.find((i) => i.type === 'ISBN_10')?.identifier),
  };
}

export async function lookupGoogleIsbn(isbn: string, signal?: AbortSignal): Promise<BookDraft | null> {
  const v = await firstVolume(`isbn:${isbn}`, signal);
  return v ? toDraft(v) : null;
}

export async function lookupGoogleTitle(title: string, author: string | undefined, signal?: AbortSignal): Promise<BookDraft | null> {
  const q = `intitle:${title}${author ? ` inauthor:${author}` : ''}`;
  const v = await firstVolume(q, signal);
  return v ? toDraft(v) : null;
}
