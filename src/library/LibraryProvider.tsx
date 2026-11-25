import { useSQLiteContext } from 'expo-sqlite';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { notifyLocalChange } from '@/account/localChanges';
import * as repo from '@/db/books';
import { deleteCoverPhotos } from '@/services/files';
import type { Book, NewBook, ReadStatus } from '@/types';

import type { DuplicateMerge } from './duplicates';
import { applyChanges } from './mergeBooks';
import { statusPatch } from './status';
import { useCoverPalettes } from './useCoverPalettes';

interface Library {
  books: Book[];
  loaded: boolean;
  getBook: (id: number) => Book | undefined;
  addBook: (book: NewBook) => Promise<Book>;
  addBooks: (books: NewBook[]) => Promise<Book[]>;
  updateBook: (id: number, patch: Partial<NewBook>) => Promise<void>;
  setStatus: (id: number, status: ReadStatus) => Promise<void>;
  removeBook: (id: number) => Promise<void>;
  /** Merge each set of duplicate books into one. Returns how many books were removed. */
  mergeDuplicates: (merges: DuplicateMerge[]) => Promise<number>;
  /** Delete every book and any saved cover photos. */
  eraseLibrary: () => Promise<void>;
  findByIsbn: (isbn13: string) => Book | undefined;
  /** Read the library again, after sync changed it. */
  reload: () => Promise<void>;
}

const LibraryContext = createContext<Library | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [books, setBooks] = useState<Book[]>([]);
  const [loaded, setLoaded] = useState(false);
  const latest = useRef(books);
  useEffect(() => {
    latest.current = books;
  }, [books]);

  const reload = useCallback(async () => {
    setBooks(await repo.getAllBooks(db));
  }, [db]);

  useEffect(() => {
    repo.getAllBooks(db).then((all) => {
      setBooks(all);
      setLoaded(true);
    });
  }, [db]);

  const addBook = useCallback(
    async (book: NewBook) => {
      const saved = await repo.insertBook(db, book);
      setBooks((prev) => [...prev, saved]);
      notifyLocalChange();
      return saved;
    },
    [db],
  );

  const addBooks = useCallback(
    async (list: NewBook[]) => {
      const saved = await repo.insertBooks(db, list);
      setBooks((prev) => [...prev, ...saved]);
      notifyLocalChange();
      return saved;
    },
    [db],
  );

  const updateBook = useCallback(
    async (id: number, patch: Partial<NewBook>) => {
      // A new cover means new spine colours: clear them so they're worked out again.
      const current = latest.current.find((b) => b.id === id);
      if (current && patch.coverUrl !== undefined && patch.coverUrl !== current.coverUrl) patch = { ...patch, coverPalette: null };
      const saved = await repo.updateBook(db, id, patch);
      setBooks((prev) => applyChanges(prev, new Map([[id, saved]])));
      notifyLocalChange();
    },
    [db],
  );

  const removeBook = useCallback(
    async (id: number) => {
      await repo.deleteBook(db, id);
      setBooks((prev) => prev.filter((b) => b.id !== id));
      notifyLocalChange();
    },
    [db],
  );

  const mergeDuplicates = useCallback(
    async (merges: DuplicateMerge[]) => {
      const ids = merges.flatMap((m) => m.remove.map((b) => b.id));
      const saved = new Map<number, Partial<NewBook>>();
      await db.withTransactionAsync(async () => {
        for (const m of merges) saved.set(m.keep.id, await repo.updateBook(db, m.keep.id, m.patch));
        await repo.deleteBooks(db, ids);
      });
      setBooks((prev) => applyChanges(prev, saved, new Set(ids)));
      notifyLocalChange();
      return ids.length;
    },
    [db],
  );

  const eraseLibrary = useCallback(async () => {
    await repo.deleteAllBooks(db);
    deleteCoverPhotos();
    setBooks([]);
    notifyLocalChange();
  }, [db]);

  useCoverPalettes(books, latest, updateBook);

  const value = useMemo<Library>(() => {
    const byId = new Map(books.map((b) => [b.id, b]));
    return {
      books,
      loaded,
      getBook: (id) => byId.get(id),
      findByIsbn: (isbn13) => books.find((b) => b.isbn13 === isbn13),
      addBook,
      addBooks,
      updateBook,
      removeBook,
      mergeDuplicates,
      eraseLibrary,
      reload,
      setStatus: async (id, status) => {
        const book = byId.get(id);
        if (book) await updateBook(id, statusPatch(book, status));
      },
    };
  }, [books, loaded, addBook, addBooks, updateBook, removeBook, mergeDuplicates, eraseLibrary, reload]);

  return <LibraryContext value={value}>{children}</LibraryContext>;
}

export function useLibrary(): Library {
  const ctx = use(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return ctx;
}
