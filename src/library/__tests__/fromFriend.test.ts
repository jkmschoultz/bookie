import { makeBook } from '@/test/makeBook';
import { today } from '@/types';

import { fromFriend } from '../fromFriend';

describe('fromFriend', () => {
  const theirs = makeBook({
    title: 'Piranesi',
    authors: ['Susanna Clarke'],
    isbn13: '9781635575637',
    genres: ['Fantasy'],
    pageCount: 272,
    coverUrl: 'https://covers.example/piranesi.jpg',
    coverPalette: ['#2f4a5a'],
    series: null,
    status: 'read',
    owned: true,
    rating: 5,
    dateAdded: '2024-01-01',
    dateStarted: '2024-02-01',
    dateFinished: '2024-02-20',
    notes: 'theirs',
  });

  it('copies the book’s details and none of their reading', () => {
    const mine = fromFriend(theirs, 'owned');
    expect(mine).toMatchObject({ title: 'Piranesi', authors: ['Susanna Clarke'], isbn13: '9781635575637', genres: ['Fantasy'], pageCount: 272, coverUrl: theirs.coverUrl, coverPalette: ['#2f4a5a'] });
    expect(mine).toMatchObject({ status: 'owned', owned: true, rating: null, dateStarted: null, dateFinished: null, notes: null, dateAdded: today() });
    expect(mine).not.toHaveProperty('id');
  });

  it('adds a book you want to read as one you don’t own', () => {
    expect(fromFriend(theirs, 'want')).toMatchObject({ status: 'want', owned: false });
  });
});
