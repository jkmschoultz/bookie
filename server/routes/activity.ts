import type { SyncBook } from '../../shared/books';
import { param, type Ctx } from '../context';
import type { Statement } from '../db';
import { badRequest, json, notFound, readJson } from '../http';

/**
 * What friends see change on your shelf: a book added, started (its status became "reading") or finished ("read").
 * Sync writes these as changes arrive (activityStatements). Never for deletions; a deleted book's news goes with it.
 * Nothing is written while the shelf is hidden, or while a device is sending a whole library at sign-in (`bulk`), and
 * a big import in one go becomes one "added N books". Only the title is kept: no notes, ratings or reading dates, and
 * friends aren't told when it happened, only in what order. News is kept for 30 days.
 */

export const ACTIVITY_DAYS = 30;
export const ACTIVITY_MS = ACTIVITY_DAYS * 24 * 60 * 60 * 1000;
/** More books added in one sync than this become one "added N books". */
export const MANY = 5;
/** A big import across several syncs within this long joins the same "added N books". */
const MANY_JOIN_MS = 10 * 60 * 1000;
/** The same news about the same book within this long (reading, then not, then reading again) isn't repeated. */
const REPEAT_MS = 12 * 60 * 60 * 1000;
/** How many of a friend's latest news are sent at most. */
const LATEST = 20;

export type ActivityKind = 'added' | 'started' | 'finished' | 'added_many';

/** A book as stored before this sync: whether it's on the shelf (not a tombstone), and its status. */
export interface StoredBook {
  updatedAt: number;
  deleted: boolean;
  status: string | null;
}

/** The news in one book's change, if any. */
export function newsFor(change: SyncBook, before: StoredBook | undefined): 'added' | 'started' | 'finished' | null {
  if (!change.book) return null;
  const status = change.book.status;
  if (!before || before.deleted) return status === 'reading' ? 'started' : 'added';
  if (status === 'reading' && before.status !== 'reading') return 'started';
  if (status === 'read' && before.status !== 'read') return 'finished';
  return null;
}

/**
 * The statements that record the news in a sync's winning changes, to run in the same batch as the books. Deleted books
 * take their news with them.
 */
export function activityStatements(ctx: Ctx, userId: string, winners: SyncBook[], stored: Map<string, StoredBook>, opts: { bulk: boolean; visible: boolean }): Statement[] {
  const statements: Statement[] = [];
  const deleted = winners.filter((c) => !c.book).map((c) => c.id);
  if (deleted.length)
    statements.push(ctx.db.prepare('DELETE FROM friend_activity WHERE user_id = ? AND book_id IN (SELECT value FROM json_each(?))').bind(userId, JSON.stringify(deleted)));
  // A book renamed since: its news says the new title.
  const titles = winners.filter((c) => c.book && stored.has(c.id)).map((c) => ({ id: c.id, title: c.book!.title.slice(0, 200) }));
  if (titles.length)
    statements.push(
      ctx.db
        .prepare(
          `UPDATE friend_activity SET title = (SELECT json_extract(j.value, '$.title') FROM json_each(?2) AS j WHERE json_extract(j.value, '$.id') = friend_activity.book_id)
           WHERE user_id = ?1 AND book_id IN (SELECT json_extract(value, '$.id') FROM json_each(?2))`,
        )
        .bind(userId, JSON.stringify(titles)),
    );
  if (opts.bulk || !opts.visible) return statements;

  const news = winners.flatMap((c) => {
    const kind = newsFor(c, stored.get(c.id));
    return kind ? [{ bookId: c.id, kind, title: c.book!.title.slice(0, 200) }] : [];
  });
  if (!news.length) return statements;
  const added = news.filter((n) => n.kind === 'added');
  const rest = added.length > MANY ? news.filter((n) => n.kind !== 'added') : news;

  statements.push(ctx.db.prepare('DELETE FROM friend_activity WHERE user_id = ? AND created_at < ?').bind(userId, ctx.now - ACTIVITY_MS));
  if (added.length > MANY) {
    // One "added N books", taking in a big import that's still arriving: the new one replaces it, so it's news again.
    statements.push(
      ctx.db
        .prepare(
          `INSERT INTO friend_activity (user_id, kind, count, created_at)
           SELECT ?1, 'added_many', ?3 + COALESCE((SELECT SUM(count) FROM friend_activity WHERE user_id = ?1 AND kind = 'added_many' AND created_at > ?2), 0), ?4`,
        )
        .bind(userId, ctx.now - MANY_JOIN_MS, added.length, ctx.now),
      ctx.db
        .prepare(
          `DELETE FROM friend_activity WHERE user_id = ?1 AND kind = 'added_many' AND created_at > ?2
           AND id < (SELECT MAX(id) FROM friend_activity WHERE user_id = ?1 AND kind = 'added_many')`,
        )
        .bind(userId, ctx.now - MANY_JOIN_MS),
    );
  }
  if (rest.length)
    statements.push(
      ctx.db
        .prepare(
          `INSERT INTO friend_activity (user_id, book_id, kind, title, created_at)
           SELECT ?1, json_extract(j.value, '$.bookId'), json_extract(j.value, '$.kind'), json_extract(j.value, '$.title'), ?2
           FROM json_each(?3) AS j
           WHERE NOT EXISTS (SELECT 1 FROM friend_activity f WHERE f.user_id = ?1 AND f.book_id = json_extract(j.value, '$.bookId')
                             AND f.kind = json_extract(j.value, '$.kind') AND f.created_at > ?4)
           ORDER BY j.key`,
        )
        .bind(userId, ctx.now, JSON.stringify(rest), ctx.now - REPEAT_MS),
    );
  return statements;
}

/**
 * SQL for how many of a friend's news the viewer hasn't seen, for listFriends: since they last looked, or since they
 * became friends. `?1` is the viewer, `?2` the oldest time kept; `u` is the friend and `f` the friendship.
 */
export const UNSEEN_SQL = `(SELECT COUNT(*) FROM friend_activity a WHERE a.user_id = u.id AND a.created_at > ?2 AND a.created_at >= COALESCE(f.responded_at, 0)
   AND a.id > COALESCE((SELECT s.seen_id FROM activity_seen s WHERE s.viewer_id = ?1 AND s.friend_id = u.id), 0))`;

/** SQL for a friend's newest news still kept, since you became friends (its id, only to rank friends by; never sent). Same names as UNSEEN_SQL. */
export const LATEST_SQL = `(SELECT MAX(a.id) FROM friend_activity a WHERE a.user_id = u.id AND a.created_at > ?2 AND a.created_at >= COALESCE(f.responded_at, 0))`;

export const activitySince = (ctx: Ctx) => ctx.now - ACTIVITY_MS;

/** The friend, if they're an accepted friend: whether their shelf is shared and when you became friends. */
async function friendship(ctx: Ctx, userId: string, friendId: string) {
  const key = userId < friendId ? `${userId}:${friendId}` : `${friendId}:${userId}`;
  const row = await ctx.db
    .prepare("SELECT u.shelf_visible, f.responded_at FROM friendships f JOIN users u ON u.id = ?1 WHERE f.pair_key = ?2 AND f.status = 'accepted'")
    .bind(friendId, key)
    .first<{ shelf_visible: number; responded_at: number | null }>();
  if (!row) throw notFound('That shelf isn’t shared with you.');
  return { visible: !!row.shelf_visible, since: row.responded_at ?? 0 };
}

/**
 * GET /api/friends/:id/activity → a friend's latest news, newest first, each marked new if you haven't seen it, and
 * `seenUpTo`: what to send back to mark exactly this news seen (and nothing that arrives after it).
 */
export async function friendActivity(ctx: Ctx, userId: string): Promise<Response> {
  const friendId = param(ctx, 0);
  const { visible, since } = await friendship(ctx, userId, friendId);
  if (!visible) return json({ news: [], unseen: 0, seenUpTo: '0' });
  const seen = await ctx.db.prepare('SELECT seen_id FROM activity_seen WHERE viewer_id = ? AND friend_id = ?').bind(userId, friendId).first<{ seen_id: number }>();
  const { results } = await ctx.db
    .prepare('SELECT id, kind, title, count FROM friend_activity WHERE user_id = ? AND created_at > ? AND created_at >= ? ORDER BY id DESC LIMIT ?')
    .bind(friendId, activitySince(ctx), since, LATEST)
    .all<{ id: number; kind: ActivityKind; title: string | null; count: number }>();
  const last = seen?.seen_id ?? 0;
  const news = results.map((r) => ({ kind: r.kind, title: r.title, count: r.count, new: r.id > last }));
  return json({ news, unseen: news.filter((n) => n.new).length, seenUpTo: String(results[0]?.id ?? 0) });
}

/**
 * POST /api/friends/:id/activity/seen { upTo } → you've seen a friend's news up to `upTo` (seenUpTo from the GET).
 * Never past their newest news, and never back.
 */
export async function markActivitySeen(ctx: Ctx, userId: string): Promise<Response> {
  const friendId = param(ctx, 0);
  const upTo = (await readJson(ctx.request)).upTo;
  if (typeof upTo !== 'string' || !/^\d{1,15}$/.test(upTo)) throw badRequest('Missing or invalid upTo.');
  await friendship(ctx, userId, friendId);
  await ctx.db
    .prepare(
      `INSERT INTO activity_seen (viewer_id, friend_id, seen_id)
       SELECT ?1, ?2, MIN(?3, COALESCE((SELECT MAX(id) FROM friend_activity WHERE user_id = ?2), 0)) WHERE true
       ON CONFLICT(viewer_id, friend_id) DO UPDATE SET seen_id = MAX(activity_seen.seen_id, excluded.seen_id)`,
    )
    .bind(userId, friendId, Number(upTo))
    .run();
  return json({ ok: true });
}
