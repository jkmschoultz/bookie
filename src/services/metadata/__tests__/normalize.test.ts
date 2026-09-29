import { cleanIsbn, isbn10to13, mapGenres, mergeDrafts, parseHeightMm, parseYear, splitSeries } from '../normalize';
import { emptyDraft } from '@/types';

describe('mapGenres', () => {
  it('prefers specific genres over generic fiction', () => {
    expect(mapGenres(['Fiction', 'Science fiction', 'Space warfare'])[0]).toBe('Science Fiction');
  });
  it('maps messy Open Library subjects', () => {
    expect(mapGenres(['Juvenile fiction', 'Fantasy fiction', 'Hobbits'])).toContain('Fantasy');
    expect(mapGenres(['Detective and mystery stories'])).toEqual(['Mystery & Thriller']);
    expect(mapGenres(['Biography & Autobiography'])).toEqual(['Biography & Memoir']);
  });
  it('returns nothing for unknown subjects', () => {
    expect(mapGenres(['Hobbits'])).toEqual([]);
  });
});

it('parses years from assorted date formats', () => {
  expect(parseYear('September 21, 1937')).toBe(1937);
  expect(parseYear('2012-09-18')).toBe(2012);
  expect(parseYear(undefined)).toBeNull();
});

it('cleans and converts ISBNs', () => {
  expect(cleanIsbn('978-0-547-92822-7')).toBe('9780547928227');
  expect(cleanIsbn('12345')).toBeNull();
  expect(isbn10to13('054792822X')).toBe('9780547928227');
});

it('parses physical heights', () => {
  expect(parseHeightMm('24 cm')).toBe(240);
  expect(parseHeightMm('20 x 13 x 2 centimeters')).toBe(200);
  expect(parseHeightMm('8.2 x 5.5 x 1 inches')).toBe(208);
  expect(parseHeightMm(null)).toBeNull();
});

it('splits Goodreads-style series titles', () => {
  expect(splitSeries('The Fellowship of the Ring (The Lord of the Rings, #1)')).toEqual({
    title: 'The Fellowship of the Ring',
    series: 'The Lord of the Rings',
    seriesIndex: 1,
  });
  expect(splitSeries('Dune').series).toBeNull();
});

it('merges drafts without overwriting existing values', () => {
  const merged = mergeDrafts({ ...emptyDraft(), title: 'A', pageCount: 100 }, { title: 'B', pageCount: 200, genres: ['Fantasy'] });
  expect(merged).toMatchObject({ title: 'A', pageCount: 100, genres: ['Fantasy'] });
});

describe('mapGenres ranking', () => {
  const hobbit = ['Fantasy', 'Arkenstone', 'wizards', 'dragons', 'juvenile fantasy', 'YOUNG ADULT FICTION', 'Fantasy fiction', 'Juvenile fiction', 'Fiction', 'Classics', "children's books", 'Magic', 'Graphic novels', 'Comic books, strips', 'Fiction, fantasy, general'];

  it('ranks the dominant genre first even with noisy subjects', () => {
    expect(mapGenres(hobbit)[0]).toBe('Fantasy');
  });

  it('does not treat science fiction as science', () => {
    expect(mapGenres(['Science fiction', 'Space ships, fiction', 'Science Fiction, hard science fiction'])).not.toContain('Science & Nature');
  });

  it('falls back to Literary Fiction for plain fiction', () => {
    expect(mapGenres(['Fiction', 'Novels'])).toEqual(['Literary Fiction']);
  });
});
