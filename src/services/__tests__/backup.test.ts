import { makeBook } from '@/test/makeBook';

import { backupFileName, onlyNewBooks, parseBackup, toBackup } from '../backup';

describe('backup', () => {
  const books = [
    makeBook({ title: 'Piranesi', authors: ['Susanna Clarke'], status: 'read', rating: 5, notes: 'Loved the statues' }),
    makeBook({ title: 'Dune', coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg', genres: ['Science Fiction'] }),
  ];

  it('round-trips a library without ids', () => {
    const restored = parseBackup(toBackup(books));
    expect(restored).toEqual(books.map(({ id, ...b }) => b));
    expect(restored[0]).not.toHaveProperty('id');
  });

  it('drops covers that only exist on the device', () => {
    const local = makeBook({ coverUrl: 'file:///data/covers/1.jpg' });
    const web = makeBook({ coverUrl: 'data:image/jpeg;base64,AAAA' });
    const [a, b] = parseBackup(toBackup([local, web]));
    expect(a.coverUrl).toBeNull();
    expect(b.coverUrl).toBe('data:image/jpeg;base64,AAAA');
  });

  it('fills in fields missing from older files and skips untitled entries', () => {
    const text = JSON.stringify({ app: 'bookie', version: 1, books: [{ title: 'Emma', authors: ['Jane Austen'] }, { title: '' }, null] });
    const restored = parseBackup(text);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ title: 'Emma', authors: ['Jane Austen'], status: 'owned', owned: true, genres: [] });
  });

  it('rejects files that are not Bookie backups', () => {
    expect(() => parseBackup('not json')).toThrow("isn't a Bookie backup");
    expect(() => parseBackup('{"books": []}')).toThrow("isn't a Bookie backup");
    expect(() => parseBackup('{"app": "bookie", "version": 99, "books": []}')).toThrow('newer version');
  });

  it('names the file by date', () => {
    expect(backupFileName('2026-11-10')).toBe('bookie-backup-2026-11-10.json');
  });

  it('keeps only the restored books that are not on the shelves yet', () => {
    const shelf = [makeBook({ title: 'Dune', authors: ['Frank Herbert'] }), makeBook({ title: 'Other', isbn13: '9780000000001' })];
    const restored = parseBackup(
      toBackup([
        makeBook({ title: 'DUNE', authors: ['frank herbert'] }),
        makeBook({ title: 'Same ISBN, new title', isbn13: '9780000000001' }),
        makeBook({ title: 'Emma', authors: ['Jane Austen'] }),
      ]),
    );
    expect(onlyNewBooks(restored, shelf).map((b) => b.title)).toEqual(['Emma']);
  });
});
