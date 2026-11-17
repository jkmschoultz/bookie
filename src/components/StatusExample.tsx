import { StyleSheet, View } from 'react-native';

import { TourShelf, exampleBook } from '@/components/TourShelf';

const SIZE = { pageCount: 380, heightMm: 170 };
const READING = exampleBook({ ...SIZE, id: -21, title: 'Dune', author: 'Herbert', palette: ['#b3202a', '#e9dcc0'], status: 'reading' });
const READ = exampleBook({ ...SIZE, id: -22, title: 'The Hobbit', author: 'Tolkien', palette: ['#2f6b5e', '#e8c875'], status: 'read' });
const UNREAD = exampleBook({ ...SIZE, id: -24, title: 'Middlemarch', author: 'Eliot', palette: ['#7d5a3c', '#e3c27a'], status: 'owned' });
const NEXT_UP = exampleBook({ ...SIZE, id: -25, title: 'Emma', author: 'Austen', palette: ['#2b3a67', '#d9a441'], status: 'want' });
const WISHED = exampleBook({ ...SIZE, id: -26, title: 'Beloved', author: 'Morrison', palette: ['#8c3b6b', '#e8e0cf'], status: 'want', owned: false });
const DNF = exampleBook({ ...SIZE, id: -23, title: 'Ulysses', author: 'Joyce', palette: ['#4a3b6b', '#c9b6e4'], status: 'dnf' });

/** One book of each reading status, drawn with the real spines, with what gives it away. Used in the welcome tour. */
export function StatusExample() {
  return (
    <View style={styles.shelves}>
      <TourShelf
        height={160}
        label="Example shelf: a book you're reading has a red bookmark ribbon out of the top, a book you've read has creases down its spine, and an unread book has a fresh sheen"
        slots={[
          { books: [READING], caption: 'Reading', note: 'Bookmark' },
          { books: [READ], caption: 'Read', note: 'Creases' },
          { books: [UNREAD], caption: 'Unread', note: 'Fresh sheen' },
        ]}
      />
      <TourShelf
        height={160}
        label="Example shelf: a book you own and want to read has a sticky tab out of the top, a book you want but don't own is only a dashed outline, and a book you didn't finish has a slip of paper out of the top"
        slots={[
          { books: [NEXT_UP], caption: 'Want to read', note: 'Owned: a tab' },
          { books: [WISHED], caption: 'Want to read', note: 'Not owned: outline' },
          { books: [DNF], caption: 'Did not finish', note: 'Slip of paper' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shelves: { gap: 10 },
});
