import { ApiError } from '../http';
import { accessToken, createSession, RACE_WINDOW_MS, readAccessToken, refreshSession } from '../sessions';
import { memoryDb } from './memoryDb';

const KEY = 'k'.repeat(40);

async function withUser() {
  const db = memoryDb();
  await db.prepare("INSERT INTO users (id, username, username_key, created_at) VALUES ('u1', 'Ann', 'ann', 0)").run();
  return db;
}

const sessions = (db: ReturnType<typeof memoryDb>) => db.raw.prepare('SELECT COUNT(*) AS n FROM sessions').get()!.n;

describe('access tokens', () => {
  it('reads back what was signed, until it expires', async () => {
    const token = await accessToken(KEY, { userId: 'u1', sessionId: 's1' }, 1000);
    expect(await readAccessToken(KEY, token, 1000)).toEqual({ userId: 'u1', sessionId: 's1' });
    expect(await readAccessToken(KEY, token, 1000 + 15 * 60 * 1000)).toBeNull();
  });

  it('refuses a token signed with another key or changed', async () => {
    const token = await accessToken(KEY, { userId: 'u1', sessionId: 's1' }, 1000);
    expect(await readAccessToken('x'.repeat(40), token, 1000)).toBeNull();
    const [payload, sig] = token.split('.');
    const forged = btoa(atob(payload).replace('u1', 'u2')).replace(/=+$/, '');
    expect(await readAccessToken(KEY, `${forged}.${sig}`, 1000)).toBeNull();
  });

  it('needs a long enough signing key', async () => {
    await expect(accessToken('short', { userId: 'u1', sessionId: 's1' })).rejects.toMatchObject({ code: 'not_configured' });
  });
});

describe('refresh tokens', () => {
  it('rotate: each refresh hands out a new token, and the new one works', async () => {
    const db = await withUser();
    const first = await createSession(db, KEY, 'u1', 1000);
    const second = await refreshSession(db, KEY, first.refreshToken, 2000);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.refreshToken.split('.')[0]).toBe(first.refreshToken.split('.')[0]);
    const third = await refreshSession(db, KEY, second.refreshToken, 3000);
    expect(third.userId).toBe('u1');
  });

  it('only store a hash of the secret', async () => {
    const db = await withUser();
    const { refreshToken } = await createSession(db, KEY, 'u1', 1000);
    const row = db.raw.prepare('SELECT refresh_hash FROM sessions').get()!;
    expect(row.refresh_hash).not.toContain(refreshToken.split('.')[1]);
  });

  it('end the session when an old token is used again (reuse detection)', async () => {
    const db = await withUser();
    const first = await createSession(db, KEY, 'u1', 1000);
    const second = await refreshSession(db, KEY, first.refreshToken, 2000);
    await expect(refreshSession(db, KEY, first.refreshToken, 2000 + RACE_WINDOW_MS)).rejects.toMatchObject({ status: 401 });
    expect(sessions(db)).toBe(0);
    // The thief's copy is dead, and so is the real device's newer one.
    await expect(refreshSession(db, KEY, second.refreshToken, 3000 + RACE_WINDOW_MS)).rejects.toMatchObject({ status: 401 });
  });

  it('let two racing refreshes off without ending the session', async () => {
    const db = await withUser();
    const first = await createSession(db, KEY, 'u1', 1000);
    await refreshSession(db, KEY, first.refreshToken, 2000);
    const raced = await refreshSession(db, KEY, first.refreshToken, 2500).catch((e) => e);
    expect(raced).toBeInstanceOf(ApiError);
    expect(raced.code).toBe('refresh_raced');
    expect(sessions(db)).toBe(1);
  });

  it('refuse a made-up secret and end that session', async () => {
    const db = await withUser();
    const first = await createSession(db, KEY, 'u1', 1000);
    const [id] = first.refreshToken.split('.');
    await expect(refreshSession(db, KEY, `${id}.made-up`, 2000)).rejects.toMatchObject({ status: 401 });
    expect(sessions(db)).toBe(0);
  });

  it('expire after 60 days without use', async () => {
    const db = await withUser();
    const first = await createSession(db, KEY, 'u1', 1000);
    await expect(refreshSession(db, KEY, first.refreshToken, 1000 + 61 * 24 * 60 * 60 * 1000)).rejects.toMatchObject({ status: 401 });
  });
});
