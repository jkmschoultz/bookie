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

  it('returns the changes it saved, stamp included, so the shelf in memory can match', async () => {
    const db = await library();
    const book = await repo.insertBook(db, newBook({ status: 'owned' }));
    const saved = await repo.updateBook(db, book.id, { status: 'read' });
    expect(saved).toEqual({ status: 'read', statusChangedAt: expect.any(String) });
    expect(saved.statusChangedAt).toBe((await repo.getAllBooks(db))[0].statusChangedAt);
  });

  it('keeps a time the caller gives, such as one arriving from sync', async () => {
    const db = await library();
    const book = await repo.insertBook(db, newBook({ status: 'owned' }));
    await repo.updateBook(db, book.id, { status: 'read', statusChangedAt: '2024-02-03T04:05:06.000Z' });
    expect((await repo.getAllBooks(db))[0].statusChangedAt).toBe('2024-02-03T04:05:06.000Z');
  });

  it('is set by an edit that changes the status, when the edit leaves the old stamp out', async () => {
    const db = await library();
    const book = await repo.insertBook(db, newBook({ status: 'reading', statusChangedAt: '2020-01-01T00:00:00.000Z' }));
    const { statusChangedAt: _old, ...rest } = (await repo.getAllBooks(db))[0];
    await repo.updateBook(db, book.id, { ...rest, status: 'read' });
    const stamp = (await repo.getAllBooks(db))[0].statusChangedAt;
    expect(stamp).not.toBe('2020-01-01T00:00:00.000Z');
    expect(Math.abs(Date.parse(stamp!) - Date.now())).toBeLessThan(60_000);
  });

  it('keeps the stored stamp on an edit that leaves the status alone, even one that sends the whole book', async () => {
    const db = await library();
    const book = await repo.insertBook(db, newBook({ status: 'reading', statusChangedAt: '2020-01-01T00:00:00.000Z' }));
    const stored = (await repo.getAllBooks(db))[0];
    await repo.updateBook(db, book.id, { ...stored, title: 'Dune Messiah' });
    const after = (await repo.getAllBooks(db))[0];
    expect(after.title).toBe('Dune Messiah');
    expect(after.statusChangedAt).toBe('2020-01-01T00:00:00.000Z');
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
