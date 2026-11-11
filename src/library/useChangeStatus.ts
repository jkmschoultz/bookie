import { useCallback } from 'react';

import { alert } from '@/components/alert';
import type { Book, ReadStatus } from '@/types';

import { useLibrary } from './LibraryProvider';
import { asksAboutOwnership } from './status';

/**
 * Changes a book's status. When that takes a book you don't own out of "Want to read", also asks whether it's on
 * your shelf now (either answer is fine, and it can be changed any time). `done` runs once that's settled,
 * so a sheet showing the question can stay open until it's answered.
 */
export function useChangeStatus() {
  const { setStatus, updateBook } = useLibrary();
  return useCallback(
    async (book: Book, status: ReadStatus, done?: () => void) => {
      await setStatus(book.id, status);
      if (!asksAboutOwnership(book, status)) {
        done?.();
        return;
      }
      alert('Do you own this book now?', `“${book.title}” is marked as not owned. Is it on your shelf now?`, [
        { text: 'Not owned', style: 'cancel', onPress: () => done?.() },
        {
          text: 'On my shelf',
          onPress: async () => {
            await updateBook(book.id, { owned: true });
            done?.();
          },
        },
      ]);
    },
    [setStatus, updateBook],
  );
}
