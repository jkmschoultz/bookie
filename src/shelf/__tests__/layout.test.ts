import { makeBook } from '@/test/makeBook';

import type { ShelfGroup } from '../grouping';
import { layoutShelves } from '../layout';

function group(key: string, n: number, pages = 300): ShelfGroup {
  return { key, label: key, books: Array.from({ length: n }, (_, i) => makeBook({ title: `${key} ${i}`, pageCount: pages })) };
}

const bookCount = (rows: ReturnType<typeof layoutShelves>) =>
  rows.flatMap((r) => r.items).reduce((n, it) => n + (it.kind === 'stack' ? it.books.length : it.kind === 'spine' ? 1 : 0), 0);

describe('layoutShelves', () => {
  const groups = Array.from({ length: 12 }, (_, i) => group(`g${i}`, 8 + i));

  it('gives each wide group its own swipeable row in row mode and never drops books', () => {
    const rows = layoutShelves(groups, { mode: 'row', shelfWidth: 150 });
    expect(rows).toHaveLength(groups.length);
    expect(rows.every((r) => r.labels.length === 1 && r.width > 150)).toBe(true);
    expect(bookCount(rows)).toBe(groups.reduce((n, g) => n + g.books.length, 0));
  });

  it('packs narrow groups together in row mode without splitting them', () => {
    const mixed = [group('a', 2), group('b', 3), group('wide', 30), group('c', 2)];
    const rows = layoutShelves(mixed, { mode: 'row', shelfWidth: 300, gap: 1 });
    expect(rows.map((r) => r.labels.map((l) => l.label))).toEqual([['a', 'b'], ['wide'], ['c']]);
  });

  it('wraps groups across rows without exceeding the shelf width', () => {
    const rows = layoutShelves(groups, { mode: 'wrap', shelfWidth: 200, gap: 1 });
    expect(rows.length).toBeGreaterThan(1);
    for (const r of rows) {
      if (r.items.length > 1) expect(r.width).toBeLessThanOrEqual(200);
    }
    expect(bookCount(rows)).toBe(groups.reduce((n, g) => n + g.books.length, 0));
  });

  it('labels each group once, where it starts, in wrap mode', () => {
    const rows = layoutShelves([group('solo', 20)], { mode: 'wrap', shelfWidth: 150 });
    expect(rows[0].labels).toEqual([expect.objectContaining({ label: 'solo', x: 0 })]);
    expect(rows.slice(1).every((r) => r.labels.length === 0)).toBe(true);
  });

  it('packs small groups onto a shared shelf separated by bookends', () => {
    const small = [group('a', 2), group('b', 2), group('c', 2)];
    const rows = layoutShelves(small, { mode: 'wrap', shelfWidth: 400, gap: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0].labels.map((l) => l.label)).toEqual(['a', 'b', 'c']);
    expect(rows[0].items.filter((i) => i.kind === 'bookend')).toHaveLength(2);
    // Each label sits under its group's first book.
    const firstB = rows[0].items.findIndex((i) => i.kind === 'spine' && i.book.title === 'b 0');
    const x = rows[0].items.slice(0, firstB).reduce((w, i) => w + i.width + 1, 0);
    expect(rows[0].labels[1].x).toBe(x);
  });

  it('lays some books flat in stacks, deterministically', () => {
    const a = layoutShelves(groups, { mode: 'row', shelfWidth: 300 });
    const b = layoutShelves(groups, { mode: 'row', shelfWidth: 300 });
    expect(a.map((r) => r.items.map((i) => i.key))).toEqual(b.map((r) => r.items.map((i) => i.key)));
    const stacks = a.flatMap((r) => r.items).filter((i) => i.kind === 'stack');
    expect(stacks.length).toBeGreaterThan(0);
    for (const s of stacks) if (s.kind === 'stack') expect(s.height).toBeLessThanOrEqual(110);
  });

  it('never stacks books in small groups', () => {
    const rows = layoutShelves([group('small', 3)], { mode: 'row', shelfWidth: 300 });
    expect(rows[0].items.every((i) => i.kind === 'spine')).toBe(true);
  });
});
