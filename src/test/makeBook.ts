import { emptyDraft, type Book } from '@/types';

let nextId = 1;

export function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    ...emptyDraft(),
    id: nextId++,
    title: 'Untitled',
    authors: ['Anon Author'],
    status: 'owned',
    rating: null,
    owned: true,
    dateAdded: '2024-01-01',
    dateStarted: null,
    dateFinished: null,
    notes: null,
    ...overrides,
  };
}
