# Bookie

A reading tracker that shows your library as a virtual bookshelf. Swipe along shelves and up and down the bookcase. Spine thickness follows page count and spine height follows the book's physical size. Shelves can be grouped by genre, author, title, publish date or recently read.

Built with Expo (SDK 57) and runs in **Expo Go**. All data stays on the device in SQLite.

## Run

```bash
npm install
npx expo start        # scan the QR code with Expo Go
npm test              # unit tests (shelf layout, grouping, metadata, Goodreads import)
npx tsc --noEmit && npx expo lint
```

Optional: copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY`. Google Books is a fallback for page counts, genres and book heights, and its keyless quota is often exhausted. Open Library works without a key.

## Layout

- `src/shelf/`: pure shelf engine
  - `grouping.ts`: sort modes → groups
  - `spineStyle.ts`: page count → width, size → height, colours
  - `layout.ts`: groups → shelf rows, with bookends and flat stacks
- `src/components/shelf/`: Bookcase → ShelfRow → Spine / BookStack
- `src/services/metadata/`: Open Library + Google Books lookup and genre normalisation
- `src/services/import/goodreadsCsv.ts`: Goodreads export parser
- `src/db/`: SQLite migrations and the books repository
- `src/library/LibraryProvider.tsx`: in-memory library state backed by SQLite
- `src/app/`: screens (bookshelf, book detail, add: search / scan / manual / import)
