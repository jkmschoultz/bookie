import { makeBook } from '@/test/makeBook';

import { authorSurname, combineRanges, groupBooks, sortableTitle, type ShelfGroup } from '../grouping';

const labels = (groups: { label: string }[]) => groups.map((g) => g.label);
const titles = (books: { title: string }[]) => books.map((b) => b.title);

describe('authorSurname', () => {
  it.each([
    ['J.R.R. Tolkien', 'Tolkien'],
    ['Ursula K. Le Guin', 'Le Guin'],
    ['Ludwig van Beethoven', 'van Beethoven'],
    ['Tolkien, J.R.R.', 'Tolkien'],
    ['Martin Luther King Jr.', 'King'],
    ['Homer', 'Homer'],
  ])('%s → %s', (name, surname) => expect(authorSurname(name)).toBe(surname));
});

it('ignores leading articles when alphabetising titles', () => {
  expect(sortableTitle('The Hobbit')).toBe('Hobbit');
  expect(sortableTitle('A Wizard of Earthsea')).toBe('Wizard of Earthsea');
});

describe('groupBooks', () => {
  it('groups by primary genre with Uncategorised last', () => {
    const books = [
      makeBook({ title: 'Dune', genres: ['Science Fiction'] }),
      makeBook({ title: 'Mystery', genres: [] }),
      makeBook({ title: 'Hobbit', genres: ['Fantasy', 'Classics'] }),
    ];
    expect(labels(groupBooks(books, 'genre'))).toEqual(['Fantasy', 'Science Fiction', 'Uncategorised']);
  });

  it('keeps series in order within a shelf', () => {
    const books = [
      makeBook({ title: 'Two Towers', authors: ['J.R.R. Tolkien'], series: 'LOTR', seriesIndex: 2, genres: ['Fantasy'] }),
      makeBook({ title: 'Fellowship', authors: ['J.R.R. Tolkien'], series: 'LOTR', seriesIndex: 1, genres: ['Fantasy'] }),
      makeBook({ title: 'Earthsea', authors: ['Ursula K. Le Guin'], genres: ['Fantasy'] }),
    ];
    expect(titles(groupBooks(books, 'genre')[0].books)).toEqual(['Earthsea', 'Fellowship', 'Two Towers']);
  });

  it('gives prolific authors their own shelf and buckets the rest by letter', () => {
    const books = [
      ...[1, 2, 3].map((i) => makeBook({ title: `Discworld ${i}`, authors: ['Terry Pratchett'] })),
      makeBook({ title: 'Dune', authors: ['Frank Herbert'] }),
      makeBook({ title: 'Emma', authors: ['Jane Austen'] }),
      makeBook({ title: 'Solaris', authors: ['Stanisław Lem'] }),
    ];
    expect(labels(groupBooks(books, 'author'))).toEqual(['A', 'H', 'L', 'Terry Pratchett']);
  });

  it('buckets titles by first letter, numbers last', () => {
    const books = [makeBook({ title: 'The Hobbit' }), makeBook({ title: '1984' }), makeBook({ title: 'Anathem' })];
    expect(labels(groupBooks(books, 'title'))).toEqual(['A', 'H', '#']);
  });

  it('groups publish dates by decade, newest first', () => {
    const books = [
      makeBook({ publishedYear: 1937 }),
      makeBook({ publishedYear: 2011 }),
      makeBook({ publishedYear: 2019 }),
      makeBook({ publishedYear: null }),
    ];
    const groups = groupBooks(books, 'published');
    expect(labels(groups)).toEqual(['2010s', '1930s', 'Unknown date']);
    expect(groups[0].books.map((b) => b.publishedYear)).toEqual([2019, 2011]);
  });

  it('shows currently reading, then months read, then unread', () => {
    const books = [
      makeBook({ title: 'Unread', status: 'owned' }),
      makeBook({ title: 'Now', status: 'reading', dateStarted: '2024-06-01' }),
      makeBook({ title: 'May', status: 'read', dateFinished: '2024-05-20' }),
      makeBook({ title: 'June', status: 'read', dateFinished: '2024-06-02' }),
    ];
    expect(labels(groupBooks(books, 'recent'))).toEqual(['Currently reading', 'June 2024', 'May 2024', 'Not yet read']);
  });

  it('keeps read books without a finish date out of "Not yet read"', () => {
    const books = [
      makeBook({ title: 'Unread', status: 'owned' }),
      makeBook({ title: 'Wanted', status: 'want' }),
      makeBook({ title: 'Read long ago', status: 'read', dateFinished: null, authors: ['Zadie Smith'] }),
      makeBook({ title: 'Also undated', status: 'read', dateFinished: null, authors: ['Jane Austen'] }),
      makeBook({ title: 'Gave up', status: 'dnf', dateFinished: null }),
      makeBook({ title: 'June', status: 'read', dateFinished: '2024-06-02' }),
    ];
    const groups = groupBooks(books, 'recent');
    expect(labels(groups)).toEqual(['Read', 'June 2024', 'Did not finish', 'Not yet read']);
    expect(groups[0].books.map((b) => b.authors[0])).toEqual(['Jane Austen', 'Zadie Smith']);
    expect(groups.find((g) => g.label === 'Not yet read')!.books.map((b) => b.title).sort()).toEqual(['Unread', 'Wanted']);
    expect(groups.flatMap((g) => g.books)).toHaveLength(books.length);
  });
});

describe('combineRanges', () => {
  // Each book is 10px wide, so a group's width is 10 × its books.
  const widthOf = (g: ShelfGroup) => g.books.length * 10;
  const letters = (counts: Record<string, number>): ShelfGroup[] =>
    Object.entries(counts).map(([letter, n]) => ({
      key: `title:${letter}`,
      label: letter,
      span: letter,
      books: Array.from({ length: n }, (_, i) => makeBook({ title: `${letter}${i}` })),
    }));
  const books = (groups: ShelfGroup[]) => groups.flatMap((g) => g.books.map((b) => b.title));

  it('combines letters into ranges of about the target width, keeping every book in order', () => {
    const groups = letters({ A: 3, B: 2, C: 4, D: 1, E: 5, F: 2, G: 3, H: 4, I: 1, J: 2 }); // 270px in all
    const ranges = combineRanges(groups, 100, widthOf);
    expect(ranges.map((g) => g.label)).toEqual(['A–C', 'D–F', 'G–J']);
    expect(ranges.map(widthOf)).toEqual([90, 80, 100]); // three ranges aiming at 90px each
    expect(books(ranges)).toEqual(books(groups));
  });

  it('never splits a letter, so one big letter makes its own longer range', () => {
    const ranges = combineRanges(letters({ A: 1, B: 25, C: 1 }), 100, widthOf);
    expect(ranges.every((g) => g.books.every((b) => b.title[0] === g.books[0].title[0]) || g.label.includes('–'))).toBe(true);
    expect(books(ranges)).toEqual(books(letters({ A: 1, B: 25, C: 1 })));
    expect(ranges.find((g) => g.books.some((b) => b.title === 'B0'))!.books.filter((b) => b.title.startsWith('B'))).toHaveLength(25);
  });

  it('keeps everything on one shelf when it all fits, labelled as a single range', () => {
    expect(combineRanges(letters({ A: 2, B: 2, C: 2 }), 100, widthOf).map((g) => g.label)).toEqual(['A–C']);
    expect(combineRanges(letters({ M: 2 }), 100, widthOf).map((g) => g.label)).toEqual(['M']);
  });

  it('leaves author shelves and catch-all groups alone, combining only the letters between them', () => {
    const [a, b, c, d] = letters({ A: 2, B: 2, C: 2, D: 2 });
    const tolkien: ShelfGroup = { key: 'author:Tolkien', label: 'J.R.R. Tolkien', books: [makeBook({ title: 'Hobbit' })] };
    const other: ShelfGroup = { key: 'title:#', label: '#', books: [makeBook({ title: '1984' })] };
    const ranges = combineRanges([a, b, tolkien, c, d, other], 100, widthOf);
    expect(ranges.map((g) => g.label)).toEqual(['A–B', 'J.R.R. Tolkien', 'C–D', '#']);
  });

  it('labels decade ranges oldest to newest, though the shelves run newest first', () => {
    const books = [2015, 2011, 1999, 1994, 1988, 1972, 1965, 1961].map((y) => makeBook({ publishedYear: y }));
    const ranges = combineRanges(groupBooks(books, 'published'), 40, widthOf);
    expect(ranges.map((g) => g.label)).toEqual(['1990s–2010s', '1960s–1980s']);
  });
});
