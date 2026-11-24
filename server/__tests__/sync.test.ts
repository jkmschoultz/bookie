import { change, testApi } from './helpers';

describe('POST /api/sync', () => {
  it('stores a device’s books and hands them to another device', async () => {
    const { call, signUp } = testApi();
    const { token } = await signUp('ann');
    const a = change({ title: 'Dune', notes: 'loved it' });
    const b = change({ title: 'Emma' });
    const first = await call('POST', '/api/sync', { since: 0, changes: [a, b] }, { token });
    expect(first.status).toBe(200);
    expect(first.body.cursor).toBe(2);
    // The other device starts from nothing and gets both, notes included (it's the same person).
    const other = await call('POST', '/api/sync', { since: 0 }, { token });
    expect(other.body.changes.map((c: any) => c.book.title)).toEqual(['Dune', 'Emma']);
    expect(other.body.changes[0].book.notes).toBe('loved it');
    // Nothing new after its cursor.
    expect((await call('POST', '/api/sync', { since: other.body.cursor }, { token })).body.changes).toEqual([]);
  });

  it('keeps when a status last changed, and refuses a time that isn’t one', async () => {
    const { call, signUp } = testApi();
    const { token } = await signUp('ann');
    const dune = change({ title: 'Dune' });
    const book = { ...dune, book: { ...dune.book!, statusChangedAt: '2024-08-15T10:00:00.000Z' } };
    await call('POST', '/api/sync', { since: 0, changes: [book] }, { token });
    const other = await call('POST', '/api/sync', { since: 0 }, { token });
    expect(other.body.changes[0].book.statusChangedAt).toBe('2024-08-15T10:00:00.000Z');
    const emma = change({ title: 'Emma' });
    const bad = { ...emma, book: { ...emma.book!, statusChangedAt: 'last tuesday' } };
    expect((await call('POST', '/api/sync', { since: 0, changes: [bad] }, { token })).status).toBe(400);
  });

  it('stores a time in ISO form whatever form the device sent', async () => {
    const { call, signUp } = testApi();
    const { token } = await signUp('ann');
    const dune = change({ title: 'Dune' });
    const sent = { ...dune, book: { ...dune.book!, statusChangedAt: 'Thu, 15 Aug 2024 10:00:00 GMT' } };
    await call('POST', '/api/sync', { since: 0, changes: [sent] }, { token });
    const { body } = await call('POST', '/api/sync', { since: 0 }, { token });
    expect(body.changes[0].book.statusChangedAt).toBe('2024-08-15T10:00:00.000Z');
  });

  it('keeps the newest version of a book (last writer wins), and sends it back to a device that sent an older one', async () => {
    const { call, signUp } = testApi();
    const { token } = await signUp('ann');
    const book = change({ title: 'Old title', updatedAt: 1000 });
    await call('POST', '/api/sync', { since: 0, changes: [book] }, { token });
    const newer = { ...book, updatedAt: 3000, book: { ...book.book!, title: 'New title' } };
    const { body: synced } = await call('POST', '/api/sync', { since: 1, changes: [newer] }, { token });
    // A device that last synced at cursor 2 sends an edit made earlier, offline.
    const older = { ...book, updatedAt: 2000, book: { ...book.book!, title: 'Offline edit' } };
    const res = await call('POST', '/api/sync', { since: synced.cursor, changes: [older] }, { token });
    expect(res.body.changes).toHaveLength(1);
    expect(res.body.changes[0]).toMatchObject({ id: book.id, updatedAt: 3000, book: { title: 'New title' } });
  });

  it('keeps deletions as tombstones with nothing of the book left', async () => {
    const { call, signUp, db } = testApi();
    const { token } = await signUp('ann');
    const book = change({ title: 'Gone', notes: 'my diary' });
    await call('POST', '/api/sync', { since: 0, changes: [book] }, { token });
    await call('POST', '/api/sync', { since: 1, changes: [{ id: book.id, updatedAt: 2000, deletedAt: 2000, book: null }] }, { token });
    const res = await call('POST', '/api/sync', { since: 0 }, { token });
    expect(res.body.changes).toEqual([{ id: book.id, updatedAt: 2000, deletedAt: 2000, book: null }]);
    expect(JSON.stringify(db.raw.prepare('SELECT * FROM books').all())).not.toMatch(/Gone|my diary/);
  });

  it('merges two devices’ libraries rather than replacing one with the other', async () => {
    const { call, signUp } = testApi();
    const { token } = await signUp('ann');
    await call('POST', '/api/sync', { since: 0, changes: [change({ title: 'From the phone' })] }, { token });
    const laptop = await call('POST', '/api/sync', { since: 0, changes: [change({ title: 'From the laptop' })] }, { token });
    expect(laptop.body.changes.map((c: any) => c.book.title).sort()).toEqual(['From the laptop', 'From the phone']);
  });

  it('pages through a large library', async () => {
    const { call, signUp } = testApi();
    const { token } = await signUp('ann');
    for (let i = 0; i < 3; i++) await call('POST', '/api/sync', { since: 0, changes: Array.from({ length: 200 }, () => change()) }, { token });
    const first = await call('POST', '/api/sync', { since: 0 }, { token });
    expect(first.body.changes).toHaveLength(500);
    expect(first.body.more).toBe(true);
    const rest = await call('POST', '/api/sync', { since: first.body.cursor }, { token });
    expect(rest.body.changes).toHaveLength(100);
    expect(rest.body.more).toBe(false);
  });

  it('refuses sample books, too many changes, and books that aren’t books', async () => {
    const { call, signUp } = testApi();
    const { token } = await signUp('ann');
    const sample = change();
    sample.book!.source = 'sample';
    expect((await call('POST', '/api/sync', { since: 0, changes: [sample] }, { token })).status).toBe(400);
    expect((await call('POST', '/api/sync', { since: 0, changes: Array.from({ length: 201 }, () => change()) }, { token })).status).toBe(400);
    expect((await call('POST', '/api/sync', { since: 0, changes: [{ ...change(), id: 'not-a-uuid' }] }, { token })).status).toBe(400);
    expect((await call('POST', '/api/sync', { since: 0, changes: [{ ...change(), book: { title: 42 } }] }, { token })).status).toBe(400);
  });

  it('drops cover photos (they stay on the device) and caps clocks far in the future', async () => {
    const { call, signUp } = testApi();
    const { token } = await signUp('ann');
    const c = change({ updatedAt: Date.now() + 10 * 365 * 24 * 3600 * 1000 });
    c.book!.coverUrl = 'data:image/jpeg;base64,AAAA';
    const res = await call('POST', '/api/sync', { since: 0, changes: [c] }, { token });
    expect(res.body.changes[0].book.coverUrl).toBeNull();
    expect(res.body.changes[0].updatedAt).toBeLessThan(Date.now() + 2 * 24 * 3600 * 1000);
  });

  it('keeps each user’s books apart', async () => {
    const { call, signUp } = testApi();
    const ann = await signUp('ann');
    const bob = await signUp('bob');
    const book = change({ title: 'Ann’s' });
    await call('POST', '/api/sync', { since: 0, changes: [book] }, { token: ann.token });
    expect((await call('POST', '/api/sync', { since: 0 }, { token: bob.token })).body.changes).toEqual([]);
    // Bob sending the same id makes his own copy, and doesn't touch Ann's.
    await call('POST', '/api/sync', { since: 0, changes: [{ ...book, updatedAt: 9999, book: { ...book.book!, title: 'Bob’s' } }] }, { token: bob.token });
    expect((await call('POST', '/api/sync', { since: 0 }, { token: ann.token })).body.changes[0].book.title).toBe('Ann’s');
  });
});
