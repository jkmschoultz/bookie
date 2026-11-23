import { splitBook, wins, type SyncBook } from '../../shared/books';
import type { Ctx } from '../context';
import { badRequest, json, readJson } from '../http';
import { syncChanges } from '../validate';
import { activityStatements, type StoredBook } from './activity';

/**
 * POST /api/sync { since, changes, bulk? } → { cursor, changes, more }
 *
 * The device sends what changed on it, and gets back everything that changed in the account since `since` (its last
 * cursor), its own changes included. Each book keeps whichever version is newest (`wins`). Changes are numbered per
 * user (users.seq) as they're stored, in one transaction, so a device that asks for "after n" never misses one.
 * Books added, started or finished are news for friends (see activity.ts), except while a device sends its whole
 * library after signing in (`bulk`).
 */

export const MAX_CHANGES = 200;
export const PAGE = 500;

interface BookRow {
  id: string;
  data: string;
  private_data: string;
  updated_at: number;
  deleted_at: number | null;
  seq: number;
}

function toSyncBook(r: BookRow): SyncBook {
  return {
    id: r.id,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    book: r.deleted_at == null ? { ...JSON.parse(r.data), ...JSON.parse(r.private_data) } : null,
  };
}

export async function sync(ctx: Ctx, userId: string): Promise<Response> {
  const body = await readJson(ctx.request, 2_000_000);
  const since = body.since ?? 0;
  if (typeof since !== 'number' || !Number.isSafeInteger(since) || since < 0) throw badRequest('Invalid cursor.');
  const changes = syncChanges(body.changes, ctx.now, MAX_CHANGES);
  const bulk = body.bulk === true;

  let lost: string[] = [];
  if (changes.length) {
    const ids = JSON.stringify(changes.map((c) => c.id));
    const { results: current } = await ctx.db
      .prepare(
        `SELECT id, updated_at, deleted_at, json_extract(data, '$.status') AS status, (SELECT shelf_visible FROM users WHERE id = ?1) AS visible
         FROM books WHERE user_id = ?1 AND id IN (SELECT value FROM json_each(?2))`,
      )
      .bind(userId, ids)
      .all<{ id: string; updated_at: number; deleted_at: number | null; status: string | null; visible: number }>();
    const stored = new Map<string, StoredBook>(current.map((r) => [r.id, { updatedAt: r.updated_at, deleted: r.deleted_at != null, status: r.status }]));
    const winners = changes.filter((c) => wins(c, stored.get(c.id)));
    lost = changes.filter((c) => !wins(c, stored.get(c.id))).map((c) => c.id);
    if (winners.length) {
      const rows = winners.map((c) => {
        const { shared, personal } = c.book ? splitBook(c.book) : { shared: {}, personal: {} };
        return { id: c.id, data: JSON.stringify(shared), personal: JSON.stringify(personal), updatedAt: c.updatedAt, deletedAt: c.deletedAt };
      });
      // Number them after the user's last seq, and store them, in one transaction. The WHERE keeps a newer version that
      // arrived from another device between the read above and this write.
      const visible = current.length
        ? !!current[0].visible
        : !!(await ctx.db.prepare('SELECT shelf_visible FROM users WHERE id = ?').bind(userId).first<{ shelf_visible: number }>())?.shelf_visible;
      await ctx.db.batch([
        ...activityStatements(ctx, userId, winners, stored, { bulk, visible }),
        ctx.db.prepare('UPDATE users SET seq = seq + ? WHERE id = ?').bind(rows.length, userId),
        ctx.db
          .prepare(
            `INSERT INTO books (user_id, id, data, private_data, updated_at, deleted_at, seq)
             SELECT ?1, json_extract(j.value, '$.id'), json_extract(j.value, '$.data'), json_extract(j.value, '$.personal'),
                    json_extract(j.value, '$.updatedAt'), json_extract(j.value, '$.deletedAt'),
                    (SELECT seq FROM users WHERE id = ?1) - ?2 + 1 + j.key
             FROM json_each(?3) AS j WHERE true
             ON CONFLICT(user_id, id) DO UPDATE SET
               data = excluded.data, private_data = excluded.private_data, updated_at = excluded.updated_at,
               deleted_at = excluded.deleted_at, seq = excluded.seq
             WHERE excluded.updated_at > books.updated_at`,
          )
          .bind(userId, rows.length, JSON.stringify(rows)),
      ]);
    }
  }

  const { results } = await ctx.db
    .prepare('SELECT id, data, private_data, updated_at, deleted_at, seq FROM books WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ?')
    .bind(userId, since, PAGE + 1)
    .all<BookRow>();
  const more = results.length > PAGE;
  const page = results.slice(0, PAGE);
  const out = page.map(toSyncBook);
  // A change that lost to a newer version the device has already been sent: send that version again, so the device
  // doesn't keep its older one.
  const sent = new Set(page.map((r) => r.id));
  const resend = lost.filter((id) => !sent.has(id));
  if (resend.length) {
    const { results: again } = await ctx.db
      .prepare('SELECT id, data, private_data, updated_at, deleted_at, seq FROM books WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))')
      .bind(userId, JSON.stringify(resend))
      .all<BookRow>();
    out.push(...again.map(toSyncBook));
  }
  const cursor = page.length ? page[page.length - 1].seq : since;
  return json({ cursor, changes: out, more });
}
