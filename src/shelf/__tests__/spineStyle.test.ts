import { makeBook } from '@/test/makeBook';

import { contrastText, DECORATION, getSpineStyle, SPINE, spineHeight, spineWidth } from '../spineStyle';

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

  it('takes its colour from the cover', () => {
    const style = getSpineStyle(makeBook({ coverPalette: ['#1f3a5f'] }));
    expect(style.color).toBe('#1f3a5f');
    expect(style.accentColor).toBe('#d4af61'); // no second colour: the usual gilt accent
  });

  it('shows a second cover colour as a band, bands or frame', () => {
    for (let i = 0; i < 20; i++) {
      const style = getSpineStyle(makeBook({ title: `Book ${i}`, coverPalette: ['#1f3a5f', '#e8c875'] }));
      expect(style.color).toBe('#1f3a5f');
      expect(style.accentColor).toBe('#e8c875');
      expect(['band', 'bands', 'frame']).toContain(style.decoration);
    }
  });

  it('lets a custom spine colour override the cover', () => {
    const style = getSpineStyle(makeBook({ spineColor: '#123456', coverPalette: ['#1f3a5f', '#e8c875'] }));
    expect(style.color).toBe('#123456');
    expect(style.accentColor).not.toBe('#e8c875');
  });

  it('falls back to a generated colour when the cover gave nothing', () => {
    const book = makeBook({ isbn13: '9780547928227' });
    expect(getSpineStyle({ ...book, coverPalette: [] }).color).toBe(getSpineStyle({ ...book, coverPalette: null }).color);
  });

  it('sets the text clear of every decoration', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const s = getSpineStyle(makeBook({ title: `Book ${i}`, coverPalette: i % 2 ? ['#1f3a5f', '#e8c875'] : null }));
      seen.add(s.decoration);
      const gap = 8;
      if (s.decoration === 'band') expect(s.text.start).toBeGreaterThanOrEqual(DECORATION.band.top + DECORATION.band.height + gap);
      if (s.decoration === 'bands') {
        expect(s.text.start).toBeGreaterThanOrEqual(DECORATION.bands.inner + 1 + gap);
        expect(s.text.end).toBeGreaterThanOrEqual(DECORATION.bands.inner + 1 + gap);
      }
      if (s.decoration === 'frame') expect(Math.min(s.text.start, s.text.end)).toBeGreaterThan(DECORATION.frame + gap);
    }
    expect(seen.size).toBe(5);
  });

  it('picks readable text colours', () => {
    expect(contrastText('#f5f0e1')).toBe('#1d1a16');
    expect(contrastText('#1c1c1c')).toBe('#f4ecd8');
  });
});
