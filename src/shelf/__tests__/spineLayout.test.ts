import { makeBook } from '@/test/makeBook';
import type { Book } from '@/types';

import { contrastRatio, decorationBoxes, mix, MIN_CONTRAST, ornamentsClear, overlaps, textBoxes } from '../spineBoxes';
import { creases, ghostColors, spineCues } from '../spineCues';
import { getSpineLook, getSpineStyle, LABEL_WASH, type SpineStyle } from '../spineStyle';

/** Titles of every shape: short, long, one long word, all capitals, and the book that started this. */
const TITLES = [
  'The Cat in the Hat',
  'Dune',
  'It',
  'Piranesi',
  'The Hobbit',
  'Jonathan Strange & Mr Norrell',
  'The Curious Incident of the Dog in the Night-Time',
  'One Hundred Years of Solitude',
  'Supercalifragilisticexpialidocious',
  'WAR AND PEACE',
  'A Brief History of Time: From the Big Bang to Black Holes',
  'Les Misérables',
  'Ægir & the Ölfus',
  'MMMMMMMMMMMMMMMM WWWWWWWW',
];
const AUTHORS = [['Dr. Seuss'], ['Frank Herbert'], ['Stephen King'], ['Susanna Clarke'], ['Gabriel García Márquez'], ['Ursula K. Le Guin'], [], ['A. N. Extraordinarily-Longsurname']];
const PAGES = [null, 24, 61, 72, 140, 300, 520, 900, 2400];
const HEIGHTS = [null, 150, 178, 236, 280];
/** Cover colours: light, dark and the mid-tones where neither ink nor cream text is enough on its own. */
const PALETTES: (string[] | null)[] = [
  null,
  ['#f2efe8', '#c8312b'],
  ['#c8312b', '#f2efe8'],
  ['#ffffff'],
  ['#000000', '#ffffff'],
  ['#808080'],
  ['#c4622d'],
  ['#5b7fa6', '#e3c27a'],
  ['#d89a3b', '#1f3a5f'],
  ['#6b8f5e'],
  ['#e3c27a', '#9b2226'],
  ['#2e5c8a', '#2e5c8b'],
];

function* books(): Generator<Book> {
  let n = 0;
  for (const title of TITLES)
    for (const authors of AUTHORS)
      for (const pageCount of PAGES) {
        n++;
        const heightMm = HEIGHTS[n % HEIGHTS.length];
        const coverPalette = PALETTES[n % PALETTES.length];
        yield makeBook({ title, authors, pageCount, heightMm, coverPalette, isbn13: n % 3 ? null : `978${String(n).padStart(10, '0')}` });
        // The same book with a colour of its own, and in other states.
        if (n % 5 === 0) yield makeBook({ title, authors, pageCount, heightMm, spineColor: PALETTES[(n + 3) % PALETTES.length]?.[0] ?? '#777777' });
      }
}

const scales = [1, 0.62];

/** Every background the text is set on: the spine, and the label's wash behind the title. */
const backgrounds = (s: SpineStyle) => (s.decoration === 'label' ? [s.color, mix(s.color, LABEL_WASH.color, LABEL_WASH.opacity)] : [s.color]);

describe('generated spines', () => {
  const all: { book: Book; style: SpineStyle }[] = [];
  for (const book of books()) for (const scale of scales) all.push({ book, style: getSpineStyle(book, scale) });

  it('cover plenty of cases', () => {
    expect(all.length).toBeGreaterThan(2000);
    expect(new Set(all.map((s) => s.style.decoration)).size).toBe(5);
  });

  it('never draw an ornament over the title or author', () => {
    const bad = all.filter(({ style: s }) => !ornamentsClear(s.decoration, s.width, s.height, s.text));
    expect(bad.map(({ book, style }) => `${book.title} ${style.width}×${style.height} ${style.decoration}`)).toEqual([]);
    // And checked box by box, not only through ornamentsClear.
    for (const { style: s } of all.slice(0, 400)) {
      const words = textBoxes(s.width, s.height, s.text);
      for (const o of decorationBoxes(s.decoration, s.width, s.height, s.text)) for (const t of words) expect(overlaps(o, t)).toBe(false);
    }
  });

  it('keep the text on the spine', () => {
    for (const { style: s } of all)
      for (const t of textBoxes(s.width, s.height, s.text)) {
        expect(t.x).toBeGreaterThanOrEqual(-0.01);
        expect(t.x + t.w).toBeLessThanOrEqual(s.width + 0.01);
        expect(t.y).toBeGreaterThanOrEqual(0);
        expect(t.y + t.h).toBeLessThanOrEqual(s.height);
      }
  });

  it('keep the title and author apart', () => {
    for (const { style: s } of all) {
      const [title, author] = textBoxes(s.width, s.height, s.text);
      if (author) expect(overlaps(title, author)).toBe(false);
    }
  });

  it(`set text with at least ${MIN_CONTRAST}:1 contrast on everything behind it`, () => {
    const bad = all.filter(({ style: s }) => backgrounds(s).some((bg) => contrastRatio(s.textColor, bg) < MIN_CONTRAST));
    expect(bad.map(({ style: s }) => `${s.color} ${s.textColor} ${s.decoration}`)).toEqual([]);
  });

  it('keep a read book’s creases off the text', () => {
    for (const { book, style: s } of all.slice(0, 600)) {
      const words = textBoxes(s.width, s.height, s.text);
      for (const piece of creases(book.id, s.width, s.height, s.textBoxes).flat()) {
        const span = { x: Math.min(piece.x1, piece.x2), y: piece.y1, w: Math.abs(piece.x2 - piece.x1), h: piece.y2 - piece.y1 };
        for (const t of words) expect(overlaps(span, t)).toBe(false);
      }
    }
  });

  it('give wanted books you don’t own (ghosts) readable titles too', () => {
    for (const { style: s } of all.slice(0, 600)) {
      const ghost = ghostColors(s.color);
      expect(ghost.text).toMatch(/^#/);
    }
    for (const colour of ['#ffffff', '#808080', '#c4622d', '#1c1c1c', '#e3c27a', '#5b7fa6']) {
      const { text } = ghostColors(colour);
      const fill = mix('#2c1d12', colour, 0.35);
      expect(contrastRatio(text, fill)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
    expect(spineCues({ status: 'want', owned: false }).ghost).toBe(true);
  });
});

describe('The Cat in the Hat by Dr. Seuss', () => {
  // A thin picture book (61 pages, so a 12px spine) whose cover is white and red. Spines like it got an inset frame
  // whose sides ran straight through the 8px title, and a mid-tone orange (#c4622d) with cream text below 4.5:1.
  const cases = [null, ['#f2efe8', '#c8312b'], ['#c8312b', '#f2efe8'], ['#ffffff'], ['#c4622d']].flatMap((coverPalette) =>
    [null, '9780394800011', '9780007158447'].map((isbn13) => makeBook({ title: 'The Cat in the Hat', authors: ['Dr. Seuss'], pageCount: 61, coverPalette, isbn13 })),
  );

  it('has no frame or label on its thin spine any more, and nothing touches its title', () => {
    for (const book of cases) {
      const s = getSpineStyle(book);
      expect(s.width).toBe(12);
      expect(['frame', 'label']).not.toContain(s.decoration);
      expect(ornamentsClear(s.decoration, s.width, s.height, s.text)).toBe(true);
    }
  });

  it('keeps a frame on a thicker edition, where the title fits inside it', () => {
    const thick = getSpineStyle(makeBook({ title: 'The Cat in the Hat', authors: ['Dr. Seuss'], pageCount: 300, coverPalette: ['#f2efe8', '#c8312b'] }));
    expect(thick.decoration).toBe('frame');
    expect(ornamentsClear(thick.decoration, thick.width, thick.height, thick.text)).toBe(true);
  });

  it('reads clearly', () => {
    for (const book of cases) {
      const s = getSpineStyle(book);
      expect(contrastRatio(s.textColor, s.color)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
});

describe('getSpineLook', () => {
  it('gives the same size, colours and ornament as getSpineStyle', () => {
    let n = 0;
    for (const book of books())
      for (const scale of [1, 0.62]) {
        const { width, height, color, accentColor, decoration } = getSpineStyle(book, scale);
        expect(getSpineLook(book, scale)).toEqual({ width, height, color, accentColor, decoration });
        n++;
      }
    expect(n).toBeGreaterThan(2000);
  });
});
