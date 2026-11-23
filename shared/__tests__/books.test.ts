import { makeBook } from '../../src/test/makeBook';
import { FRIEND_FIELDS, incomingBook, isDeviceCover, nextUpdatedAt, outgoingBook, splitBook, wins } from '../books';

const { id, ...book } = makeBook({ notes: 'secret', rating: 4, dateFinished: '2026-01-02' });

describe('wins (last writer wins)', () => {
  it('takes a newer version, keeps the current one on a tie or when older', () => {
    expect(wins({ updatedAt: 2 }, { updatedAt: 1 })).toBe(true);
    expect(wins({ updatedAt: 1 }, { updatedAt: 1 })).toBe(false);
    expect(wins({ updatedAt: 1 }, { updatedAt: 2 })).toBe(false);
  });

  it('takes anything when there is nothing yet', () => {
    expect(wins({ updatedAt: 1 }, undefined)).toBe(true);
    expect(wins({ updatedAt: 1 }, null)).toBe(true);
  });
});

describe('nextUpdatedAt', () => {
  it('is now, or just after the version it replaces when the clock is behind', () => {
    expect(nextUpdatedAt(100, 500)).toBe(500);
    expect(nextUpdatedAt(900, 500)).toBe(901);
  });
});

describe('covers', () => {
  it('knows which covers only exist on this device', () => {
    expect(isDeviceCover('file:///covers/1.jpg')).toBe(true);
    expect(isDeviceCover('data:image/jpeg;base64,xx')).toBe(true);
    expect(isDeviceCover('https://covers.openlibrary.org/b/id/1-M.jpg')).toBe(false);
    expect(isDeviceCover(null)).toBe(false);
  });

  it('leaves a cover photo out of what is sent', () => {
    expect(outgoingBook({ ...book, coverUrl: 'file:///covers/1.jpg' }).coverUrl).toBeNull();
    expect(outgoingBook({ ...book, coverUrl: 'https://x/1.jpg' }).coverUrl).toBe('https://x/1.jpg');
  });

  it('keeps a cover photo here when the other device has none, but takes a real cover chosen there', () => {
    const photo = { coverUrl: 'file:///covers/1.jpg' };
    expect(incomingBook({ ...book, coverUrl: null }, photo).coverUrl).toBe(photo.coverUrl);
    expect(incomingBook({ ...book, coverUrl: 'https://x/2.jpg' }, photo).coverUrl).toBe('https://x/2.jpg');
    expect(incomingBook({ ...book, coverUrl: null }, { coverUrl: 'https://x/1.jpg' }).coverUrl).toBeNull();
    expect(incomingBook({ ...book, coverUrl: null }, null).coverUrl).toBeNull();
  });
});

describe('splitBook', () => {
  it('keeps notes, ratings and reading dates out of what friends see', () => {
    const { shared, personal } = splitBook(book);
    expect(shared).not.toHaveProperty('notes');
    expect(shared).not.toHaveProperty('rating');
    expect(shared).not.toHaveProperty('dateFinished');
    expect(Object.keys(shared).sort()).toEqual([...FRIEND_FIELDS].sort());
    expect(personal).toMatchObject({ notes: 'secret', rating: 4, dateFinished: '2026-01-02' });
    expect({ ...shared, ...personal }).toEqual(book);
  });
});
