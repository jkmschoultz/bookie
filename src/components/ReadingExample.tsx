import { TourShelf, exampleBook } from '@/components/TourShelf';

const READING = exampleBook({ id: -21, title: 'Dune', author: 'Herbert', palette: ['#b3202a', '#e9dcc0'], status: 'reading' });
const READ = exampleBook({ id: -22, title: 'The Hobbit', author: 'Tolkien', palette: ['#2f6b5e', '#e8c875'], status: 'read' });

/** A book you're reading wears a bookmark ribbon at the top of its spine. Used in the welcome tour. */
export function ReadingExample() {
  return (
    <TourShelf
      label="Example shelf: the book you are reading has a bookmark sticking out of the top, and a finished book doesn't"
      slots={[
        { books: [READING], caption: 'Reading now' },
        { books: [READ], caption: 'Finished' },
      ]}
    />
  );
}
