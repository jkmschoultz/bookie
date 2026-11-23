import { makeBook } from '@/test/makeBook';
import { nodeSqlite } from '@/test/nodeSqlite';
import type { NewBook } from '@/types';
import type { SyncBook } from '@shared/books';

import * as repo from '../books';
import { migrate, MIGRATIONS } from '../migrations';

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

const rows = (db: ReturnType<typeof nodeSqlite>) => db.getAllAsync<{ title: string; uid: string; updated_at: number; dirty: number; deleted_at: number | null; cover_url: string | null }>('SELECT * FROM books ORDER BY id');

describe('the sync migration', () => {
  it('gives books already on the device an id of their own and a time', async () => {
    // A library from before accounts: the first two migrations, and a couple of books.
    const db = nodeSqlite();
    for (const sql of MIGRATIONS.slice(0, 2)) await db.execAsync(sql);
    await db.execAsync('PRAGMA user_version = 2');
    await db.runAsync("INSERT INTO books (title, date_added) VALUES ('A', '2024-01-01'), ('B', '2024-01-01')");
    await migrate(db);
    const [a, b] = await rows(db);
    expect(a.uid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a.uid).not.toBe(b.uid);
    expect(Math.abs(a.updated_at - Date.now())).toBeLessThan(60_000);
    expect(a.dirty).toBe(1);
    expect((await repo.getAllBooks(db)).map((x) => x.title)).toEqual(['A', 'B']);
  });
});

describe('changes on this device', () => {
  it('are stamped and marked to send; deleting keeps a hidden tombstone', async () => {
    const db = await library();
    const book = await repo.insertBook(db, newBook({ title: 'Dune' }));
    await repo.markSent(db, await repo.pendingChanges(db, 10));
    const before = (await rows(db))[0];
    await repo.updateBook(db, book.id, { title: 'Dune Messiah' });
    const after = (await rows(db))[0];
    expect(after.dirty).toBe(1);
    expect(after.updated_at).toBeGreaterThan(before.updated_at);
    await repo.deleteBook(db, book.id);
    expect(await repo.getAllBooks(db)).toEqual([]);
    expect(await repo.pendingChanges(db, 10)).toEqual([{ id: after.uid, updatedAt: expect.any(Number), deletedAt: expect.any(Number), book: null }]);
  });

  it('never include sample books, and leave cover photos out', async () => {
    const db = await library();
    await repo.insertBook(db, newBook({ title: 'Sample', source: 'sample' }));
    await repo.insertBook(db, newBook({ title: 'Photo', coverUrl: 'file:///covers/1.jpg' }));
    const pending = await repo.pendingChanges(db, 10);
    expect(pending.map((c) => c.book!.title)).toEqual(['Photo']);
    expect(pending[0].book!.coverUrl).toBeNull();
  });

  it('stay marked to send when the book changed again while they were being sent', async () => {
    const db = await library();
    const book = await repo.insertBook(db, newBook());
    const sent = await repo.pendingChanges(db, 10);
    await repo.updateBook(db, book.id, { title: 'Changed meanwhile' });
    await repo.markSent(db, sent);
    expect((await rows(db))[0].dirty).toBe(1);
  });
});

describe('applyRemote (changes from the account)', () => {
  const remote = (id: string, updatedAt: number, overrides: Partial<NewBook> = {}): SyncBook => ({ id, updatedAt, deletedAt: null, book: newBook(overrides) });

  it('adds books from other devices to this library, merged with what is here', async () => {
    const db = await library();
    await repo.insertBook(db, newBook({ title: 'Mine' }));
    expect(await repo.applyRemote(db, [remote('00000000-0000-4000-8000-000000000001', 5, { title: 'From the phone' })])).toBe(1);
    expect((await repo.getAllBooks(db)).map((b) => b.title).sort()).toEqual(['From the phone', 'Mine']);
    // Taken in as already sent.
    expect((await repo.pendingChanges(db, 10)).map((c) => c.book!.title)).toEqual(['Mine']);
  });

  it('takes a newer version, and keeps a newer edit made here', async () => {
    const db = await library();
    await repo.insertBook(db, newBook({ title: 'Here' }));
    const [{ uid, updated_at }] = await rows(db);
    expect(await repo.applyRemote(db, [remote(uid, updated_at - 1, { title: 'Older' })])).toBe(0);
    expect((await repo.getAllBooks(db))[0].title).toBe('Here');
    expect((await rows(db))[0].dirty).toBe(1);
    expect(await repo.applyRemote(db, [remote(uid, updated_at + 1, { title: 'Newer' })])).toBe(1);
    expect((await repo.getAllBooks(db))[0].title).toBe('Newer');
    expect((await rows(db))[0].dirty).toBe(0);
  });

  it('treats the same version coming back as sent', async () => {
    const db = await library();
    await repo.insertBook(db, newBook());
    const [{ uid, updated_at }] = await rows(db);
    await repo.applyRemote(db, [remote(uid, updated_at)]);
    expect((await rows(db))[0].dirty).toBe(0);
  });

  it('removes a book deleted on another device', async () => {
    const db = await library();
    await repo.insertBook(db, newBook());
    const [{ uid, updated_at }] = await rows(db);
    await repo.applyRemote(db, [{ id: uid, updatedAt: updated_at + 1, deletedAt: updated_at + 1, book: null }]);
    expect(await rows(db)).toEqual([]);
  });

  it('keeps a cover photo taken here when the other device sends the book without one', async () => {
    const db = await library();
    await repo.insertBook(db, newBook({ coverUrl: 'data:image/jpeg;base64,AAAA' }));
    const [{ uid, updated_at }] = await rows(db);
    await repo.applyRemote(db, [remote(uid, updated_at + 1, { title: 'Renamed', coverUrl: null })]);
    expect(await repo.getAllBooks(db)).toMatchObject([{ title: 'Renamed', coverUrl: 'data:image/jpeg;base64,AAAA' }]);
  });
});

describe('switching accounts', () => {
  it('counts the books that would sync, not samples or deleted ones', async () => {
    const db = await library();
    await repo.insertBook(db, newBook({ title: 'Mine' }));
    await repo.insertBook(db, newBook({ title: 'Sample', source: 'sample' }));
    const gone = await repo.insertBook(db, newBook({ title: 'Gone' }));
    await repo.deleteBook(db, gone.id);
    expect(await repo.countSyncable(db)).toBe(1);
  });

  it('clears the whole library, tombstones too, to take in an account’s instead', async () => {
    const db = await library();
    const a = await repo.insertBook(db, newBook());
    await repo.insertBook(db, newBook());
    await repo.deleteBook(db, a.id);
    await repo.clearLibrary(db);
    expect(await rows(db)).toEqual([]);
    expect(await repo.pendingChanges(db, 10)).toEqual([]);
  });
});

describe('purgeTombstones', () => {
  it('clears sent tombstones, or all of them without an account', async () => {
    const db = await library();
    const a = await repo.insertBook(db, newBook({ title: 'A' }));
    const b = await repo.insertBook(db, newBook({ title: 'B' }));
    await repo.deleteBooks(db, [a.id, b.id]);
    await repo.markSent(db, (await repo.pendingChanges(db, 10)).slice(0, 1));
    await repo.purgeTombstones(db, false);
    expect(await rows(db)).toHaveLength(1);
    await repo.purgeTombstones(db, true);
    expect(await rows(db)).toHaveLength(0);
  });
});
