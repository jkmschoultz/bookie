import { makeBook } from '@/test/makeBook';

import { hallwayShelves, MAX_HALLWAY_BOOKS } from '../hallwayShelves';

const ROOM = 132;
const SCALE = 0.28;

describe('hallwayShelves', () => {
  it('puts a lone book on the top shelf, leaning, and leaves the rest empty', () => {
    const book = makeBook({ title: 'The Cat in the Hat', authors: ['Dr. Seuss'] });
    const shelves = hallwayShelves([book], 7, ROOM, SCALE);
    expect(shelves).toHaveLength(7);
    expect(shelves[0].spines.map((s) => s.key)).toEqual([String(book.id)]);
    expect(shelves[0].lean).toBe(true);
    expect(shelves.slice(1).every((s) => !s.spines.length && !s.lean && !s.bookend)).toBe(true);
  });

  it('never repeats a book to fill space', () => {
    const books = Array.from({ length: 12 }, (_, i) => makeBook({ title: `Book ${i}`, genres: [i % 2 ? 'Fantasy' : 'History'] }));
    const keys = hallwayShelves(books, 3, ROOM, SCALE).flatMap((s) => s.spines.map((x) => x.key));
    expect(keys).toHaveLength(12);
    expect(new Set(keys).size).toBe(12);
  });

  it('holds up a part-filled shelf with a bookend', () => {
    const books = Array.from({ length: 4 }, (_, i) => makeBook({ title: `Book ${i}` }));
    const [top] = hallwayShelves(books, 3, ROOM, SCALE);
    expect(top.spines).toHaveLength(4);
    expect(top.bookend).toBe(true);
    expect(top.lean).toBe(false);
  });

  it('fills more shelves with more books, each within the shelf, and stops at the cap', () => {
    const books = Array.from({ length: 300 }, (_, i) => makeBook({ title: `Book ${i}`, pageCount: 200 + (i % 7) * 60 }));
    const shelves = hallwayShelves(books, 7, ROOM, SCALE);
    const drawn = shelves.flatMap((s) => s.spines);
    expect(drawn.length).toBeLessThanOrEqual(MAX_HALLWAY_BOOKS);
    expect(shelves.filter((s) => s.spines.length).length).toBeGreaterThan(3);
    for (const s of shelves) expect(s.spines.reduce((w, x) => w + x.width + 1, 0)).toBeLessThanOrEqual(ROOM + 1);
  });

  it('keeps the friend’s own shelf order (by genre) and their spine colours', () => {
    const history = makeBook({ title: 'SPQR', genres: ['History'], spineColor: '#1f3a5f' });
    const fantasy = makeBook({ title: 'Piranesi', genres: ['Fantasy'], spineColor: '#7a1f1f' });
    const [top] = hallwayShelves([history, fantasy], 3, ROOM, SCALE);
    expect(top.spines.map((s) => s.style.color)).toEqual(['#7a1f1f', '#1f3a5f']);
  });
});

describe('hallwayShelves from eye level', () => {
  it('starts on the given shelf, carries on down, then fills the shelves above', () => {
    const one = hallwayShelves([makeBook({ title: 'Alone' })], 7, ROOM, SCALE, 1);
    expect(one.map((s) => s.spines.length)).toEqual([0, 1, 0, 0, 0, 0, 0]);
    const many = hallwayShelves(Array.from({ length: 200 }, (_, i) => makeBook({ title: `B${i}`, pageCount: 300 })), 4, ROOM, SCALE, 2);
    expect(many.every((s) => s.spines.length > 0)).toBe(true);
  });
});
