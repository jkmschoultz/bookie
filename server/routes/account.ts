import { cleanDisplayName, usernameKey } from '../../shared/account';
import { accountSummary, signedOut, type Ctx } from '../context';
import { badRequest, json, readJson } from '../http';
import { LIMITS, limitKey } from '../rateLimit';

export async function getAccount(ctx: Ctx, userId: string): Promise<Response> {
  return json({ account: await accountSummary(ctx, userId) });
}

/** Change the display name, or whether friends can see your shelf. */
export async function updateAccount(ctx: Ctx, userId: string): Promise<Response> {
  const body = await readJson(ctx.request);
  const statements = [];
  if ('displayName' in body) statements.push(ctx.db.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(cleanDisplayName(body.displayName), userId));
  if ('shelfVisible' in body) {
    if (typeof body.shelfVisible !== 'boolean') throw badRequest('shelfVisible must be true or false.');
    statements.push(ctx.db.prepare('UPDATE users SET shelf_visible = ? WHERE id = ?').bind(body.shelfVisible ? 1 : 0, userId));
  }
  if (statements.length) await ctx.db.batch(statements);
  return json({ account: await accountSummary(ctx, userId) });
}

/** Everything the account holds about you, as JSON. */
export async function exportAccount(ctx: Ctx, userId: string): Promise<Response> {
  const user = await ctx.db.prepare('SELECT username, display_name, shelf_visible, created_at FROM users WHERE id = ?').bind(userId).first<Record<string, unknown>>();
  const [books, passkeys, password, friends, activity] = await Promise.all([
    ctx.db.prepare('SELECT id, data, private_data, updated_at, deleted_at FROM books WHERE user_id = ? ORDER BY seq').bind(userId).all<{ id: string; data: string; private_data: string; updated_at: number; deleted_at: number | null }>(),
    ctx.db.prepare('SELECT rp_id, created_at, last_used_at FROM passkeys WHERE user_id = ?').bind(userId).all<Record<string, unknown>>(),
    ctx.db.prepare('SELECT updated_at FROM password_credentials WHERE user_id = ?').bind(userId).first<{ updated_at: number }>(),
    ctx.db
      .prepare(
        `SELECT u.username, f.status, f.requester_id = ?1 AS asked_by_you, f.created_at, f.responded_at FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.requester_id = ?1 THEN f.addressee_id ELSE f.requester_id END
         WHERE f.requester_id = ?1 OR f.addressee_id = ?1`,
      )
      .bind(userId)
      .all<Record<string, unknown>>(),
    ctx.db.prepare('SELECT kind, title, count, created_at FROM friend_activity WHERE user_id = ? ORDER BY id').bind(userId).all<{ kind: string; title: string | null; count: number; created_at: number }>(),
  ]);
  const iso = (ms: unknown) => (typeof ms === 'number' ? new Date(ms).toISOString() : null);
  return json({
    app: 'bookie',
    kind: 'account-export',
    exportedAt: new Date(ctx.now).toISOString(),
    account: { username: user!.username, displayName: user!.display_name, shelfVisibleToFriends: !!user!.shelf_visible, createdAt: iso(user!.created_at) },
    signIn: {
      password: password ? { changedAt: iso(password.updated_at) } : null,
      passkeys: passkeys.results.map((p) => ({ site: p.rp_id, createdAt: iso(p.created_at), lastUsedAt: iso(p.last_used_at) })),
    },
    books: books.results.map((b) => ({
      id: b.id,
      updatedAt: iso(b.updated_at),
      deletedAt: iso(b.deleted_at),
      ...(b.deleted_at == null ? { ...JSON.parse(b.data), ...JSON.parse(b.private_data) } : {}),
    })),
    friends: friends.results.map((f) => ({ username: f.username, status: f.status, askedByYou: !!f.asked_by_you, since: iso(f.responded_at ?? f.created_at) })),
    // What your friends see change on your shelf (kept 30 days).
    newsForFriends: activity.results.map((a) => ({ kind: a.kind, title: a.title, count: a.count, at: iso(a.created_at) })),
  });
}

/** Deletes the account and everything in it, at once. */
export async function deleteAccount(ctx: Ctx, userId: string): Promise<Response> {
  const user = await ctx.db.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first<{ username: string }>();
  const statements = ['books', 'passkeys', 'password_credentials', 'recovery_codes', 'sessions', 'webauthn_challenges'].map((table) =>
    ctx.db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(userId),
  );
  statements.push(ctx.db.prepare('DELETE FROM friendships WHERE requester_id = ?1 OR addressee_id = ?1').bind(userId));
  statements.push(ctx.db.prepare('DELETE FROM friend_activity WHERE user_id = ?').bind(userId));
  statements.push(ctx.db.prepare('DELETE FROM activity_seen WHERE viewer_id = ?1 OR friend_id = ?1').bind(userId));
  if (user) {
    // The username-wide counters; the per-address ones expire on their own (sweep).
    for (const limit of [LIMITS.signinUser, LIMITS.recoverUser])
      statements.push(ctx.db.prepare('DELETE FROM rate_limits WHERE key = ?').bind(await limitKey(limit, usernameKey(user.username))));
  }
  statements.push(ctx.db.prepare('DELETE FROM users WHERE id = ?').bind(userId));
  await ctx.db.batch(statements);
  return signedOut(ctx);
}
