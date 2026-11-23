import { constantTimeEqual, hmac, randomToken, sha256 } from './crypto';
import type { Db } from './db';
import { ApiError, unauthorised } from './http';

/**
 * Sessions: a short-lived access token for each request, and a long-lived refresh token to get new ones.
 *
 * The access token is "<payload>.<signature>", signed with SESSION_SIGNING_KEY, and lasts 15 minutes. Each request also
 * checks its session still exists, so signing out or deleting the account takes effect at once.
 *
 * The refresh token is "<session id>.<secret>"; only a hash of the secret is stored. Every refresh replaces the secret.
 * If an old secret turns up again, someone has a copy of it, so the whole session is ended (reuse detection). The one
 * before is let off for a few seconds, since two requests from the same device can race with the same token.
 */

export const ACCESS_TTL_MS = 15 * 60 * 1000;
/** A session lasts this long after it was last refreshed. */
export const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000;
/** How long the previous refresh token is still accepted as a race rather than reuse. */
export const RACE_WINDOW_MS = 30 * 1000;

export interface Issued {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface Auth {
  userId: string;
  sessionId: string;
}

function signingKey(key: string | undefined): string {
  if (!key || key.length < 32) throw new ApiError(503, 'not_configured', 'Accounts aren’t set up here yet.');
  return key;
}

export async function accessToken(key: string | undefined, auth: Auth, now = Date.now()): Promise<string> {
  const payload = btoa(JSON.stringify({ sub: auth.userId, sid: auth.sessionId, exp: now + ACCESS_TTL_MS })).replace(/=+$/, '');
  return `${payload}.${await hmac(signingKey(key), payload)}`;
}

/** The user and session an access token is for, if its signature is right and it hasn't expired. */
export async function readAccessToken(key: string | undefined, token: string, now = Date.now()): Promise<Auth | null> {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  if (!constantTimeEqual(await hmac(signingKey(key), payload), signature)) return null;
  try {
    const { sub, sid, exp } = JSON.parse(atob(payload));
    if (typeof sub !== 'string' || typeof sid !== 'string' || typeof exp !== 'number' || exp <= now) return null;
    return { userId: sub, sessionId: sid };
  } catch {
    return null;
  }
}

export async function createSession(db: Db, key: string | undefined, userId: string, now = Date.now()): Promise<Issued> {
  const id = randomToken(16);
  const secret = randomToken(32);
  // Clear out this user's expired sessions while we're here.
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?').bind(userId, now),
    db.prepare('INSERT INTO sessions (id, user_id, refresh_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').bind(id, userId, await sha256(secret), now, now + REFRESH_TTL_MS),
  ]);
  return { userId, accessToken: await accessToken(key, { userId, sessionId: id }, now), refreshToken: `${id}.${secret}`, expiresAt: now + REFRESH_TTL_MS };
}

interface SessionRow {
  user_id: string;
  refresh_hash: string;
  previous_hash: string | null;
  rotated_at: number | null;
  expires_at: number;
}

/** Swap a refresh token for a new pair. Ends the session if an old token is replayed. */
export async function refreshSession(db: Db, key: string | undefined, refreshToken: string, now = Date.now()): Promise<Issued> {
  const [id, secret, extra] = refreshToken.split('.');
  if (!id || !secret || extra !== undefined) throw unauthorised();
  const row = await db.prepare('SELECT user_id, refresh_hash, previous_hash, rotated_at, expires_at FROM sessions WHERE id = ?').bind(id).first<SessionRow>();
  if (!row) throw unauthorised();
  if (row.expires_at <= now) {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
    throw unauthorised();
  }
  const presented = await sha256(secret);
  if (!constantTimeEqual(presented, row.refresh_hash)) {
    if (row.previous_hash && constantTimeEqual(presented, row.previous_hash) && row.rotated_at != null && now - row.rotated_at < RACE_WINDOW_MS)
      throw new ApiError(409, 'refresh_raced', 'Signing in again, try once more.');
    // An old refresh token came back: whoever has it isn't this device, so end the session for both.
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
    throw unauthorised();
  }
  const next = randomToken(32);
  // Only rotates if nobody else rotated it in the meantime.
  const { meta } = await db
    .prepare('UPDATE sessions SET refresh_hash = ?, previous_hash = refresh_hash, rotated_at = ?, expires_at = ? WHERE id = ? AND refresh_hash = ?')
    .bind(await sha256(next), now, now + REFRESH_TTL_MS, id, presented)
    .run();
  if (meta.changes !== 1) throw new ApiError(409, 'refresh_raced', 'Signing in again, try once more.');
  return { userId: row.user_id, accessToken: await accessToken(key, { userId: row.user_id, sessionId: id }, now), refreshToken: `${id}.${next}`, expiresAt: now + REFRESH_TTL_MS };
}

/**
 * Ends the session a refresh token belongs to (signing out). Only with its secret, current or the one before: the
 * session id alone is in every access token, and mustn't be enough to sign someone out.
 */
export async function endSession(db: Db, refreshToken: string): Promise<void> {
  const [id, secret, extra] = refreshToken.split('.');
  if (!id || !secret || extra !== undefined) return;
  const row = await db.prepare('SELECT refresh_hash, previous_hash FROM sessions WHERE id = ?').bind(id).first<Pick<SessionRow, 'refresh_hash' | 'previous_hash'>>();
  if (!row) return;
  const presented = await sha256(secret);
  const current = constantTimeEqual(presented, row.refresh_hash);
  const previous = row.previous_hash != null && constantTimeEqual(presented, row.previous_hash);
  if (current || previous) await db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
}

/** The signed-in user for a request with "Authorization: Bearer <access token>", or a 401. */
export async function authenticate(db: Db, key: string | undefined, request: Request, now = Date.now()): Promise<Auth> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const auth = token ? await readAccessToken(key, token, now) : null;
  if (!auth) throw unauthorised();
  const live = await db.prepare('SELECT 1 AS ok FROM sessions WHERE id = ? AND user_id = ? AND expires_at > ?').bind(auth.sessionId, auth.userId, now).first();
  if (!live) throw unauthorised();
  return auth;
}
