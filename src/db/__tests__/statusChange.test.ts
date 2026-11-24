import { makeBook } from '@/test/makeBook';
import { nodeSqlite } from '@/test/nodeSqlite';
import type { NewBook } from '@/types';
import { splitBook } from '@shared/books';

import * as repo from '../books';
import { migrate } from '../migrations';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID() }));

const newBook = (overrides: Partial<NewBook> = {}): NewBook => {
  const { id, ...book } = makeBook(overrides);
  return book;
};

async function library() {
  const db = nodeSqlite();
  await migrate(db);
  return db;
}

describe('when a status changed', () => {
  it('is stamped with the time, but only when the status really changes', async () => {
    const db = await library();
    const book = await repo.insertBook(db, newBook({ title: 'Dune', status: 'owned' }));
    expect(book.statusChangedAt).toBeNull();

    await repo.updateBook(db, book.id, { status: 'reading', dateStarted: '2024-06-01' });
    const started = (await repo.getAllBooks(db))[0].statusChangedAt;
    expect(started).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Math.abs(Date.parse(started!) - Date.now())).toBeLessThan(60_000);

    // Same status again, e.g. editing the title: the stamp stays put.
    await repo.updateBook(db, book.id, { status: 'reading', title: 'Dune Messiah' });
    expect((await repo.getAllBooks(db))[0].statusChangedAt).toBe(started);
  });

  it('keeps a time the caller gives, such as one arriving from sync', async () => {
    const db = await library();
    const book = await repo.insertBook(db, newBook({ status: 'owned' }));
    await repo.updateBook(db, book.id, { status: 'read', statusChangedAt: '2024-02-03T04:05:06.000Z' });
    expect((await repo.getAllBooks(db))[0].statusChangedAt).toBe('2024-02-03T04:05:06.000Z');
  });

  it('travels with the account, and is kept private from friends', async () => {
    const db = await library();
    const book = await repo.insertBook(db, newBook({ status: 'owned' }));
    await repo.updateBook(db, book.id, { status: 'read' });
    const [sent] = await repo.pendingChanges(db, 10);
    expect(sent.book?.statusChangedAt).toEqual(expect.any(String));
    expect(splitBook(sent.book!).personal.statusChangedAt).toEqual(sent.book!.statusChangedAt);
    expect(splitBook(sent.book!).shared).not.toHaveProperty('statusChangedAt');
  });
});
