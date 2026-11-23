import type { Friend } from '../friends';
import { sortFriends } from '../friendSort';

const f = (username: string, extra: Partial<Friend> = {}): Friend => ({ userId: username, username, displayName: null, shelfVisible: true, ...extra });
const friends = [f('noor', { activeRank: 2 }), f('maja'), f('Elin', { activeRank: 1 }), f('tom'), f('aisha', { displayName: 'Zoë' })];
const names = (list: Friend[]) => list.map((x) => x.username);
const opts = { viewed: { tom: 300, maja: 100, noor: 200 }, sizes: { noor: 70, maja: 42, Elin: 26, tom: 1, aisha: 25 } };

describe('sortFriends', () => {
  it('puts the most recently active first, then the rest by name', () => {
    expect(names(sortFriends(friends, 'active', opts))).toEqual(['Elin', 'noor', 'maja', 'tom', 'aisha']);
  });
  it('puts the shelves you looked at most recently first', () => {
    expect(names(sortFriends(friends, 'viewed', opts))).toEqual(['tom', 'noor', 'maja', 'Elin', 'aisha']);
  });
  it('sorts by shelf size both ways', () => {
    expect(names(sortFriends(friends, 'size-desc', opts))).toEqual(['noor', 'maja', 'Elin', 'aisha', 'tom']);
    expect(names(sortFriends(friends, 'size-asc', opts))).toEqual(['tom', 'aisha', 'Elin', 'maja', 'noor']);
  });
  it('sorts by the name shown, ignoring case, both ways', () => {
    expect(names(sortFriends(friends, 'name-asc', opts))).toEqual(['Elin', 'maja', 'noor', 'tom', 'aisha']);
    expect(names(sortFriends(friends, 'name-desc', opts))).toEqual(['aisha', 'tom', 'noor', 'maja', 'Elin']);
  });
});
