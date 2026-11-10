import { fitSpineText, TITLE_SIZE } from '../spineText';
import { textWidth } from '../textWidth';

const box = (width: number, height: number, uppercase = false) => ({ width, height, font: 'serif' as const, uppercase });

describe('fitSpineText', () => {
  it('keeps a short title at full size, on one line, with the author', () => {
    const fit = fitSpineText('Dune', 'Frank Herbert', box(40, 190));
    expect(fit).toMatchObject({ lines: ['Dune'], numberOfLines: 1, fontSize: TITLE_SIZE.max, author: 'Herbert' });
  });

  it('wraps a long title onto a second line on a thick spine instead of cutting it off', () => {
    const fit = fitSpineText('Jonathan Strange & Mr Norrell', 'Susanna Clarke', box(82, 180));
    expect(fit.lines.length).toBeGreaterThan(1);
    expect(fit.lines.join(' ')).toBe('Jonathan Strange & Mr Norrell');
    expect(fit.numberOfLines).toBe(fit.lines.length);
  });

  it('shrinks the title on a thin spine, but not below the readable minimum', () => {
    const fit = fitSpineText('The Left Hand of Darkness', 'Ursula K. Le Guin', box(26, 175));
    expect(fit.fontSize).toBeGreaterThanOrEqual(TITLE_SIZE.min);
    expect(fit.lines.join(' ')).toBe('The Left Hand of Darkness');
  });

  it('drops the author before cutting the title off', () => {
    const fit = fitSpineText('The Murder of Roger Ackroyd', 'Agatha Christie', box(24, 150));
    expect(fit.author).toBeNull();
    expect(fit.lines.join(' ')).toBe('The Murder of Roger Ackroyd');
  });

  it('only cuts a title off when it cannot fit at the minimum size', () => {
    const title = 'An Extraordinarily Long Title That Keeps Going Well Past Any Sensible Length For A Book';
    const fit = fitSpineText(title, 'A. Writer', box(12, 140));
    expect(fit).toMatchObject({ lines: [title], fontSize: TITLE_SIZE.min, author: null });
  });

  it('never lets a line run longer than the spine', () => {
    for (const [title, width, height] of [
      ['Thinking, Fast and Slow', 42, 178],
      ['THE WAY OF KINGS', 82, 149],
      ['A Brief History of Time', 18, 195],
    ] as const) {
      const fit = fitSpineText(title, undefined, box(width, height, title === title.toUpperCase()));
      const letterSpacing = title === title.toUpperCase() ? 0.8 : 0.2;
      for (const line of fit.lines) expect(textWidth(line, fit.fontSize, { font: 'serif', letterSpacing })).toBeLessThanOrEqual(height - 28);
      expect(fit.lines.length * fit.fontSize * 1.15).toBeLessThanOrEqual(width - 4);
    }
  });
});
