import type { ReadStatus } from '@/types';

import { creases, ghostColors, MARKER_REACH, markerReach, spineCues } from '../spineCues';
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
  it('is the same for a book every time', () => {
    expect(creases(42)).toEqual(creases(42));
  });

  it('differs between books', () => {
    const layouts = new Set(Array.from({ length: 20 }, (_, id) => JSON.stringify(creases(id))));
    expect(layouts.size).toBe(20);
  });

  it('places two or three short, slightly sloped creases in order, inside the spine and clear of its ends', () => {
    for (let id = 0; id < 200; id++) {
      const list = creases(id);
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list.length).toBeLessThanOrEqual(3);
      list.forEach(({ at, strength, from, length, tilt }, i) => {
        expect(from).toBeGreaterThanOrEqual(0);
        expect(from + length).toBeLessThanOrEqual(1);
        expect(Math.abs(tilt)).toBeLessThanOrEqual(3);
        expect(at).toBeGreaterThan(0.18);
        expect(at).toBeLessThan(0.82);
        expect(strength).toBeGreaterThan(0);
        expect(strength).toBeLessThanOrEqual(1);
        if (i > 0) expect(at - list[i - 1].at).toBeGreaterThan(0.05);
      });
    }
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
