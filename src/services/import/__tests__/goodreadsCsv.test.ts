import { isExportDownload, isSignInPage, looksLikeGoodreadsExport, parseGoodreadsCsv } from '../goodreadsCsv';

const CSV = `﻿Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies
5907,"The Hobbit, or There and Back Again",J.R.R. Tolkien,"Tolkien, J.R.R.",,"=""054792822X""","=""9780547928227""",5,4.28,Mariner Books,Paperback,300,2012,1937,2023/05/14,2023/01/02,,,read,,,,1,1
34,"The Fellowship of the Ring (The Lord of the Rings, #1)",J.R.R. Tolkien,"Tolkien, J.R.R.",,"=""""","=""""",0,4.38,Houghton Mifflin,Paperback,398,2003,1954,,2024/02/10,to-read,to-read (#3),to-read,,,,0,0
99,Piranesi,Susanna Clarke,"Clarke, Susanna",,"=""1635575630""","=""9781635575637""",0,4.2,Bloomsbury,Hardcover,272,2020,2020,,2024/03/01,,,currently-reading,,,Loved the statues,0,0
,,,,,,,,,,,,,,,,,,,,,,,
`;

describe('parseGoodreadsCsv', () => {
  const { books, skipped } = parseGoodreadsCsv(CSV);

  it('parses every row with a title', () => {
    expect(books).toHaveLength(3);
    expect(skipped).toBe(1);
  });

  it('maps a read book', () => {
    expect(books[0]).toMatchObject({
      title: 'The Hobbit, or There and Back Again',
      authors: ['J.R.R. Tolkien'],
      isbn13: '9780547928227',
      isbn10: '054792822X',
      pageCount: 300,
      publishedYear: 1937,
      rating: 5,
      status: 'read',
      dateFinished: '2023-05-14',
      dateAdded: '2023-01-02',
      owned: true,
      source: 'goodreads',
    });
  });

  it('extracts series and handles empty ISBNs', () => {
    expect(books[1]).toMatchObject({
      title: 'The Fellowship of the Ring',
      series: 'The Lord of the Rings',
      seriesIndex: 1,
      isbn13: null,
      rating: null,
      status: 'want',
      owned: false,
    });
  });

  it('maps currently reading and private notes', () => {
    expect(books[2]).toMatchObject({ status: 'reading', notes: 'Loved the statues' });
  });

  it('detects Goodreads exports', () => {
    expect(looksLikeGoodreadsExport(CSV)).toBe(true);
    expect(looksLikeGoodreadsExport('name,age\nbob,3')).toBe(false);
  });
});

describe('isExportDownload', () => {
  it.each([
    ['https://www.goodreads.com/review_porter/export/12345/goodreads_library_export.csv', true],
    ['https://www.goodreads.com/review_porter/export/12345/goodreads_library_export.csv?x=1', true],
    ['https://goodreads.com/something/export.csv', true],
    ['https://www.goodreads.com/review_porter/export/12345', false], // starting an export, not the file
    ['https://www.goodreads.com/review/import', false],
    ['https://evil.example.com/goodreads.com/export.csv', false],
    ['https://notgoodreads.com/x.csv', false],
  ])('%s → %s', (url, expected) => expect(isExportDownload(url)).toBe(expected));
});

describe('isSignInPage', () => {
  it.each([
    ['https://www.goodreads.com/user/sign_in', true],
    ['https://www.goodreads.com/user/sign_up', true],
    ['https://www.goodreads.com/ap/signin?openid.return_to=x', true],
    ['https://www.goodreads.com/ap/mfa', true],
    ['https://www.amazon.com/ap/signin', true],
    ['https://appleid.apple.com/auth/authorize', true],
    ['https://www.goodreads.com/', false],
    ['https://www.goodreads.com/?ref=nav_home', false],
    ['https://www.goodreads.com/review/import', false],
  ])('%s → %s', (url, expected) => expect(isSignInPage(url)).toBe(expected));
});
