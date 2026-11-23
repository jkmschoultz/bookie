import type { AccountSummary } from '../shared/account';

import type { Db, Env } from './db';
import { ApiError, badRequest, clearRefreshCookie, json, refreshCookie } from './http';
import { authenticate, createSession, type Auth, type Issued } from './sessions';

/** Everything a route needs about the request it's answering. */
export interface Ctx {
  request: Request;
  env: Env;
  db: Db;
  url: URL;
  /** The web page's origin (where a passkey belongs), or this API's own origin for the app. */
  origin: string;
  /** The web app keeps its refresh token in a cookie; the phone app keeps it itself and sends it in the body. */
  client: 'web' | 'native';
  now: number;
  params: string[];
}

export const auth = (ctx: Ctx): Promise<Auth> => authenticate(ctx.db, ctx.env.SESSION_SIGNING_KEY, ctx.request, ctx.now);

/** The relying-party id for passkeys: the host of the page, e.g. mybookie.pages.dev. A passkey only works there. */
export const rpId = (ctx: Ctx) => new URL(ctx.origin).hostname;


export async function accountSummary(ctx: Ctx, userId: string): Promise<AccountSummary> {
  const user = await ctx.db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.shelf_visible, EXISTS (SELECT 1 FROM password_credentials p WHERE p.user_id = u.id) AS has_password
       FROM users u WHERE u.id = ?`,
    )
    .bind(userId)
    .first<{ id: string; username: string; display_name: string | null; shelf_visible: number; has_password: number }>();
  if (!user) throw new ApiError(401, 'unauthorised', 'Please sign in again.');
  const { results } = await ctx.db
    .prepare('SELECT id, rp_id, created_at, last_used_at FROM passkeys WHERE user_id = ? ORDER BY created_at')
    .bind(userId)
    .all<{ id: string; rp_id: string; created_at: number; last_used_at: number | null }>();
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    shelfVisible: !!user.shelf_visible,
    hasPassword: !!user.has_password,
    passkeys: results.map((p) => ({ id: p.id, createdAt: p.created_at, lastUsedAt: p.last_used_at, here: p.rp_id === rpId(ctx) })),
  };
}

/** The answer to a successful sign-in or sign-up: a new session, handed over the way this client keeps it. */
export function sessionResponse(ctx: Ctx, issued: Issued, body: Record<string, unknown>, status = 200): Response {
  if (ctx.client === 'native') return json({ ...body, accessToken: issued.accessToken, refreshToken: issued.refreshToken }, status);
  const maxAge = Math.floor((issued.expiresAt - ctx.now) / 1000);
  return json({ ...body, accessToken: issued.accessToken }, status, { 'set-cookie': refreshCookie(issued.refreshToken, maxAge) });
}

export async function signedIn(ctx: Ctx, userId: string, extra: Record<string, unknown> = {}, status = 200): Promise<Response> {
  const issued = await createSession(ctx.db, ctx.env.SESSION_SIGNING_KEY, userId, ctx.now);
  return sessionResponse(ctx, issued, { ...extra, account: await accountSummary(ctx, userId) }, status);
}

export function signedOut(ctx: Ctx, status = 200): Response {
  return ctx.client === 'web' ? json({ ok: true }, status, { 'set-cookie': clearRefreshCookie() }) : json({ ok: true }, status);
}

export function param(ctx: Ctx, i: number): string {
  const value = ctx.params[i];
  if (!value || value.length > 100) throw badRequest('Missing id.');
  return value;
}
