import { useState } from 'react';

import { useLibrary } from '@/library/LibraryProvider';
import { looksLikeGoodreadsExport, parseGoodreadsCsv } from '@/services/import/goodreadsCsv';
import { enrichDraft } from '@/services/metadata/lookup';
import type { Book, BookDraft, NewBook } from '@/types';

export type ImportPhase =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'enriching'; added: number; duplicates: number; done: number; total: number }
  | { kind: 'done'; added: number; duplicates: number }
  | { kind: 'error'; message: string };

const CONCURRENCY = 3;
const ENRICHED_FIELDS = ['coverUrl', 'genres', 'pageCount', 'heightMm', 'publishedYear', 'isbn13', 'subtitle'] as const;

/** Only the fields that were empty and are now filled in. */
function enrichmentPatch(before: Book, after: BookDraft): Partial<NewBook> {
  const patch: Partial<NewBook> = {};
  for (const key of ENRICHED_FIELDS) {
    const was = before[key];
    const empty = was == null || (Array.isArray(was) && was.length === 0);
    if (empty && after[key] != null) (patch as Record<string, unknown>)[key] = after[key];
  }
  return patch;
}

const identity = (b: { isbn13: string | null; title: string; authors: string[] }) =>
  b.isbn13 ?? `${b.title}|${b.authors[0]}`.toLowerCase();

/** Import a Goodreads CSV export, then fill in covers, genres and sizes in the background. */
export function useGoodreadsImport() {
  const { books, addBooks, updateBook } = useLibrary();
  const [phase, setPhase] = useState<ImportPhase>({ kind: 'idle' });

  const importCsv = async (csv: string) => {
    setPhase({ kind: 'reading' });
    try {
      if (!looksLikeGoodreadsExport(csv)) {
        setPhase({ kind: 'error', message: "That doesn't look like a Goodreads export." });
        return;
      }
      const { books: parsed } = parseGoodreadsCsv(csv);
      const known = new Set(books.map(identity));
      const fresh = parsed.filter((b) => !known.has(identity(b)));
      const duplicates = parsed.length - fresh.length;
      const saved = await addBooks(fresh);

      // The shelf updates as each book's details arrive.
      let done = 0;
      setPhase({ kind: 'enriching', added: saved.length, duplicates, done, total: saved.length });
      const queue = [...saved];
      const worker = async () => {
        for (let book = queue.shift(); book; book = queue.shift()) {
          const enriched = await enrichDraft(book).catch(() => book);
          const patch = enrichmentPatch(book, enriched);
          if (Object.keys(patch).length) await updateBook(book.id, patch);
          done++;
          setPhase({ kind: 'enriching', added: saved.length, duplicates, done, total: saved.length });
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      setPhase({ kind: 'done', added: saved.length, duplicates });
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : 'Import failed.' });
    }
  };

  return {
    phase,
    importCsv,
    setReading: () => setPhase({ kind: 'reading' }),
    fail: (message: string) => setPhase({ kind: 'error', message }),
  };
}
