import { makeBook } from '@/test/makeBook';

import { applyChanges } from '../mergeBooks';

describe('applyChanges', () => {
  it('carries a saved status change, and its time, into the shelf in memory', () => {
    const dune = makeBook({ id: 1, title: 'Dune', status: 'owned', statusChangedAt: null });
    const emma = makeBook({ id: 2, title: 'Emma', status: 'owned', statusChangedAt: null });
    const saved = new Map([[1, { status: 'read' as const, dateFinished: '2026-01-02', statusChangedAt: '2026-01-02T08:00:00.000Z' }]]);
    const [a, b] = applyChanges([dune, emma], saved);
    expect(a).toMatchObject({ id: 1, status: 'read', statusChangedAt: '2026-01-02T08:00:00.000Z' });
    expect(b).toBe(emma);
  });

  it('leaves out removed books, such as duplicates merged into another', () => {
    const books = [makeBook({ id: 1 }), makeBook({ id: 2 }), makeBook({ id: 3 })];
    expect(applyChanges(books, new Map(), new Set([2])).map((b) => b.id)).toEqual([1, 3]);
  });
});
