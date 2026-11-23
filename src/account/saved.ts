import Storage from 'expo-sqlite/kv-store';

import type { AccountSummary } from '@shared/account';

/** What this device remembers about its account between launches. */
export interface Saved {
  /** The signed-in account, to show while offline. null when signed out. */
  account: AccountSummary | null;
  /** Whether this device's library syncs with the account. Off keeps you signed in, for friends, without syncing. */
  syncEnabled: boolean;
  /**
   * The account this device's library was last synced with, kept after signing out so signing back in only sends
   * what changed since. Signing in to a different account sends the whole library to it.
   */
  linkedUserId: string | null;
  /** How far through the account's changes this device is (see POST /api/sync). */
  cursor: number;
  lastSyncedAt: number | null;
  /**
   * Set while this device is sending its whole library to an account after signing in, so the account doesn't tell
   * friends about every book as if it were new (see POST /api/sync, bulk). Cleared once a sync has sent it all.
   */
  bulk?: boolean;
}

export const NOTHING_SAVED: Saved = { account: null, syncEnabled: true, linkedUserId: null, cursor: 0, lastSyncedAt: null, bulk: false };

const KEY = 'account';

/**
 * Rejects if storage can't be read (e.g. another tab holds the library): that is not "nothing saved", and saving over
 * it would wipe the account link and sync position. Only unreadable contents (not JSON) count as nothing saved.
 */
export async function loadSaved(): Promise<Saved> {
  const raw = await Storage.getItem(KEY);
  let stored: unknown;
  try {
    stored = JSON.parse(raw ?? '{}');
  } catch {
    return NOTHING_SAVED;
  }
  return { ...NOTHING_SAVED, ...(stored as Partial<Saved>) };
}

export const storeSaved = (saved: Saved) => Storage.setItem(KEY, JSON.stringify(saved));
