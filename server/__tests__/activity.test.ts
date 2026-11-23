import type { SyncBook } from '../../shared/books';
import { change, testApi } from './helpers';

/** Ann and Bob, friends; Bob's shelf changes and Ann sees the news. */
async function friends() {
  const api = testApi();
  const ann = await api.signUp('ann');
  const bob = await api.signUp('bob');
  await api.call('POST', '/api/friends/requests', { username: 'bob' }, { token: ann.token });
  await api.call('POST', '/api/friends/requests', { username: 'ann' }, { token: bob.token });
  const sync = (changes: SyncBook[], bulk?: boolean) => api.call('POST', '/api/sync', { since: 0, changes, ...(bulk ? { bulk } : {}) }, { token: bob.token });
  const news = async () => (await api.call('GET', `/api/friends/${bob.id}/activity`, undefined, { token: ann.token })).body;
  const unseen = async () => (await api.call('GET', '/api/friends', undefined, { token: ann.token })).body.friends[0].unseen;
  /** Ann looks at Bob's news and marks what she saw. */
  const look = async () => {
    const { seenUpTo } = await news();
    return api.call('POST', `/api/friends/${bob.id}/activity/seen`, { upTo: seenUpTo }, { token: ann.token });
  };
  return { ...api, ann, bob, sync, news, unseen, look };
}

const withStatus = (c: SyncBook, status: string, updatedAt: number): SyncBook => ({ ...c, updatedAt, book: { ...c.book!, status: status as never } });

describe('friend activity', () => {
  it('records books added, started and finished, newest first, with titles only', async () => {
    const { sync, news } = await friends();
    const dune = change({ title: 'Dune', notes: 'a secret note' });
    dune.book!.rating = 5;
    dune.book!.dateFinished = '2026-11-01';
    await sync([dune]);
    await sync([withStatus(dune, 'reading', 2000)]);
    await sync([withStatus(dune, 'read', 3000)]);
    const body = await news();
    expect(body.news.map((n: any) => [n.kind, n.title])).toEqual([
      ['finished', 'Dune'],
      ['started', 'Dune'],
      ['added', 'Dune'],
    ]);
    expect(body.unseen).toBe(3);
    // Never notes, ratings, reading dates or when it happened.
    expect(Object.keys(body.news[0]).sort()).toEqual(['count', 'kind', 'new', 'title']);
    expect(JSON.stringify(body)).not.toMatch(/secret|2026-11-01|rating/);
  });

  it('records a book added as reading as started, and nothing for other edits', async () => {
    const { sync, news } = await friends();
    const piranesi = withStatus(change({ title: 'Piranesi' }), 'reading', 1000);
    await sync([piranesi]);
    await sync([{ ...piranesi, updatedAt: 2000, book: { ...piranesi.book!, title: 'Piranesi (new edition)' } }]);
    await sync([withStatus(piranesi, 'want', 3000)]);
    expect((await news()).news.map((n: any) => n.kind)).toEqual(['started']);
  });

  it('records nothing for deletions, and a deleted book takes its news with it', async () => {
    const { sync, news } = await friends();
    const a = change({ title: 'Gone soon' });
    const b = change({ title: 'Stays' });
    await sync([a, b]);
    await sync([{ ...a, updatedAt: 5000, deletedAt: 5000, book: null }]);
    expect((await news()).news.map((n: any) => n.title)).toEqual(['Stays']);
  });

  it('records nothing for a whole library sent at sign-in (bulk)', async () => {
    const { sync, news } = await friends();
    await sync(Array.from({ length: 40 }, (_, i) => change({ title: `Book ${i}` })), true);
    expect((await news()).news).toEqual([]);
  });

  it('turns a big import into one “added N books”, joining one still arriving', async () => {
    const { sync, news } = await friends();
    await sync(Array.from({ length: 30 }, (_, i) => change({ title: `Import ${i}` })));
    await sync(Array.from({ length: 12 }, (_, i) => change({ title: `More ${i}` })));
    const started = withStatus(change({ title: 'Started one' }), 'reading', 1000);
    await sync([started, ...Array.from({ length: 6 }, (_, i) => change({ title: `Third ${i}` }))]);
    const body = await news();
    expect(body.news.filter((n: any) => n.kind === 'added_many')).toEqual([{ kind: 'added_many', title: null, count: 48, new: true }]);
    expect(body.news.some((n: any) => n.kind === 'started' && n.title === 'Started one')).toBe(true);
    expect(body.news.some((n: any) => n.kind === 'added')).toBe(false);
  });

  it('doesn’t repeat the same news about the same book', async () => {
    const { sync, news } = await friends();
    const book = change({ title: 'On and off' });
    await sync([book]);
    await sync([withStatus(book, 'reading', 2000)]);
    await sync([withStatus(book, 'want', 3000)]);
    await sync([withStatus(book, 'reading', 4000)]);
    expect((await news()).news.map((n: any) => n.kind)).toEqual(['started', 'added']);
  });
});

describe('friend activity housekeeping', () => {
  it('says a renamed book’s new title', async () => {
    const { sync, news } = await friends();
    const book = change({ title: 'Working title' });
    await sync([book]);
    await sync([{ ...book, updatedAt: 2000, book: { ...book.book!, title: 'Final title' } }]);
    expect((await news()).news.map((n: any) => n.title)).toEqual(['Final title']);
  });

  it('drops old news of someone who stopped syncing, on anyone else’s traffic', async () => {
    const { db, call, signUp, sync } = await friends();
    await sync([change({ title: 'Long ago' })]);
    db.raw.exec(`UPDATE friend_activity SET created_at = created_at - ${31 * 24 * 60 * 60 * 1000}`);
    // Bob never syncs again; someone else's requests sweep now and then (forced here).
    const eve = await signUp('eve');
    const random = jest.spyOn(Math, 'random').mockReturnValue(0);
    try {
      await call('POST', '/api/friends/requests', { username: 'nobody' }, { token: eve.token });
    } finally {
      random.mockRestore();
    }
    expect(db.raw.prepare('SELECT * FROM friend_activity').all()).toEqual([]);
  });
});

describe('friend activity and hidden shelves', () => {
  it('shows nothing while the shelf is hidden, and records nothing then either', async () => {
    const { call, bob, sync, news, unseen } = await friends();
    await sync([change({ title: 'Before hiding' })]);
    await call('PATCH', '/api/account', { shelfVisible: false }, { token: bob.token });
    expect(await news()).toEqual({ news: [], unseen: 0, seenUpTo: '0' });
    expect(await unseen()).toBe(0);
    await sync([change({ title: 'While hidden' })]);
    await call('PATCH', '/api/account', { shelfVisible: true }, { token: bob.token });
    expect((await news()).news.map((n: any) => n.title)).toEqual(['Before hiding']);
  });

  it('is only for friends', async () => {
    const { call, signUp, bob, sync } = await friends();
    await sync([change({ title: 'Private' })]);
    const eve = await signUp('eve');
    expect((await call('GET', `/api/friends/${bob.id}/activity`, undefined, { token: eve.token })).status).toBe(404);
    expect((await call('POST', `/api/friends/${bob.id}/activity/seen`, { upTo: '999' }, { token: eve.token })).status).toBe(404);
    expect((await call('GET', `/api/friends/${bob.id}/activity`)).status).toBe(401);
    // A request someone hasn't accepted yet isn't enough.
    await call('POST', '/api/friends/requests', { username: 'bob' }, { token: eve.token });
    expect((await call('GET', `/api/friends/${bob.id}/activity`, undefined, { token: eve.token })).status).toBe(404);
  });

  it('needs the X-Bookie header to mark news seen', async () => {
    const { call, ann, bob } = await friends();
    expect((await call('POST', `/api/friends/${bob.id}/activity/seen`, { upTo: '1' }, { token: ann.token, client: null })).status).toBe(403);
  });
});

describe('seen news', () => {
  it('counts what a friend hasn’t seen, until they look', async () => {
    const { sync, news, unseen, look } = await friends();
    await sync([change({ title: 'One' }), change({ title: 'Two' })]);
    expect(await unseen()).toBe(2);
    expect((await look()).status).toBe(200);
    expect(await unseen()).toBe(0);
    expect((await news()).news.map((n: any) => n.new)).toEqual([false, false]);
    await sync([change({ title: 'Three' })]);
    expect(await unseen()).toBe(1);
    expect((await news()).news.map((n: any) => [n.title, n.new])).toEqual([
      ['Three', true],
      ['Two', false],
      ['One', false],
    ]);
  });

  it('is kept per viewer', async () => {
    const { call, signUp, bob, sync, unseen, look } = await friends();
    const cat = await signUp('cat');
    await call('POST', '/api/friends/requests', { username: 'bob' }, { token: cat.token });
    await call('POST', '/api/friends/requests', { username: 'cat' }, { token: bob.token });
    await sync([change({ title: 'News' })]);
    await look();
    expect(await unseen()).toBe(0);
    expect((await call('GET', '/api/friends', undefined, { token: cat.token })).body.friends[0].unseen).toBe(1);
  });

  it('starts from when you became friends', async () => {
    const api = testApi();
    const ann = await api.signUp('ann');
    const bob = await api.signUp('bob');
    await api.call('POST', '/api/sync', { since: 0, changes: [change({ title: 'Before we met' })] }, { token: bob.token });
    api.db.raw.exec('UPDATE friend_activity SET created_at = created_at - 1000');
    await api.call('POST', '/api/friends/requests', { username: 'bob' }, { token: ann.token });
    await api.call('POST', '/api/friends/requests', { username: 'ann' }, { token: bob.token });
    expect((await api.call('GET', '/api/friends', undefined, { token: ann.token })).body.friends[0].unseen).toBe(0);
  });

  it('marks seen only what was shown: news arriving in between stays new', async () => {
    const { call, ann, bob, sync, news, unseen } = await friends();
    await sync([change({ title: 'Shown' })]);
    const { seenUpTo } = await news();
    await sync([change({ title: 'Arrived meanwhile' })]);
    await call('POST', `/api/friends/${bob.id}/activity/seen`, { upTo: seenUpTo }, { token: ann.token });
    expect(await unseen()).toBe(1);
    expect((await news()).news.map((n: any) => [n.title, n.new])).toEqual([
      ['Arrived meanwhile', true],
      ['Shown', false],
    ]);
  });

  it('can’t mark seen past a friend’s newest news, nor go back, and needs upTo', async () => {
    const { call, ann, bob, sync, news, unseen } = await friends();
    await sync([change({ title: 'One' })]);
    expect((await call('POST', `/api/friends/${bob.id}/activity/seen`, {}, { token: ann.token })).status).toBe(400);
    await call('POST', `/api/friends/${bob.id}/activity/seen`, { upTo: '999999' }, { token: ann.token });
    await sync([change({ title: 'Two' })]);
    expect(await unseen()).toBe(1);
    const { seenUpTo } = await news();
    await call('POST', `/api/friends/${bob.id}/activity/seen`, { upTo: seenUpTo }, { token: ann.token });
    await call('POST', `/api/friends/${bob.id}/activity/seen`, { upTo: '0' }, { token: ann.token });
    expect(await unseen()).toBe(0);
  });

  it('forgets news older than 30 days', async () => {
    const { db, sync, news } = await friends();
    await sync([change({ title: 'Old' })]);
    db.raw.exec(`UPDATE friend_activity SET created_at = created_at - ${31 * 24 * 60 * 60 * 1000}`);
    expect((await news()).news).toEqual([]);
    await sync([change({ title: 'New' })]);
    expect(db.raw.prepare('SELECT title FROM friend_activity').all()).toEqual([{ title: 'New' }]);
  });

  it('goes when a friend is removed or an account deleted', async () => {
    const { call, db, ann, bob, sync, look } = await friends();
    await sync([change({ title: 'News' })]);
    await look();
    await call('DELETE', `/api/friends/${bob.id}`, undefined, { token: ann.token });
    expect(db.raw.prepare('SELECT * FROM activity_seen').all()).toEqual([]);
    await call('DELETE', '/api/account', undefined, { token: bob.token });
    expect(db.raw.prepare('SELECT * FROM friend_activity').all()).toEqual([]);
  });

  it('is in Download my data', async () => {
    const { call, bob, sync } = await friends();
    await sync([change({ title: 'Mine' })]);
    const data = (await call('GET', '/api/account/export', undefined, { token: bob.token })).body;
    expect(data.newsForFriends).toMatchObject([{ kind: 'added', title: 'Mine', count: 1 }]);
  });
});

describe('cancelling a friend request', () => {
  it('takes it back, so it’s gone for both', async () => {
    const api = testApi();
    const ann = await api.signUp('ann');
    const bob = await api.signUp('bob');
    await api.call('POST', '/api/friends/requests', { username: 'bob' }, { token: ann.token });
    expect((await api.call('DELETE', `/api/friends/${bob.id}`, undefined, { token: ann.token })).status).toBe(200);
    expect((await api.call('GET', '/api/friends', undefined, { token: ann.token })).body.outgoing).toEqual([]);
    expect((await api.call('GET', '/api/friends', undefined, { token: bob.token })).body.incoming).toEqual([]);
    // And can be sent again.
    expect((await api.call('POST', '/api/friends/requests', { username: 'bob' }, { token: ann.token })).body.status).toBe('requested');
  });

  it('can’t touch other people’s requests', async () => {
    const api = testApi();
    const ann = await api.signUp('ann');
    const bob = await api.signUp('bob');
    const eve = await api.signUp('eve');
    await api.call('POST', '/api/friends/requests', { username: 'bob' }, { token: ann.token });
    await api.call('DELETE', `/api/friends/${bob.id}`, undefined, { token: eve.token });
    expect((await api.call('GET', '/api/friends', undefined, { token: bob.token })).body.incoming).toHaveLength(1);
  });
});

describe('recently active', () => {
  it('ignores news from before you became friends', async () => {
    const api = testApi();
    const ann = await api.signUp('ann');
    const bob = await api.signUp('bob');
    await api.call('POST', '/api/sync', { since: 0, changes: [change({ title: 'Before we met' })] }, { token: bob.token });
    api.db.raw.exec('UPDATE friend_activity SET created_at = created_at - 1000');
    await api.call('POST', '/api/friends/requests', { username: 'bob' }, { token: ann.token });
    await api.call('POST', '/api/friends/requests', { username: 'ann' }, { token: bob.token });
    const rank = async () => (await api.call('GET', '/api/friends', undefined, { token: ann.token })).body.friends[0].activeRank;
    expect(await rank()).toBeNull();
    await api.call('POST', '/api/sync', { since: 0, changes: [change({ title: 'Since' })] }, { token: bob.token });
    expect(await rank()).toBe(1);
  });

  it('ranks friends by their latest news, without times or ids, and not while hidden', async () => {
    const api = testApi();
    const ann = await api.signUp('ann');
    const people = [];
    for (const name of ['bob', 'cat', 'dan']) {
      const p = await api.signUp(name);
      await api.call('POST', '/api/friends/requests', { username: name }, { token: ann.token });
      await api.call('POST', '/api/friends/requests', { username: 'ann' }, { token: p.token });
      people.push(p);
    }
    const [bob, cat] = people;
    const sync = (p: { token: string }, title: string) => api.call('POST', '/api/sync', { since: 0, changes: [change({ title })] }, { token: p.token });
    await sync(cat, 'First');
    await sync(bob, 'Second');
    await sync(cat, 'Third');
    const ranks = async () =>
      Object.fromEntries((await api.call('GET', '/api/friends', undefined, { token: ann.token })).body.friends.map((f: any) => [f.username, f.activeRank]));
    expect(await ranks()).toEqual({ bob: 2, cat: 1, dan: null });
    const friend = (await api.call('GET', '/api/friends', undefined, { token: ann.token })).body.friends[0];
    expect(Object.keys(friend).sort()).toEqual(['activeRank', 'displayName', 'shelfVisible', 'since', 'unseen', 'userId', 'username']);
    await api.call('PATCH', '/api/account', { shelfVisible: false }, { token: cat.token });
    expect(await ranks()).toEqual({ bob: 1, cat: null, dan: null });
  });
});
