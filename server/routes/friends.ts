import { param, type Ctx } from '../context';
import { randomToken } from '../crypto';
import { ApiError, json, notFound, readJson, str } from '../http';
import { hit, LIMITS } from '../rateLimit';
import { findUser } from '../users';
import { activitySince, LATEST_SQL, UNSEEN_SQL } from './activity';

/**
 * Friends: you ask someone by their exact username, they accept or decline, and either of you can remove the other.
 * Nobody can browse or search other users. A friend's shelf is visible to you once they've accepted, unless they've
 * hidden it, and only its books with their ratings and reading dates, never notes (see FRIEND_FIELDS).
 */

const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

interface FriendRow {
  id: string;
  status: 'pending' | 'accepted';
  requester_id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  shelf_visible: number;
  created_at: number;
  responded_at: number | null;
  unseen: number;
  latest_news: number | null;
}

export async function listFriends(ctx: Ctx, userId: string): Promise<Response> {
  const { results } = await ctx.db
    .prepare(
      `SELECT f.id, f.status, f.requester_id, u.id AS user_id, u.username, u.display_name, u.shelf_visible, f.created_at, f.responded_at,
         CASE WHEN f.status = 'accepted' AND u.shelf_visible = 1 THEN ${UNSEEN_SQL} ELSE 0 END AS unseen,
         CASE WHEN f.status = 'accepted' AND u.shelf_visible = 1 THEN ${LATEST_SQL} END AS latest_news
       FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id = ?1 THEN f.addressee_id ELSE f.requester_id END
       WHERE f.requester_id = ?1 OR f.addressee_id = ?1
       ORDER BY u.username_key`,
    )
    .bind(userId, activitySince(ctx))
    .all<FriendRow>();
  const person = (r: FriendRow) => ({ userId: r.user_id, username: r.username, displayName: r.display_name });
  // For sorting by "recently active": 1 for the friend with the newest news, 2 for the next… and null for none. A rank,
  // not a time or an id, so nothing says when anything happened.
  const ranked = results.filter((r) => r.latest_news != null).sort((a, b) => b.latest_news! - a.latest_news!);
  const activeRank = new Map(ranked.map((r, i) => [r.user_id, i + 1]));
  return json({
    friends: results.filter((r) => r.status === 'accepted').map((r) => ({ ...person(r), shelfVisible: !!r.shelf_visible, since: r.responded_at, unseen: r.unseen, activeRank: activeRank.get(r.user_id) ?? null })),
    incoming: results.filter((r) => r.status === 'pending' && r.requester_id !== userId).map((r) => ({ requestId: r.id, ...person(r), sentAt: r.created_at })),
    outgoing: results.filter((r) => r.status === 'pending' && r.requester_id === userId).map((r) => ({ requestId: r.id, ...person(r), sentAt: r.created_at })),
  });
}

/** Ask someone to be friends. If they've already asked you, this accepts. */
export async function requestFriend(ctx: Ctx, userId: string): Promise<Response> {
  await hit(ctx.db, LIMITS.friendRequests, userId, ctx.now);
  const username = str((await readJson(ctx.request)).username, 'username', 100).trim();
  const other = await findUser(ctx, username);
  if (!other) throw notFound('No one has that username. Check the spelling with your friend.');
  if (other.id === userId) throw new ApiError(400, 'self', 'That’s your own username.');
  const key = pairKey(userId, other.id);
  const existing = await ctx.db.prepare('SELECT id, status, requester_id FROM friendships WHERE pair_key = ?').bind(key).first<{ id: string; status: string; requester_id: string }>();
  if (existing?.status === 'accepted') return json({ status: 'friends' });
  if (existing && existing.requester_id === userId) return json({ status: 'requested' });
  if (existing) {
    await ctx.db.prepare("UPDATE friendships SET status = 'accepted', responded_at = ? WHERE id = ?").bind(ctx.now, existing.id).run();
    return json({ status: 'friends' });
  }
  await ctx.db
    .prepare("INSERT INTO friendships (id, requester_id, addressee_id, pair_key, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?) ON CONFLICT(pair_key) DO NOTHING")
    .bind(randomToken(16), userId, other.id, key, ctx.now)
    .run();
  return json({ status: 'requested' }, 201);
}

/** Accept a request someone sent you. */
export async function acceptRequest(ctx: Ctx, userId: string): Promise<Response> {
  const { meta } = await ctx.db
    .prepare("UPDATE friendships SET status = 'accepted', responded_at = ? WHERE id = ? AND addressee_id = ? AND status = 'pending'")
    .bind(ctx.now, param(ctx, 0), userId)
    .run();
  if (!meta.changes) throw notFound('That request has gone.');
  return json({ status: 'friends' });
}

/** Decline a request someone sent you. They aren't told; they can ask again later. */
export async function declineRequest(ctx: Ctx, userId: string): Promise<Response> {
  await ctx.db.prepare("DELETE FROM friendships WHERE id = ? AND addressee_id = ? AND status = 'pending'").bind(param(ctx, 0), userId).run();
  return json({ ok: true });
}

/** Remove a friend, or take back a request you sent. What each of you had seen of the other's news goes too. */
export async function removeFriend(ctx: Ctx, userId: string): Promise<Response> {
  const other = param(ctx, 0);
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM friendships WHERE pair_key = ?').bind(pairKey(userId, other)),
    ctx.db.prepare('DELETE FROM activity_seen WHERE (viewer_id = ?1 AND friend_id = ?2) OR (viewer_id = ?2 AND friend_id = ?1)').bind(userId, other),
  ]);
  return json({ ok: true });
}

/** A friend's shelf: only for accepted friends whose shelf isn't hidden, and only the fields friends may see. */
export async function friendBooks(ctx: Ctx, userId: string): Promise<Response> {
  const friendId = param(ctx, 0);
  const friend = await ctx.db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.shelf_visible FROM friendships f JOIN users u ON u.id = ?2
       WHERE f.pair_key = ?3 AND f.status = 'accepted'`,
    )
    .bind(userId, friendId, pairKey(userId, friendId))
    .first<{ id: string; username: string; display_name: string | null; shelf_visible: number }>();
  if (!friend) throw notFound('That shelf isn’t shared with you.');
  const person = { userId: friend.id, username: friend.username, displayName: friend.display_name, shelfVisible: !!friend.shelf_visible };
  if (!friend.shelf_visible) return json({ friend: person, books: [] });
  const { results } = await ctx.db
    .prepare('SELECT id, data FROM books WHERE user_id = ? AND deleted_at IS NULL ORDER BY seq')
    .bind(friend.id)
    .all<{ id: string; data: string }>();
  return json({ friend: person, books: results.map((b) => ({ id: b.id, ...JSON.parse(b.data) })) });
}
