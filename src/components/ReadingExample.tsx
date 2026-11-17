import { TourShelf, exampleBook } from '@/components/TourShelf';

const READING = exampleBook({ id: -21, title: 'Dune', author: 'Herbert', palette: ['#b3202a', '#e9dcc0'], status: 'reading' });
const READ = exampleBook({ id: -22, title: 'The Hobbit', author: 'Tolkien', palette: ['#2f6b5e', '#e8c875'], status: 'read' });
const DNF = exampleBook({ id: -23, title: 'Ulysses', author: 'Joyce', palette: ['#4a3b6b', '#c9b6e4'], status: 'dnf' });

/** A book you're reading wears a bookmark ribbon, a finished one has creases, and one you gave up on keeps a paper slip. Used in the welcome tour. */
export function ReadingExample() {
  return (
    <TourShelf
      label="Example shelf: the book you are reading has a bookmark sticking out of the top, a finished book has a few creases, and a book you didn't finish has a slip of paper sticking out"
      slots={[
        { books: [READING], caption: 'Reading now' },
        { books: [READ], caption: 'Finished' },
        { books: [DNF], caption: 'Unfinished' },
      ]}
    />
  );
}
