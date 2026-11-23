import type { SyncBook } from '../../shared/books';
import { makeBook } from '../../src/test/makeBook';
import type { Env } from '../db';
import { handle } from '../index';
import { memoryDb, type MemoryDb } from './memoryDb';

export const ORIGIN = 'https://mybookie.pages.dev';

export interface Call {
  token?: string;
  client?: 'web' | 'native' | null;
  cookie?: string;
  origin?: string | null;
  ip?: string;
}

export interface Reply {
  status: number;
  body: Record<string, any>;
  headers: Headers;
}

/** A Bookie API on a fresh in-memory database, called the way the apps call it. */
export function testApi() {
  const db: MemoryDb = memoryDb();
  const env: Env = { DB: db, SESSION_SIGNING_KEY: 's'.repeat(48) };
  async function call(method: string, path: string, body?: unknown, opts: Call = {}): Promise<Reply> {
    const headers: Record<string, string> = { 'content-type': 'application/json', 'cf-connecting-ip': opts.ip ?? '203.0.113.9' };
    if (opts.client !== null) headers['x-bookie'] = opts.client ?? 'native';
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (opts.cookie) headers.cookie = opts.cookie;
    if (opts.origin !== null && (opts.origin || (opts.client ?? 'native') === 'web')) headers.origin = opts.origin ?? ORIGIN;
    const res = await handle(new Request(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
    return { status: res.status, body: await res.json(), headers: res.headers };
  }
  /** Signs up with a password on the phone app; returns its tokens. */
  async function signUp(username: string, password = 'a long password') {
    const res = await call('POST', '/api/auth/password/signup', { username, password });
    if (res.status !== 201) throw new Error(`sign-up failed: ${JSON.stringify(res.body)}`);
    return { token: res.body.accessToken as string, refreshToken: res.body.refreshToken as string, id: res.body.account.id as string, recoveryCode: res.body.recoveryCode as string };
  }
  return { db, env, call, signUp };
}

let n = 0;
/** A synced book with a fresh id. */
export function change(overrides: Partial<SyncBook> & { title?: string; notes?: string | null } = {}): SyncBook {
  const { title = 'A book', notes = null, ...rest } = overrides;
  const { id: _local, ...book } = makeBook({ title, notes });
  return { id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, updatedAt: 1000, deletedAt: null, book, ...rest };
}
