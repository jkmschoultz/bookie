import { makeBook } from '@/test/makeBook';

import { filterBooks } from '../filter';

describe('filterBooks', () => {
  const books = [
    makeBook({ title: 'Read, owned', status: 'read', owned: true }),
    makeBook({ title: 'Read, borrowed', status: 'read', owned: false }),
    makeBook({ title: 'Wanted', status: 'want', owned: false }),
    makeBook({ title: 'Reading, owned', status: 'reading', owned: true }),
  ];
  const titles = (list: { title: string }[]) => list.map((b) => b.title);

  it('shows everything with no filters', () => {
    expect(filterBooks(books, { statuses: [], owned: null })).toHaveLength(4);
  });

  it('filters by whether you own the book', () => {
    expect(titles(filterBooks(books, { statuses: [], owned: true }))).toEqual(['Read, owned', 'Reading, owned']);
    expect(titles(filterBooks(books, { statuses: [], owned: false }))).toEqual(['Read, borrowed', 'Wanted']);
  });

  it('combines status and ownership, so a borrowed read book is findable', () => {
    expect(titles(filterBooks(books, { statuses: ['read'], owned: false }))).toEqual(['Read, borrowed']);
    expect(titles(filterBooks(books, { statuses: ['read', 'reading'], owned: true }))).toEqual(['Read, owned', 'Reading, owned']);
    expect(filterBooks(books, { statuses: ['want'], owned: true })).toEqual([]);
  });
});
