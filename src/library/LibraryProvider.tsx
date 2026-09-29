import { Directory, Paths } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as repo from '@/db/books';
import { today, type Book, type NewBook, type ReadStatus } from '@/types';

interface Library {
  books: Book[];
  loaded: boolean;
  getBook: (id: number) => Book | undefined;
  addBook: (book: NewBook) => Promise<Book>;
  addBooks: (books: NewBook[]) => Promise<Book[]>;
  updateBook: (id: number, patch: Partial<NewBook>) => Promise<void>;
  setStatus: (id: number, status: ReadStatus) => Promise<void>;
  removeBook: (id: number) => Promise<void>;
  /** Delete every book and any saved cover photos. */
  eraseLibrary: () => Promise<void>;
  findByIsbn: (isbn13: string) => Book | undefined;
}

const LibraryContext = createContext<Library | null>(null);

/** Date bookkeeping when a book changes status (e.g. finishing sets dateFinished). */
export function statusPatch(book: Book, status: ReadStatus): Partial<NewBook> {
  const patch: Partial<NewBook> = { status };
  if (status === 'reading' && !book.dateStarted) patch.dateStarted = today();
  if (status === 'read') {
    patch.dateFinished = book.dateFinished ?? today();
    patch.owned = book.owned || book.status !== 'want';
  }
  if (status === 'reading' || status === 'want' || status === 'owned') patch.dateFinished = null;
  return patch;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [books, setBooks] = useState<Book[]>([]);
  const [loaded, setLoaded] = useState(false);

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

  const eraseLibrary = useCallback(async () => {
    await repo.deleteAllBooks(db);
    const covers = new Directory(Paths.document, 'covers');
    if (covers.exists) covers.delete();
    setBooks([]);
  }, [db]);

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
      eraseLibrary,
      setStatus: async (id, status) => {
        const book = byId.get(id);
        if (book) await updateBook(id, statusPatch(book, status));
      },
    };
  }, [books, loaded, addBook, addBooks, updateBook, removeBook, eraseLibrary]);

  return <LibraryContext value={value}>{children}</LibraryContext>;
}

export function useLibrary(): Library {
  const ctx = use(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return ctx;
}
