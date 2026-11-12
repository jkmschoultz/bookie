import { TourShelf, exampleBook } from '@/components/TourShelf';

const SLIM = exampleBook({ id: -11, title: 'Animal Farm', author: 'Orwell', palette: ['#c9792b', '#2b2a33'], pageCount: 140, heightMm: 178 });
const STANDARD = exampleBook({ id: -12, title: 'The Hobbit', author: 'Tolkien', palette: ['#2f6b5e', '#e8c875'], pageCount: 310, heightMm: 198 });
const CHUNKY = exampleBook({ id: -13, title: 'War and Peace', author: 'Tolstoy', palette: ['#6b2f3a', '#d9c7a0'], pageCount: 1200, heightMm: 250 });

/** Books of different sizes side by side, to show that thickness follows page count and height follows the real book. */
export function SizeExample() {
  return (
    <TourShelf
      height={216}
      label="Example shelf: a short, thin book, a middling one, and a tall, thick one"
      slots={[
        { books: [SLIM], caption: 'Short, slim' },
        { books: [STANDARD], caption: 'Medium' },
        { books: [CHUNKY], caption: 'Tall, thick' },
      ]}
    />
  );
}
