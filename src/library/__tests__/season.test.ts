import { firstAdvent, getSeason, previewSeason } from '../season';

const on = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe('getSeason', () => {
  it('finds the first Sunday of Advent', () => {
    expect(firstAdvent(2026)).toEqual([11, 29]);
    expect(firstAdvent(2027)).toEqual([11, 28]);
    expect(firstAdvent(2028)).toEqual([12, 3]);
    expect(firstAdvent(2022)).toEqual([11, 27]);
    expect(firstAdvent(2029)).toEqual([12, 2]);
  });

  it('is Christmas from the first Sunday of Advent to 6 January, inclusive', () => {
    expect(getSeason(on(2027, 11, 27, 23))).toBeNull();
    expect(getSeason(on(2027, 11, 28, 0))).toBe('christmas');
    expect(getSeason(on(2028, 12, 2, 23))).toBeNull();
    expect(getSeason(on(2028, 12, 3, 0))).toBe('christmas');
    expect(getSeason(on(2026, 12, 1, 0))).toBe('christmas');
    expect(getSeason(on(2026, 12, 24))).toBe('christmas');
    expect(getSeason(on(2026, 12, 31, 23))).toBe('christmas');
    expect(getSeason(on(2027, 1, 1, 0))).toBe('christmas');
    expect(getSeason(on(2027, 1, 6, 23))).toBe('christmas');
    expect(getSeason(on(2027, 1, 7, 0))).toBeNull();
  });

  it('started early in 2026, on 22 November', () => {
    expect(getSeason(on(2026, 11, 21, 23))).toBeNull();
    expect(getSeason(on(2026, 11, 22, 0))).toBe('christmas');
    expect(getSeason(on(2027, 1, 6, 23))).toBe('christmas');
  });

  it('is no season the rest of the year', () => {
    for (const [m, d] of [[2, 14], [6, 21], [10, 31], [11, 22]]) expect(getSeason(on(2027, m, d))).toBeNull();
  });

  it('goes by the device’s own date', () => {
    // Local midnight starting the first Sunday of Advent, whatever the time zone.
    expect(getSeason(new Date(2027, 10, 28))).toBe('christmas');
  });
});

describe('previewSeason', () => {
  const at = (hostname: string, search: string) => ({ hostname, search });

  it('previews a season on previews, staging and locally', () => {
    expect(previewSeason(at('abc123.mybookie.pages.dev', '?season=christmas'))).toBe('christmas');
    expect(previewSeason(at('staging.mybookie.pages.dev', '?season=none'))).toBeNull();
    expect(previewSeason(at('localhost', '?x=1&season=christmas'))).toBe('christmas');
  });

  it('is ignored on the live site, and for anything else', () => {
    expect(previewSeason(at('mybookie.pages.dev', '?season=christmas'))).toBeUndefined();
    expect(previewSeason(at('master.mybookie.pages.dev', '?season=christmas'))).toBeUndefined();
    expect(previewSeason(at('master.mybookie.pages.dev', '?season=none'))).toBeUndefined();
    expect(previewSeason(at('localhost', '?season=easter'))).toBeUndefined();
    expect(previewSeason(at('localhost', ''))).toBeUndefined();
    expect(previewSeason(null)).toBeUndefined();
  });
});
