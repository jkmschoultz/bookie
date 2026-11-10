import { makeBook } from '@/test/makeBook';

import { duplicateKey, findDuplicates } from '../duplicates';

describe('duplicateKey', () => {
  it('ignores case, accents, punctuation and spacing in initials', () => {
    expect(duplicateKey({ title: 'The Hobbit', authors: ['J.R.R. Tolkien'] })).toBe(duplicateKey({ title: 'the hobbit', authors: ['J. R. R. Tolkien'] }));
    expect(duplicateKey({ title: 'Salt, Fat, Acid & Heat', authors: ['Samin Nosrat'] })).toBe(
      duplicateKey({ title: 'Salt Fat Acid and Heat', authors: ['samin nosrat'] }),
    );
    expect(duplicateKey({ title: 'Les Misérables', authors: ['Victor Hugo'] })).toBe(duplicateKey({ title: 'Les Miserables', authors: ['Victor Hugo'] }));
  });

  it('tells different books and different authors apart', () => {
    expect(duplicateKey({ title: 'The Hobbit', authors: ['Tolkien'] })).not.toBe(duplicateKey({ title: 'The Two Towers', authors: ['Tolkien'] }));
    expect(duplicateKey({ title: 'Emma', authors: ['Jane Austen'] })).not.toBe(duplicateKey({ title: 'Emma', authors: ['Emma Tennant'] }));
  });
});

describe('findDuplicates', () => {
  it('finds nothing in a library without duplicates', () => {
    expect(findDuplicates([makeBook({ title: 'A' }), makeBook({ title: 'B' })])).toEqual([]);
  });

  it('keeps the copy with more info and fills its gaps from the other', () => {
    const sparse = makeBook({ title: 'Dune', authors: ['Frank Herbert'], isbn13: '9780441172719', status: 'owned' });
    const rich = makeBook({
      title: 'Dune',
      authors: ['Frank Herbert'],
      pageCount: 688,
      publishedYear: 1965,
      publisher: 'Ace',
      coverUrl: 'https://covers.example/dune.jpg',
      genres: ['Science Fiction'],
      status: 'read',
      dateFinished: '2023-03-14',
    });
    const [merge] = findDuplicates([sparse, rich]);
    expect(merge.keep.id).toBe(rich.id);
    expect(merge.remove.map((b) => b.id)).toEqual([sparse.id]);
    expect(merge.patch).toEqual({ isbn13: '9780441172719' }); // the only thing the kept copy was missing
  });

  it('prefers the newest started and finished dates and the earliest added date', () => {
    const a = makeBook({ title: 'Emma', status: 'read', dateAdded: '2021-01-01', dateStarted: '2021-02-01', dateFinished: '2021-03-01' });
    const b = makeBook({ title: 'Emma', status: 'read', dateAdded: '2023-05-05', dateStarted: '2024-06-01', dateFinished: '2024-06-20' });
    const [merge] = findDuplicates([a, b]);
    const result = { ...merge.keep, ...merge.patch };
    expect(result).toMatchObject({ dateAdded: '2021-01-01', dateStarted: '2024-06-01', dateFinished: '2024-06-20' });
  });

  it('merges what would otherwise be lost: genres, notes, ownership and the furthest status', () => {
    const a = makeBook({ title: 'Piranesi', genres: ['Fantasy'], notes: 'Loved the statues', owned: false, status: 'want', rating: 5 });
    const b = makeBook({ title: 'Piranesi', genres: ['Literary Fiction', 'Fantasy'], notes: 'Reread soon', owned: true, status: 'reading' });
    const [merge] = findDuplicates([a, b]);
    const result = { ...merge.keep, ...merge.patch };
    expect(result.genres.sort()).toEqual(['Fantasy', 'Literary Fiction']);
    expect(result.notes).toContain('Loved the statues');
    expect(result.notes).toContain('Reread soon');
    expect(result).toMatchObject({ owned: true, status: 'reading', rating: 5 });
  });

  it('keeps a cover together with the colours read from it', () => {
    const a = makeBook({ title: 'SPQR', notes: 'x', publisher: 'Liveright', pageCount: 608 });
    const b = makeBook({ title: 'SPQR', coverUrl: 'https://covers.example/spqr.jpg', coverPalette: ['#a07850'] });
    const [merge] = findDuplicates([a, b]);
    expect(merge.keep.id).toBe(a.id);
    expect(merge.patch).toMatchObject({ coverUrl: 'https://covers.example/spqr.jpg', coverPalette: ['#a07850'] });
  });

  it('folds three or more copies into one', () => {
    const copies = [makeBook({ title: 'Beloved' }), makeBook({ title: 'Beloved', pageCount: 324 }), makeBook({ title: 'beloved' })];
    const [merge] = findDuplicates(copies);
    expect(merge.remove).toHaveLength(2);
    expect(new Set([merge.keep.id, ...merge.remove.map((b) => b.id)])).toEqual(new Set(copies.map((b) => b.id)));
  });
});
