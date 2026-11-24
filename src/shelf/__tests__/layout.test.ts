import { makeBook } from '@/test/makeBook';

import { arrangeShelves } from '../arrange';
import { SORT_LABELS, type ShelfGroup, type SortMode } from '../grouping';
import { BOOKEND_WIDTH, LABEL_MAX_WIDTH, labelPlateWidth, layoutShelves } from '../layout';
import { MARKER_REACH } from '../spineCues';

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

  it('leaves a gap before a pile for markers sticking out of its books, and none when there are none', () => {
    const stacks = (gs: ShelfGroup[]) =>
      layoutShelves(gs, { mode: 'row', shelfWidth: 300 })
        .flatMap((r) => r.items)
        .filter((i) => i.kind === 'stack');
    const plain = stacks(groups);
    const marked = stacks(groups.map((g) => ({ ...g, books: g.books.map((b) => ({ ...b, status: 'dnf' as const })) })));
    expect(marked.length).toBe(plain.length);
    plain.forEach((p, i) => {
      const m = marked[i];
      if (p.kind !== 'stack' || m.kind !== 'stack') return;
      expect(p.markerRoom).toBe(0);
      expect(m.markerRoom).toBeGreaterThan(MARKER_REACH.slip);
      expect(m.width).toBe(p.width + m.markerRoom);
    });
  });

  it('can lay a pile on a shelf in every sort, not just genre', () => {
    // A pile comes from a group of 5+ books, whatever sort made it. Each sort is tried on several libraries, since
    // whether a given group gets a pile depends on its key.
    const library = (seed: number) =>
      Array.from({ length: 120 }, (_, i) => {
        const n = i + seed * 1000;
        const month = String(1 + (n % 12)).padStart(2, '0');
        return makeBook({
          title: `${String.fromCharCode(65 + (n % 26))}itle ${n}`,
          authors: [`Author ${(n + seed) % 12}`],
          genres: [`Genre ${seed}-${n % 6}`],
          publishedYear: 1900 + ((n * 37) % 120),
          status: 'read',
          dateAdded: '2023-01-01',
          dateFinished: `2024-${month}-10`,
          statusChangedAt: `2024-${month}-02T00:00:00.000Z`,
          pageCount: 200 + ((n * 13) % 300),
        });
      });
    for (const sortMode of Object.keys(SORT_LABELS) as SortMode[]) {
      let piles = 0;
      for (let seed = 0; seed < 10; seed++) {
        for (const shelfWidth of [390, 900, 1300]) {
          piles += arrangeShelves(library(seed), { sortMode, layoutMode: 'row', shelfWidth, zoom: 1, gap: 1 })
            .flatMap((r) => r.items)
            .filter((i) => i.kind === 'stack').length;
        }
      }
      expect({ sortMode, piles: piles > 0 }).toEqual({ sortMode, piles: true });
    }
  });

  it('never stacks books in small groups', () => {
    const rows = layoutShelves([group('small', 3)], { mode: 'row', shelfWidth: 300 });
    expect(rows[0].items.every((i) => i.kind === 'spine')).toBe(true);
  });
});

describe('label plates', () => {
  // Many one-book groups with long names, like sorting by author: narrower than their labels.
  const names = ['Graphic Novels', 'History', 'Science & Nature', 'Biography & Memoir', 'Poetry', 'Philosophy', 'Psychology', 'Cooking'];
  const small = names.map((name) => ({ ...group(name, 1 + (name.length % 2)), label: name }));

  for (const mode of ['row', 'wrap'] as const) {
    it(`never overlap and stay on the shelf in ${mode} mode`, () => {
      const rows = layoutShelves(small, { mode, shelfWidth: 340, gap: 1 });
      expect(bookCount(rows)).toBe(small.reduce((n, g) => n + g.books.length, 0));
      for (const row of rows) {
        row.labels.forEach((label, i) => {
          expect(label.width).toBe(labelPlateWidth(label.label, label.count));
          const next = row.labels[i + 1];
          if (next) expect(next.x).toBeGreaterThanOrEqual(label.x + label.width);
          else expect(label.x + label.width).toBeLessThanOrEqual(340 + 6); // the last plate may use the spacing margin
        });
      }
    });
  }

  it('sizes plates to their text, longer names getting wider plates', () => {
    expect(labelPlateWidth('Biography & Memoir', 12)).toBeGreaterThan(labelPlateWidth('Poetry', 1));
    expect(labelPlateWidth('x'.repeat(200), 1)).toBe(LABEL_MAX_WIDTH + 6);
  });
});

describe('zoomed in', () => {
  const groups = [...Array.from({ length: 12 }, (_, i) => group(`g${i}`, 8 + i)), group('short', 2), group('Biography & Memoir', 1)];
  const marked = groups.map((g) => ({ ...g, books: g.books.map((b, i) => ({ ...b, status: i % 2 ? ('reading' as const) : ('dnf' as const) })) }));

  for (const mode of ['row', 'wrap'] as const) {
    it(`lays out a ${mode} bookcase 1.5 times as big exactly as the normal one, every size scaled`, () => {
      const normal = layoutShelves(marked, { mode, shelfWidth: 360, gap: 1 });
      const big = layoutShelves(marked, { mode, shelfWidth: 540, gap: 1.5, zoom: 1.5 });
      // The same books on the same shelves, in the same places.
      expect(big.map((r) => r.items.map((i) => i.key))).toEqual(normal.map((r) => r.items.map((i) => i.key)));
      big.forEach((row, r) => {
        expect(row.width).toBeCloseTo(normal[r].width * 1.5);
        row.labels.forEach((l, i) => {
          expect(l.x).toBeCloseTo(normal[r].labels[i].x * 1.5);
          expect(l.width).toBeCloseTo(normal[r].labels[i].width * 1.5);
        });
        row.items.forEach((it, i) => {
          const n = normal[r].items[i];
          expect(it.width).toBeCloseTo(n.width * 1.5);
          if (it.kind === 'bookend') expect(it.width).toBe(BOOKEND_WIDTH * 1.5);
          if (it.kind === 'spine' && n.kind === 'spine') expect(it.style.zoom).toBe(1.5);
          if (it.kind === 'stack' && n.kind === 'stack') {
            expect(it.height).toBeCloseTo(n.height * 1.5);
            expect(it.markerRoom).toBeCloseTo(n.markerRoom * 1.5);
          }
        });
      });
      expect(big.flatMap((r) => r.items).some((i) => i.kind === 'stack' && i.markerRoom > 0)).toBe(true);
    });
  }
});
