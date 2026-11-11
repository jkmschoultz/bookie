# Bookie

A reading tracker that shows your library as a virtual bookshelf. Swipe along shelves and up and down the bookcase. Spine thickness follows page count and spine height follows the book's physical size. Shelves can be grouped by genre, author, title, publish date or recently read.

Built with Expo (SDK 58). Runs in **Expo Go** (once the SDK 58 Expo Go is out on the stores; until then use a development build) and on the **web**. All data stays on the device in SQLite, so use Settings → Export backup to keep a copy.

## Run

```bash
npm install
npx expo start        # scan the QR code with Expo Go
npm test              # unit tests (shelf layout, grouping, metadata, Goodreads import)
npx tsc --noEmit && npx expo lint
```

Optional: copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY`. Google Books is a fallback for page counts, genres and book heights, and its keyless quota is often exhausted. Open Library works without a key.

## Deploy the web app

```bash
npm run deploy:staging  # test build at a fixed staging link (the "staging" alias)
npm run deploy:web      # expo export --platform web, then eas deploy --prod (EAS Hosting, free tier)
```

The first deploy asks you to log in to Expo and pick a subdomain. `public/` holds the web shell: `index.html` (manifest and iOS home-screen tags), `manifest.json` and the home-screen icons. On web, only use SQLite's async API (`getAllAsync`, `runAsync`, kv-store `getItem`…): the sync calls need `SharedArrayBuffer`, which needs the cross-origin isolation headers in the `expo-router` plugin in `app.json`. `expo start` sends those headers but EAS Hosting doesn't for this static build, so sync calls would work locally and fail on the live site.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request into `master` (and on pushes to it):

1. **Check** (the required check): typecheck, lint, tests, then the same web export the deploy uses.
2. **Preview deploy**: deploys that build to an unnamed EAS Hosting address and posts it on the PR. It's a separate, empty library from the live app, and Expo deletes it after 30 days. It doesn't use one of the 5 named aliases.

Merging deploys nothing; run `npm run deploy:web` for that. One-time setup in the GitHub repo (Settings → Secrets and variables → Actions):

- `EXPO_TOKEN` (needed for previews): create one at expo.dev → Account settings → Access tokens. Without it the preview job just skips.
- `GOOGLE_BOOKS_API_KEY` (optional): the same value as in `.env.local`, so preview builds match the live app.

To require the check before merging: Settings → Branches (or Rules → Rulesets) → protect `master` → require a pull request and the **Check** status check to pass.

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
- `src/services/backup.ts`: backup file format (export / restore)
- `src/services/files.ts`: reading picked files and saving the backup on native and web
- `src/library/onboarding.ts`: remembers whether the first-launch walkthrough (`src/app/welcome.tsx`) has been seen
- `assets/icon/bookie-icon.svg`: source artwork for the app icon; the icon PNGs in `assets/images/` and `public/` are rendered from it
- `src/app/`: screens (bookshelf, book detail, add: search / scan / manual / import)
