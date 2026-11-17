import { Shelf } from '@/constants/theme';

import { byZoom, MAX_ZOOM, shelfMetrics, shelfZoom, ZOOM_FROM_WIDTH, ZOOM_FULL_WIDTH } from '../zoom';

describe('shelfZoom', () => {
  it('leaves phones at the normal size', () => {
    for (const width of [320, 375, 390, 430, ZOOM_FROM_WIDTH]) expect(shelfZoom(width)).toBe(1);
  });

  it('draws desktop windows half as big again, like zooming the page to 150%', () => {
    expect(MAX_ZOOM).toBe(1.5);
    for (const width of [ZOOM_FULL_WIDTH, 1280, 1440, 1920, 3840]) expect(shelfZoom(width)).toBe(1.5);
  });

  it('grows steadily in between, in steps of 0.05', () => {
    const widths = Array.from({ length: 50 }, (_, i) => ZOOM_FROM_WIDTH + ((ZOOM_FULL_WIDTH - ZOOM_FROM_WIDTH) * i) / 49);
    const zooms = widths.map(shelfZoom);
    zooms.slice(1).forEach((z, i) => expect(z).toBeGreaterThanOrEqual(zooms[i]));
    for (const z of zooms) expect(Math.round(z * 20)).toBeCloseTo(z * 20, 10);
    expect(shelfZoom((ZOOM_FROM_WIDTH + ZOOM_FULL_WIDTH) / 2)).toBe(1.25);
  });
});

describe('shelfMetrics', () => {
  it('is the theme at zoom 1 and scales every measurement with the zoom', () => {
    const normal = shelfMetrics(1);
    expect(normal).toEqual({ ...Shelf, rowHeight: Shelf.innerHeight + Shelf.plankTop + Shelf.plankFront });
    const big = shelfMetrics(1.5);
    for (const key of Object.keys(normal) as (keyof typeof normal)[]) expect(big[key]).toBeCloseTo(normal[key] * 1.5);
  });
});

describe('byZoom', () => {
  it('makes a value once per zoom', () => {
    const make = jest.fn((z: number) => ({ z }));
    const get = byZoom(make);
    expect(get(1.5)).toBe(get(1.5));
    expect(get(1)).not.toBe(get(1.5));
    expect(make).toHaveBeenCalledTimes(2);
  });
});
