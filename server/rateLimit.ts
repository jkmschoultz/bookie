import { sha256 } from './crypto';
import type { Db } from './db';
import { ApiError } from './http';
import { ACTIVITY_MS } from './routes/activity';

export interface Limit {
  /** What's being counted, e.g. "signin-ip". */
  name: string;
  max: number;
  windowMs: number;
}

/**
 * Sign-in limits end up counting failed attempts only, so nobody can lock someone out by sending a few requests with
 * their username: the strict limit is per username *and* address; per username alone it's much looser, and per address
 * it stops one machine trying many usernames. Each attempt is counted up front (so requests sent in parallel can't
 * slip past the limit) and given back when it succeeds (see take and giveBack). Sign-ups, passkey prompts and friend
 * requests count every attempt.
 */
export const LIMITS = {
  signinUserIp: { name: 'signin-user-ip', max: 10, windowMs: 15 * 60 * 1000 },
  signinUser: { name: 'signin-user', max: 100, windowMs: 60 * 60 * 1000 },
  signinIp: { name: 'signin-ip', max: 50, windowMs: 15 * 60 * 1000 },
  recoverUserIp: { name: 'recover-user-ip', max: 5, windowMs: 60 * 60 * 1000 },
  recoverUser: { name: 'recover-user', max: 30, windowMs: 60 * 60 * 1000 },
  passwordChange: { name: 'password-change', max: 10, windowMs: 15 * 60 * 1000 },
  passkeyIp: { name: 'passkey-ip', max: 60, windowMs: 15 * 60 * 1000 },
  signupIp: { name: 'signup-ip', max: 10, windowMs: 60 * 60 * 1000 },
  friendRequests: { name: 'friend-requests', max: 30, windowMs: 24 * 60 * 60 * 1000 },
} satisfies Record<string, Limit>;

/** The longest window: rows older than this are finished with. */
const LONGEST_MS = Math.max(...Object.values(LIMITS).map((l) => l.windowMs));

/** A limit and what it counts, e.g. [LIMITS.signinIp, '203.0.113.9']. */
export type Counter = [limit: Limit, subject: string];

/** The stored key: a hash, so the table never holds an IP address or a username in the clear. */
export const limitKey = (limit: Limit, subject: string) => sha256(`${limit.name}:${subject}`);

const tooMany = () => new ApiError(429, 'rate_limited', 'Too many tries. Wait a while and try again.');

/** Adds one to a counter, starting a new window if the last one is over. Returns the count in this window. */
async function count(db: Db, [limit, subject]: Counter, now: number): Promise<number> {
  // Now and then, clear out windows that have ended, so the table doesn't grow for ever.
  if (Math.random() < 0.02) await sweep(db, now);
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN window_start <= ?3 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN window_start <= ?3 THEN ?2 ELSE window_start END
       RETURNING count`,
    )
    .bind(await limitKey(limit, subject), now, now - limit.windowMs)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

/** Counts one attempt and refuses it once there have been `max` in the current window. */
export async function hit(db: Db, limit: Limit, subject: string, now = Date.now()): Promise<void> {
  if ((await count(db, [limit, subject], now)) > limit.max) throw tooMany();
}

/**
 * Counts an attempt on each of these counters, atomically, and refuses it if any is then over its limit. Counting
 * before checking means parallel requests can't all pass a check that none of them has counted yet.
 */
export async function take(db: Db, counters: Counter[], now = Date.now()): Promise<void> {
  let over = false;
  for (const counter of counters) if ((await count(db, counter, now)) > counter[0].max) over = true;
  if (over) throw tooMany();
}

/** Takes back one attempt from each of these counters, e.g. when it turned out to be a successful sign-in. */
export async function giveBack(db: Db, counters: Counter[]): Promise<void> {
  for (const [limit, subject] of counters)
    await db.prepare('UPDATE rate_limits SET count = max(count - 1, 0) WHERE key = ?').bind(await limitKey(limit, subject)).run();
}

/** Forget the attempts, e.g. a username's failed sign-ins from an address once it signs in from there. */
export async function clear(db: Db, limit: Limit, subject: string): Promise<void> {
  await db.prepare('DELETE FROM rate_limits WHERE key = ?').bind(await limitKey(limit, subject)).run();
}

/**
 * Deletes counters whose window ended long enough ago that no limit still uses them, and friends' news past its 30
 * days, so news from people who've stopped syncing doesn't stay behind.
 */
export async function sweep(db: Db, now = Date.now()): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM rate_limits WHERE window_start <= ?').bind(now - LONGEST_MS),
    db.prepare('DELETE FROM friend_activity WHERE created_at < ?').bind(now - ACTIVITY_MS),
  ]);
}

/** The caller's address as Cloudflare saw it. Locally there's none, so everyone shares one bucket. */
export const clientIp = (request: Request) => request.headers.get('cf-connecting-ip') ?? 'local';
