import { useEffect, useRef, type RefObject } from 'react';

import { coverColors } from '@/services/coverColors';
import type { Book, NewBook } from '@/types';

const CONCURRENCY = 3;

/**
 * Works out spine colours from covers in the background, for any book that has a cover but no palette yet:
 * newly added or imported books, books whose cover changed, and libraries from before this existed.
 */
export function useCoverPalettes(
  books: Book[],
  latest: RefObject<Book[]>,
  updateBook: (id: number, patch: Partial<NewBook>) => Promise<void>,
) {
  const state = useRef({ waiting: [] as number[], queued: new Set<number>(), running: 0, failed: new Set<string>() });

  useEffect(() => {
    const q = state.current;
    const pump = () => {
      while (q.running < CONCURRENCY && q.waiting.length) {
        const id = q.waiting.shift()!;
        const url = latest.current.find((b) => b.id === id)?.coverUrl;
        if (!url) {
          q.queued.delete(id);
          continue;
        }
        q.running++;
        coverColors(url)
          .then(async (colors) => {
            // Skip if the cover changed (or the book went) while this one was being worked out.
            if (latest.current.find((b) => b.id === id)?.coverUrl === url) await updateBook(id, { coverPalette: colors });
          })
          // Probably offline: leave it for the next launch rather than retrying on every change.
          .catch(() => q.failed.add(url))
          .finally(() => {
            q.running--;
            q.queued.delete(id);
            pump();
          });
      }
    };

    for (const b of books) {
      if (b.coverUrl && b.coverPalette == null && !q.queued.has(b.id) && !q.failed.has(b.coverUrl)) {
        q.queued.add(b.id);
        q.waiting.push(b.id);
      }
    }
    pump();
  }, [books, latest, updateBook]);
}
