import { coverUrl } from './openLibrary';

const BASE = 'https://openlibrary.org';
export const MAX_COVER_OPTIONS = 12;

interface Edition {
  covers?: number[];
}

/** Distinct cover ids, in order, with the ones Open Library uses for "no cover" (-1 and 0) left out. */
export function distinctCoverIds(ids: (number | null | undefined)[], max = MAX_COVER_OPTIONS): number[] {
  const seen = new Set<number>();
  for (const id of ids) {
    if (id && id > 0) seen.add(id);
    if (seen.size >= max) break;
  }
  return [...seen];
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  return res.ok ? ((await res.json()) as T) : null;
}

/**
 * Cover images Open Library has for a book: the work's own cover, then each edition's (paperbacks, translations,
 * reissues). Finds the work from its key when known (a search result), else from the ISBN or title and author.
 * Resolves to [] when nothing turns up or the network fails.
 */
export async function findCoverOptions(
  book: { workKey?: string | null; isbn?: string | null; title: string; author?: string | null },
  signal?: AbortSignal,
): Promise<string[]> {
  try {
    let workKey = book.workKey ?? null;
    let workCover: number | undefined;
    if (!workKey) {
      const query = book.isbn
        ? `q=isbn:${encodeURIComponent(book.isbn)}`
        : `title=${encodeURIComponent(book.title)}${book.author ? `&author=${encodeURIComponent(book.author)}` : ''}`;
      if (!book.isbn && !book.title.trim()) return [];
      const found = await getJson<{ docs: { key: string; cover_i?: number }[] }>(`${BASE}/search.json?${query}&fields=key,cover_i&limit=1`, signal);
      workKey = found?.docs?.[0]?.key ?? null;
      workCover = found?.docs?.[0]?.cover_i;
    }
    if (!workKey || !/^\/works\/OL\d+W$/.test(workKey)) return [];
    const editions = await getJson<{ entries?: Edition[] }>(`${BASE}${workKey}/editions.json?limit=100`, signal);
    const ids = distinctCoverIds([workCover, ...(editions?.entries ?? []).flatMap((e) => e.covers ?? [])]);
    return ids.map((id) => coverUrl(id)).filter((u): u is string => !!u);
  } catch {
    return [];
  }
}
