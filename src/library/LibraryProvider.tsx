import { Directory, Paths } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import * as repo from '@/db/books';
import type { Book, NewBook, ReadStatus } from '@/types';

import type { DuplicateMerge } from './duplicates';
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
      return saved;
    },
    [db],
  );

  const addBooks = useCallback(
    async (list: NewBook[]) => {
      const saved = await repo.insertBooks(db, list);
      setBooks((prev) => [...prev, ...saved]);
      return saved;
    },
    [db],
  );

  const updateBook = useCallback(
    async (id: number, patch: Partial<NewBook>) => {
      // A new cover means new spine colours: clear them so they're worked out again.
      const current = latest.current.find((b) => b.id === id);
      if (current && patch.coverUrl !== undefined && patch.coverUrl !== current.coverUrl) patch = { ...patch, coverPalette: null };
      await repo.updateBook(db, id, patch);
      setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    },
    [db],
  );

  const removeBook = useCallback(
    async (id: number) => {
      await repo.deleteBook(db, id);
      setBooks((prev) => prev.filter((b) => b.id !== id));
    },
    [db],
  );

  const mergeDuplicates = useCallback(
    async (merges: DuplicateMerge[]) => {
      const ids = merges.flatMap((m) => m.remove.map((b) => b.id));
      await db.withTransactionAsync(async () => {
        for (const m of merges) await repo.updateBook(db, m.keep.id, m.patch);
        await repo.deleteBooks(db, ids);
      });
      const patches = new Map(merges.map((m) => [m.keep.id, m.patch]));
      const removed = new Set(ids);
      setBooks((prev) => prev.filter((b) => !removed.has(b.id)).map((b) => (patches.has(b.id) ? { ...b, ...patches.get(b.id) } : b)));
      return ids.length;
    },
    [db],
  );

  const eraseLibrary = useCallback(async () => {
    await repo.deleteAllBooks(db);
    // Web keeps cover photos inline in the database, so there's no folder to clear.
    if (Platform.OS !== 'web') {
      const covers = new Directory(Paths.document, 'covers');
      if (covers.exists) covers.delete();
    }
    setBooks([]);
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
      setStatus: async (id, status) => {
        const book = byId.get(id);
        if (book) await updateBook(id, statusPatch(book, status));
      },
    };
  }, [books, loaded, addBook, addBooks, updateBook, removeBook, mergeDuplicates, eraseLibrary]);

  return <LibraryContext value={value}>{children}</LibraryContext>;
}

export function useLibrary(): Library {
  const ctx = use(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return ctx;
}
