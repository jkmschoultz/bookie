import type { BookDraft } from '@/types';

import { lookupGoogleIsbn, lookupGoogleTitle } from './googleBooks';
import { cleanIsbn, isbn10to13, mergeDrafts } from './normalize';
import { draftFromSearchDoc, lookupOpenLibraryIsbn, searchOpenLibrary, type OLSearchDoc } from './openLibrary';

export { draftFromSearchDoc, searchOpenLibrary, type OLSearchDoc };

/** Full metadata for an ISBN: Open Library first, gaps filled from Google Books. */
export async function lookupIsbn(rawIsbn: string, signal?: AbortSignal): Promise<BookDraft | null> {
  const isbn = cleanIsbn(rawIsbn);
  if (!isbn) return null;
  const isbn13 = isbn.length === 10 ? isbn10to13(isbn) : isbn;
  const ol = await lookupOpenLibraryIsbn(isbn13, signal).catch(() => null);
  if (ol && ol.pageCount && ol.genres.length && ol.heightMm) return ol;
  const gb = await lookupGoogleIsbn(isbn13, signal);
  if (!ol) return gb;
  return mergeDrafts(ol, gb);
}

/** Turn a search result into a full draft, filling gaps from an ISBN or title lookup. */
export async function completeSearchResult(doc: OLSearchDoc, signal?: AbortSignal): Promise<BookDraft> {
  const base = draftFromSearchDoc(doc);
  if (base.isbn13) {
    const detailed = await lookupIsbn(base.isbn13, signal).catch(() => null);
    // Keep the work-level title/authors from the search result; take edition details from the lookup.
    return mergeDrafts(base, detailed);
  }
  if (base.pageCount && base.genres.length) return base;
  return mergeDrafts(base, await lookupGoogleTitle(base.title, base.authors[0], signal));
}

/** Best-effort enrichment for imported books (missing covers, genres, page counts). */
export async function enrichDraft(draft: BookDraft, signal?: AbortSignal): Promise<BookDraft> {
  const isbn = draft.isbn13 ?? draft.isbn10;
  if (isbn) return mergeDrafts(draft, await lookupIsbn(isbn, signal).catch(() => null));
  const docs = await searchOpenLibrary(`${draft.title} ${draft.authors[0] ?? ''}`, signal).catch(() => []);
  return docs[0] ? mergeDrafts(draft, draftFromSearchDoc(docs[0])) : draft;
}
