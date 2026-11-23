import type { SQLiteDatabase } from 'expo-sqlite';

import * as repo from '@/db/books';
import type { SyncBook } from '@shared/books';

import { api } from './api';

/** As many changes as the API takes in one request. */
const BATCH = 200;
/** A safety stop: 20 rounds is 4,000 changes sent and 10,000 received in one go; the rest waits for the next sync. */
const MAX_ROUNDS = 20;

interface SyncReply {
  cursor: number;
  changes: SyncBook[];
  more: boolean;
}

/**
 * One sync: send this device's changes and take in the account's, until both sides are up to date. The library on the
 * device stays the source of truth for the shelf; this only moves changes. Returns how many books changed here, and
 * the new cursor, which is saved after every round so an interrupted sync carries on where it stopped, and whether
 * everything was sent. `bulk` says the changes are a whole library sent after signing in, not news for friends.
 */
export async function syncLibrary(
  db: SQLiteDatabase,
  cursor: number,
  saveCursor: (cursor: number) => Promise<void>,
  bulk = false,
): Promise<{ changed: number; cursor: number; done: boolean }> {
  let changed = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const pending = await repo.pendingChanges(db, BATCH);
    const reply = await api<SyncReply>('POST', '/api/sync', { since: cursor, changes: pending, ...(bulk && pending.length ? { bulk: true } : {}) });
    changed += await repo.applyRemote(db, reply.changes);
    await repo.markSent(db, pending);
    await repo.purgeTombstones(db, false);
    cursor = reply.cursor;
    await saveCursor(cursor);
    if (!reply.more && pending.length < BATCH) return { changed, cursor, done: true };
  }
  return { changed, cursor, done: false };
}
