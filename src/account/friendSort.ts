import Storage from 'expo-sqlite/kv-store';

import { friendName, type Friend } from './friends';

/**
 * How the Friends hallway orders friends' bookcases, chosen in its sort menu and kept on this device, and when you
 * last opened each friend's shelf here (for "Recently viewed"), which never leaves the device.
 */
export type FriendSort = 'active' | 'viewed' | 'size-desc' | 'size-asc' | 'name-asc' | 'name-desc';

export const FRIEND_SORTS: { sort: FriendSort; label: string }[] = [
  { sort: 'active', label: 'Recently active' },
  { sort: 'viewed', label: 'Recently viewed' },
  { sort: 'size-desc', label: 'Most books' },
  { sort: 'size-asc', label: 'Fewest books' },
  { sort: 'name-asc', label: 'Name, A–Z' },
  { sort: 'name-desc', label: 'Name, Z–A' },
];

export const DEFAULT_FRIEND_SORT: FriendSort = 'active';

const SORT_KEY = 'friends.sort';
const VIEWED_KEY = 'friends.viewed';

export async function loadFriendSort(): Promise<FriendSort> {
  try {
    const saved = await Storage.getItem(SORT_KEY);
    return FRIEND_SORTS.some((s) => s.sort === saved) ? (saved as FriendSort) : DEFAULT_FRIEND_SORT;
  } catch {
    return DEFAULT_FRIEND_SORT;
  }
}

export const saveFriendSort = (sort: FriendSort) => Storage.setItem(SORT_KEY, sort).catch(() => {});

/** When each friend's shelf was last opened on this device: user id → ms. */
export async function loadViewed(): Promise<Record<string, number>> {
  try {
    return JSON.parse((await Storage.getItem(VIEWED_KEY)) ?? '{}');
  } catch {
    return {};
  }
}

export async function markViewed(userId: string, at = Date.now()): Promise<void> {
  const viewed = await loadViewed();
  viewed[userId] = at;
  await Storage.setItem(VIEWED_KEY, JSON.stringify(viewed)).catch(() => {});
}

const byName = (a: Friend, b: Friend) => friendName(a).localeCompare(friendName(b), undefined, { sensitivity: 'base' }) || a.username.localeCompare(b.username);

/**
 * Friends in the chosen order. Ties, and friends with nothing to sort by (no news, never viewed), go by name, after the
 * rest. `sizes` is how many books each has on their shelf.
 */
export function sortFriends(friends: Friend[], sort: FriendSort, { viewed, sizes }: { viewed: Record<string, number>; sizes: Record<string, number> }): Friend[] {
  const last = Number.MAX_SAFE_INTEGER;
  const key = (f: Friend): number => {
    switch (sort) {
      case 'active':
        return f.activeRank ?? last;
      case 'viewed':
        return viewed[f.userId] != null ? -viewed[f.userId] : last;
      case 'size-desc':
        return -(sizes[f.userId] ?? 0);
      case 'size-asc':
        return sizes[f.userId] ?? 0;
      default:
        return 0;
    }
  };
  const sorted = [...friends].sort((a, b) => key(a) - key(b) || byName(a, b));
  return sort === 'name-desc' ? sorted.reverse() : sorted;
}
