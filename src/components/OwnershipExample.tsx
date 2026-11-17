import { TourShelf, exampleBook } from '@/components/TourShelf';

const OWNED = exampleBook({ id: -1, title: 'The Hobbit', author: 'Tolkien', palette: ['#2f6b5e', '#e8c875'], status: 'owned' });
const NOT_OWNED = exampleBook({ id: -2, title: 'Dune', author: 'Herbert', palette: ['#b3202a', '#e9dcc0'], owned: false });
const WANTED = exampleBook({ id: -3, title: 'Emma', author: 'Austen', palette: ['#2b3a67', '#d9a441'], status: 'want', owned: false });

/** Books on a little shelf: one you own, one you don't (faded), and one you want but don't own (an outline). Used in the welcome tour. */
export function OwnershipExample() {
  return (
    <TourShelf
      label="Example shelf: a book on your shelf looks solid, a book you don't own is faded, and a book you want is only a dashed outline"
      slots={[
        { books: [OWNED], caption: 'On my shelf' },
        { books: [NOT_OWNED], caption: 'Not owned' },
        { books: [WANTED], caption: 'Want to read' },
      ]}
    />
  );
}
