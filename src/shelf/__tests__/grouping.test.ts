import { makeBook } from '@/test/makeBook';

import { authorSurname, groupBooks, sortableTitle } from '../grouping';

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
});
