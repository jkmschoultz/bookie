import type { ReadStatus } from '@/types';

import { CREASE_LANES, CREASE_ZONE, creases, ghostColors, MARKER_REACH, markerReach, MAX_CREASE_SEGMENTS, spineCues, type CreaseSegment } from '../spineCues';
import { UNOWNED_OPACITY } from '../spineStyle';

const STATUSES: ReadStatus[] = ['reading', 'read', 'owned', 'want', 'dnf'];
const MARKS = ['ribbon', 'creases', 'sheen', 'ghost', 'slip'] as const;

describe('spineCues', () => {
  it('gives each status its own cue', () => {
    expect(spineCues({ status: 'reading', owned: true })).toMatchObject({ ribbon: true, creases: false, sheen: false });
    expect(spineCues({ status: 'read', owned: true })).toMatchObject({ creases: true, ribbon: false, sheen: false });
    expect(spineCues({ status: 'owned', owned: true })).toMatchObject({ sheen: true, tab: false, creases: false });
    expect(spineCues({ status: 'dnf', owned: true })).toMatchObject({ slip: true, ribbon: false, creases: false });
  });

  it('never gives two statuses the same look', () => {
    const looks = STATUSES.flatMap((status) =>
      [true, false].map((owned) => {
        const c = spineCues({ status, owned });
        return JSON.stringify([...MARKS.map((m) => c[m]), c.tab, c.opacity]);
      }),
    );
    expect(new Set(looks).size).toBe(looks.length);
  });

  it('draws a wanted book you own as unread with a tab, and one you don\'t as a ghost', () => {
    expect(spineCues({ status: 'want', owned: true })).toMatchObject({ sheen: true, tab: true, ghost: false, opacity: 1 });
    expect(spineCues({ status: 'want', owned: false })).toMatchObject({ ghost: true, sheen: false, tab: false });
  });

  it('fades books you don\'t own, except a ghost', () => {
    for (const status of STATUSES) {
      expect(spineCues({ status, owned: true }).opacity).toBe(1);
      expect(spineCues({ status, owned: false }).opacity).toBe(status === 'want' ? 1 : UNOWNED_OPACITY);
    }
  });
});

describe('markerReach', () => {
  it('is how far the ribbon, tab or slip sticks out, and 0 without one', () => {
    expect(markerReach({ status: 'reading', owned: false })).toBe(MARKER_REACH.ribbon);
    expect(markerReach({ status: 'want', owned: true })).toBe(MARKER_REACH.tab);
    expect(markerReach({ status: 'dnf', owned: true })).toBe(MARKER_REACH.slip);
    expect(markerReach({ status: 'read', owned: true })).toBe(0);
    expect(markerReach({ status: 'want', owned: false })).toBe(0);
  });
});

describe('creases', () => {
  const SIZES = [
    [12, 132],
    [18, 160],
    [26, 180],
    [40, 200],
    [82, 212],
  ] as const;
  const each = (check: (list: CreaseSegment[][], width: number, height: number, id: number) => void) => {
    for (const [width, height] of SIZES) for (let id = 0; id < 200; id++) check(creases(id, width, height), width, height, id);
  };

  it('is the same for a book every time', () => {
    expect(creases(42, 26, 180)).toEqual(creases(42, 26, 180));
  });

  it('differs between books', () => {
    const layouts = new Set(Array.from({ length: 20 }, (_, id) => JSON.stringify(creases(id, 40, 200))));
    expect(layouts.size).toBe(20);
  });

  it('draws one to three creases in a few pieces, fewer on a thin spine', () => {
    each((list, width) => {
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.length).toBeLessThanOrEqual(width < 20 ? 1 : width < 34 ? 2 : 3);
      list.forEach((crease) => expect(crease.length).toBeGreaterThanOrEqual(1));
      expect(list.flat().length).toBeLessThanOrEqual(MAX_CREASE_SEGMENTS);
    });
    const counts = new Set(Array.from({ length: 200 }, (_, id) => creases(id, 60, 200).length));
    expect([...counts].sort()).toEqual([1, 2, 3]);
  });

  it('runs down the spine, clear of its ends and either side of the title in the middle', () => {
    each((list, width, height) => {
      for (const { x1, y1, x2, y2, strength } of list.flat()) {
        for (const x of [x1, x2]) {
          expect(x).toBeGreaterThanOrEqual(CREASE_LANES.from * width - 1e-9);
          expect(x).toBeLessThanOrEqual(CREASE_LANES.to * width + 1e-9);
          expect(Math.abs(x / width - 0.5)).toBeGreaterThanOrEqual(CREASE_LANES.centre - 1e-9);
        }
        for (const y of [y1, y2]) {
          expect(y).toBeGreaterThanOrEqual(CREASE_ZONE.from * height - 1e-9);
          expect(y).toBeLessThanOrEqual(CREASE_ZONE.to * height + 1e-9);
        }
        // Along the spine, wandering only slightly sideways.
        expect(y2).toBeGreaterThan(y1);
        expect(Math.abs(x2 - x1)).toBeLessThan((y2 - y1) * 0.25 + 2.5);
        expect(strength).toBeGreaterThan(0);
        expect(strength).toBeLessThanOrEqual(1);
      }
    });
  });

  it('makes each crease one line top to bottom, joined unless it breaks off, fading where it starts and stops', () => {
    each((list) => {
      for (const crease of list) {
        expect(crease[0].fadeStart).toBe(true);
        expect(crease[crease.length - 1].fadeEnd).toBe(true);
        crease.slice(1).forEach((piece, j) => {
          const before = crease[j];
          expect(piece.x1).toBe(before.x2);
          expect(piece.y1).toBeGreaterThanOrEqual(before.y2);
          // A break fades out on both sides of it; a bend doesn't.
          expect(piece.fadeStart).toBe(before.fadeEnd);
          expect(piece.fadeStart).toBe(piece.y1 > before.y2);
        });
      }
    });
  });

  it('starts with a long crease through the middle of the spine, longer than the others', () => {
    each((list, width, height) => {
      const span = (crease: CreaseSegment[]) => crease[crease.length - 1].y2 - crease[0].y1;
      const [main, ...rest] = list;
      expect(span(main)).toBeGreaterThan(0.4 * height);
      expect(main[0].y1).toBeLessThan(height / 2);
      expect(main[main.length - 1].y2).toBeGreaterThan(height / 2);
      for (const crease of rest) expect(span(crease)).toBeLessThan(span(main));
    });
  });

  it('never puts two creases on the same line across the spine', () => {
    each((list) => {
      const xs = list.map((crease) => crease[0].x1);
      expect(new Set(xs.map((x) => x.toFixed(3))).size).toBe(xs.length);
    });
  });
});

describe('ghostColors', () => {
  it('outlines in the spine colour', () => {
    expect(ghostColors('#2e5c8a').outline).toBe('#2e5c8a');
  });

  it('lifts a near-black outline so it shows on the dark shelf', () => {
    expect(ghostColors('#1c1c1c').outline).not.toBe('#1c1c1c');
  });

  it('sets the title light, since the see-through fill is dark even for a pale book', () => {
    expect(ghostColors('#e8e0cf').text).toBe('#f4ecd8');
    expect(ghostColors('#1f3a5f').text).toBe('#f4ecd8');
  });
});
