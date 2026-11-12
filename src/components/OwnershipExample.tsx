import { TourShelf, exampleBook } from '@/components/TourShelf';

const OWNED = exampleBook({ id: -1, title: 'The Hobbit', author: 'Tolkien', palette: ['#2f6b5e', '#e8c875'] });
const NOT_OWNED = exampleBook({ id: -2, title: 'Dune', author: 'Herbert', palette: ['#b3202a', '#e9dcc0'], owned: false });

/** Two books on a little shelf: one you own, and one you don't, which is drawn faded. Used in the welcome tour. */
export function OwnershipExample() {
  return (
    <TourShelf
      label="Example shelf: a book on your shelf looks solid, and a book you don't own is faded"
      slots={[
        { books: [OWNED], caption: 'On my shelf' },
        { books: [NOT_OWNED], caption: 'Not owned' },
      ]}
    />
  );
}
