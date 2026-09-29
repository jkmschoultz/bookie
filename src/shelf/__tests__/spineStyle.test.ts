import { makeBook } from '@/test/makeBook';

import { contrastText, getSpineStyle, SPINE, spineHeight, spineWidth } from '../spineStyle';

describe('spineWidth', () => {
  it('grows with page count', () => {
    expect(spineWidth(900)).toBeGreaterThan(spineWidth(300));
    expect(spineWidth(300)).toBeGreaterThan(spineWidth(100));
  });

  it('is roughly proportional in the normal range', () => {
    expect(spineWidth(600) / spineWidth(300)).toBeCloseTo(2, 0);
  });

  it('clamps very thin and very thick books', () => {
    expect(spineWidth(10)).toBe(SPINE.minWidth);
    expect(spineWidth(5000)).toBe(SPINE.maxWidth);
  });

  it('uses a default when page count is unknown', () => {
    expect(spineWidth(null)).toBe(spineWidth(SPINE.defaultPages));
  });
});

describe('spineHeight', () => {
  it('uses the physical height when known', () => {
    const tall = spineHeight(makeBook({ heightMm: 240 }));
    const short = spineHeight(makeBook({ heightMm: 178 }));
    expect(tall).toBeGreaterThan(short);
  });

  it('is deterministic and within bounds when unknown', () => {
    const book = makeBook({ isbn13: '9780547928227' });
    expect(spineHeight(book)).toBe(spineHeight({ ...book }));
    expect(spineHeight(book)).toBeGreaterThanOrEqual(SPINE.minHeight);
    expect(spineHeight(book)).toBeLessThanOrEqual(SPINE.maxHeight);
  });
});

describe('getSpineStyle', () => {
  it('honours a custom spine colour', () => {
    expect(getSpineStyle(makeBook({ spineColor: '#123456' })).color).toBe('#123456');
  });

  it('picks readable text colours', () => {
    expect(contrastText('#f5f0e1')).toBe('#1d1a16');
    expect(contrastText('#1c1c1c')).toBe('#f4ecd8');
  });
});
