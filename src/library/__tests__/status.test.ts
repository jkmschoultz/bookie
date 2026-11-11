import { makeBook } from '@/test/makeBook';

import { asksAboutOwnership, statusPatch } from '../status';

describe('statusPatch', () => {
  it('never changes whether you own the book', () => {
    for (const owned of [true, false]) {
      for (const from of ['want', 'owned', 'reading', 'dnf', 'read'] as const) {
        for (const to of ['want', 'owned', 'reading', 'dnf', 'read'] as const) {
          expect(statusPatch(makeBook({ status: from, owned }), to)).not.toHaveProperty('owned');
        }
      }
    }
  });

  it('keeps the date bookkeeping', () => {
    expect(statusPatch(makeBook({ status: 'owned' }), 'reading')).toMatchObject({ status: 'reading', dateFinished: null });
    expect(statusPatch(makeBook({ status: 'reading' }), 'read').dateFinished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(statusPatch(makeBook({ status: 'read', dateFinished: '2024-01-02' }), 'read').dateFinished).toBe('2024-01-02');
    expect(statusPatch(makeBook({ status: 'read', dateFinished: '2024-01-02' }), 'want').dateFinished).toBeNull();
  });
});

describe('asksAboutOwnership', () => {
  it('asks when a book you do not own leaves "Want to read" for reading, unread or read', () => {
    for (const to of ['reading', 'owned', 'read'] as const) {
      expect(asksAboutOwnership({ status: 'want', owned: false }, to)).toBe(true);
    }
  });

  it('never asks otherwise', () => {
    expect(asksAboutOwnership({ status: 'want', owned: true }, 'read')).toBe(false); // already on your shelf
    expect(asksAboutOwnership({ status: 'want', owned: false }, 'dnf')).toBe(false);
    expect(asksAboutOwnership({ status: 'want', owned: false }, 'want')).toBe(false);
    for (const from of ['reading', 'owned', 'read', 'dnf'] as const) {
      for (const to of ['want', 'reading', 'owned', 'read', 'dnf'] as const) {
        expect(asksAboutOwnership({ status: from, owned: false }, to)).toBe(false); // borrowed books stay borrowed
      }
    }
  });
});
