import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { splitBook } from '../../shared/books';
import { change, testApi } from './helpers';

async function twoPeople() {
  const api = testApi();
  const ann = await api.signUp('ann');
  const bob = await api.signUp('Bob');
  return { ...api, ann, bob };
}

describe('friend requests', () => {
  it('go pending → accepted, and show up on both sides', async () => {
    const { call, ann, bob } = await twoPeople();
    expect((await call('POST', '/api/friends/requests', { username: 'BOB' }, { token: ann.token })).body.status).toBe('requested');
    const annList = (await call('GET', '/api/friends', undefined, { token: ann.token })).body;
    expect(annList.outgoing).toMatchObject([{ username: 'Bob' }]);
    const bobList = (await call('GET', '/api/friends', undefined, { token: bob.token })).body;
    expect(bobList.incoming).toMatchObject([{ username: 'ann' }]);
    expect((await call('POST', `/api/friends/requests/${bobList.incoming[0].requestId}/accept`, {}, { token: bob.token })).body.status).toBe('friends');
    expect((await call('GET', '/api/friends', undefined, { token: ann.token })).body).toMatchObject({ friends: [{ username: 'Bob', shelfVisible: true }], incoming: [], outgoing: [] });
  });

  it('can only be accepted by the person asked', async () => {
    const { call, ann } = await twoPeople();
    await call('POST', '/api/friends/requests', { username: 'bob' }, { token: ann.token });
    const id = (await call('GET', '/api/friends', undefined, { token: ann.token })).body.outgoing[0].requestId;
    expect((await call('POST', `/api/friends/requests/${id}/accept`, {}, { token: ann.token })).status).toBe(404);
  });

  it('become friends at once when both ask', async () => {
    const { call, ann, bob } = await twoPeople();
    await call('POST', '/api/friends/requests', { username: 'bob' }, { token: ann.token });
    expect((await call('POST', '/api/friends/requests', { username: 'ann' }, { token: bob.token })).body.status).toBe('friends');
  });

  it('can be declined, and asked again later', async () => {
    const { call, ann, bob } = await twoPeople();
    await call('POST', '/api/friends/requests', { username: 'bob' }, { token: ann.token });
    const id = (await call('GET', '/api/friends', undefined, { token: bob.token })).body.incoming[0].requestId;
    await call('POST', `/api/friends/requests/${id}/decline`, {}, { token: bob.token });
    expect((await call('GET', '/api/friends', undefined, { token: ann.token })).body.outgoing).toEqual([]);
    expect((await call('POST', '/api/friends/requests', { username: 'bob' }, { token: ann.token })).body.status).toBe('requested');
  });

  it('need an exact username, and not your own', async () => {
    const { call, ann } = await twoPeople();
    expect((await call('POST', '/api/friends/requests', { username: 'bo' }, { token: ann.token })).status).toBe(404);
    expect((await call('POST', '/api/friends/requests', { username: 'Ann' }, { token: ann.token })).status).toBe(400);
  });

  it('are limited to 30 a day', async () => {
    const { call, ann } = await twoPeople();
    for (let i = 0; i < 30; i++) await call('POST', '/api/friends/requests', { username: 'nobody' }, { token: ann.token });
    expect((await call('POST', '/api/friends/requests', { username: 'bob' }, { token: ann.token })).status).toBe(429);
  });
});

describe('a friend’s shelf', () => {
  async function friends() {
    const api = await twoPeople();
    await api.call('POST', '/api/friends/requests', { username: 'bob' }, { token: api.ann.token });
    await api.call('POST', '/api/friends/requests', { username: 'ann' }, { token: api.bob.token });
    const book = change({ title: 'Bob’s book', notes: 'my secret note' });
    Object.assign(book.book!, { status: 'read', rating: 2, dateStarted: '2026-03-01', dateFinished: '2026-03-20' });
    await api.call('POST', '/api/sync', { since: 0, changes: [book, { ...change(), deletedAt: 5, updatedAt: 5, book: null }] }, { token: api.bob.token });
    return api;
  }

  it('shows their books with ratings and reading dates, never notes, and not deleted ones', async () => {
    const { call, ann, bob } = await friends();
    const res = await call('GET', `/api/friends/${bob.id}/books`, undefined, { token: ann.token });
    expect(res.body.friend).toMatchObject({ username: 'Bob', shelfVisible: true });
    expect(res.body.books).toHaveLength(1);
    expect(res.body.books[0]).toMatchObject({ title: 'Bob’s book', status: 'read', owned: true, rating: 2, dateStarted: '2026-03-01', dateFinished: '2026-03-20' });
    expect(res.body.books[0]).not.toHaveProperty('notes');
    expect(res.body.books[0]).not.toHaveProperty('dateAdded');
  });

  it('shows ratings and reading dates of books synced before friends could see them, once migrated', async () => {
    const { call, ann, bob, db } = await friends();
    // A book stored the way it was before: rating and dates kept with the notes, out of what friends are sent.
    const { book } = change({ title: 'Older book', notes: 'still secret' });
    Object.assign(book!, { status: 'read', rating: 4.5, dateStarted: '2025-01-02', dateFinished: '2025-02-03' });
    const { shared, personal } = splitBook(book!);
    const { rating, dateStarted, dateFinished, ...before } = shared;
    db.raw
      .prepare('INSERT INTO books (user_id, id, data, private_data, updated_at, deleted_at, seq) VALUES (?, ?, ?, ?, 1000, NULL, 10)')
      .run(bob.id, 'old-book', JSON.stringify(before), JSON.stringify({ ...personal, rating, dateStarted, dateFinished }));
    db.raw.exec(readFileSync(join(__dirname, '..', '..', 'migrations', '0003_friends_see_ratings.sql'), 'utf8'));

    const shelf = (await call('GET', `/api/friends/${bob.id}/books`, undefined, { token: ann.token })).body.books;
    const older = shelf.find((b: { title: string }) => b.title === 'Older book');
    expect(older).toMatchObject({ rating: 4.5, dateStarted: '2025-01-02', dateFinished: '2025-02-03' });
    expect(older).not.toHaveProperty('notes');
    // Books already stored the new way are left alone.
    expect(shelf.find((b: { title: string }) => b.title === 'Bob’s book')).toMatchObject({ rating: 2, dateFinished: '2026-03-20' });
    // Bob's own devices still get the whole book back, notes and all.
    const own = (await call('POST', '/api/sync', { since: 0, changes: [] }, { token: bob.token })).body.changes.find((c: { id: string }) => c.id === 'old-book');
    expect(own.book).toEqual(book);
  });

  it('is empty when they hide it', async () => {
    const { call, ann, bob } = await friends();
    await call('PATCH', '/api/account', { shelfVisible: false }, { token: bob.token });
    const res = await call('GET', `/api/friends/${bob.id}/books`, undefined, { token: ann.token });
    expect(res.body).toMatchObject({ friend: { shelfVisible: false }, books: [] });
  });

  it('is only for accepted friends', async () => {
    const { call, bob, signUp } = await friends();
    const eve = await signUp('eve');
    expect((await call('GET', `/api/friends/${bob.id}/books`, undefined, { token: eve.token })).status).toBe(404);
    await call('POST', '/api/friends/requests', { username: 'bob' }, { token: eve.token });
    expect((await call('GET', `/api/friends/${bob.id}/books`, undefined, { token: eve.token })).status).toBe(404);
  });

  it('goes when either removes the other', async () => {
    const { call, ann, bob } = await friends();
    await call('DELETE', `/api/friends/${ann.id}`, undefined, { token: bob.token });
    expect((await call('GET', `/api/friends/${bob.id}/books`, undefined, { token: ann.token })).status).toBe(404);
    expect((await call('GET', '/api/friends', undefined, { token: ann.token })).body.friends).toEqual([]);
  });
});

describe('your data', () => {
  it('exports everything the account holds as JSON', async () => {
    const { call, ann } = await twoPeople();
    await call('POST', '/api/sync', { since: 0, changes: [change({ title: 'Mine', notes: 'note' })] }, { token: ann.token });
    await call('POST', '/api/friends/requests', { username: 'bob' }, { token: ann.token });
    const res = await call('GET', '/api/account/export', undefined, { token: ann.token });
    expect(res.body).toMatchObject({ app: 'bookie', account: { username: 'ann' }, signIn: { password: {} }, books: [{ title: 'Mine', notes: 'note' }], friends: [{ username: 'Bob', status: 'pending', askedByYou: true }] });
    expect(JSON.stringify(res.body)).not.toMatch(/hash|salt|refresh/);
  });

  it('deletes the account and every row about it at once', async () => {
    const { call, ann, bob, db } = await twoPeople();
    await call('POST', '/api/sync', { since: 0, changes: [change()] }, { token: ann.token });
    await call('POST', '/api/friends/requests', { username: 'bob' }, { token: ann.token });
    await call('POST', '/api/auth/passkey/signup/options', { username: 'ann2' }, { client: 'web' });
    expect((await call('DELETE', '/api/account', undefined, { token: ann.token })).status).toBe(200);
    for (const [table, column] of [['users', 'id'], ['books', 'user_id'], ['password_credentials', 'user_id'], ['recovery_codes', 'user_id'], ['sessions', 'user_id'], ['passkeys', 'user_id']])
      expect(db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`).get(ann.id)!.n).toBe(0);
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM friendships').get()!.n).toBe(0);
    // The username is free again, and Bob is untouched.
    expect((await call('POST', '/api/auth/password/signup', { username: 'ann', password: 'a long password' })).status).toBe(201);
    expect((await call('GET', '/api/account', undefined, { token: bob.token })).status).toBe(200);
    expect((await call('GET', '/api/account', undefined, { token: ann.token })).status).toBe(401);
  });
});
