# Bookie

![Bookie: your books, on a real shelf](docs/cover.png)

A reading tracker that shows your library as a virtual bookshelf. Swipe along shelves and up and down the bookcase. Book thickness follows page count and height follows the book's physical size. Shelves can be grouped by genre, author, title, publish date or recently read.

**[Try it live → mybookie.pages.dev](https://mybookie.pages.dev)** (an early prototype, free, no account)

<p>
  <img src="docs/bookie-intro.gif" alt="The bookshelf, swiping along a shelf and up the bookcase" width="260">
  &nbsp;
  <img src="docs/home.png" alt="The home screen with a sample library" width="260">
</p>

## What it does

- **Real-size books.** Each spine's thickness comes from the page count and its height from the book's physical size. Colours come from the cover's most common colours, with a second colour when the cover has one.
- **Swipe around the shelves.** Sideways along a shelf, up and down the bookcase. Shelves group by genre, author, title, publish date or what you read recently, and long groups are split into ranges (A–D, E–G…) about a screen wide.
- **Pull a book off the shelf.** Tap a spine and the book comes out of the shelf, turns from its spine to its cover and lands on its page; going back puts it back in its gap. Tap the cover on the page to see it big.
- **Track your reading.** Reading, read, unread, want to read, did not finish, with ratings, dates and notes. A book you're reading gets a bookmark.
- **Own it or not.** Books you don't own are faded. Starting a book you wanted asks whether it's on your shelf now.
- **Get books in.** Search, barcode scan, type them in, import a Goodreads export, or start with a sample library. Duplicates can be merged.
- **Make it yours.** Pick a cover from any edition Open Library knows, upload your own photo, or keep a plain cloth cover. Type the title and author straight onto the cover, and add your own genres. Fields check what you type: real dates, a sensible year, a valid ISBN.
- **Keeps your data with you.** Everything is stored on the device in SQLite, with no account and no cloud. Export and restore a backup from Settings.
- **Works as an app.** Runs on the web and can be added to a phone's home screen, and runs in Expo Go.

## Built with

Expo (SDK 58), React Native and Expo Router, TypeScript, SQLite (`expo-sqlite`), Zustand and Reanimated. The shelf engine in `src/shelf/` is plain TypeScript with unit tests (Jest). Pull requests are checked by GitHub Actions, which also deploys to Cloudflare Pages.

All data stays on the device in SQLite, so use Settings → Export backup to keep a copy. It runs in **Expo Go** (once the SDK 58 Expo Go is out on the stores; until then use a development build) and on the **web**.

## Licence

Source-available, not open source. Bookie is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE): you're free to read, run, learn from and build on the code for **non-commercial** purposes. You may not use it, or something substantially copied from it, to run a commercial product or service. For anything commercial, get in touch first. Parts that came from Expo's project template stay under their own MIT licence ([LICENSE-EXPO-TEMPLATE](LICENSE-EXPO-TEMPLATE)).

## Run

```bash
npm install
npx expo start        # scan the QR code with Expo Go
npm test              # unit tests (shelf layout, grouping, metadata, Goodreads import)
npx tsc --noEmit && npx expo lint
```

Optional: copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY`. Google Books is a fallback for page counts, genres and book heights, and its keyless quota is often exhausted. Open Library works without a key.

## Deploy the web app

The web app is a static build on Cloudflare Pages (project `mybookie`). CI deploys it (see below); to deploy by hand:

```bash
npm run deploy:staging      # test build at a fixed staging link (staging.mybookie.pages.dev)
npm run deploy:prod         # production (mybookie.pages.dev)
npm run export:cloudflare   # just the build both use: expo export --platform web, readied for Cloudflare
```

The first deploy asks you to log in to Cloudflare. Always build with `npm run export:cloudflare`, not a plain `expo export`: `wrangler pages deploy` never uploads files inside a `node_modules` folder, and Expo puts package assets (including SQLite's `wa-sqlite.wasm`) under `dist/assets/node_modules/`. Without them the library can't open. `scripts/prepare-cloudflare.mjs` moves them to `assets/vendor/` and adds a `_redirects` rewrite.

`public/` holds the web shell: `index.html` (manifest and iOS home-screen tags), `manifest.json` and the home-screen icons. On web, only use SQLite's async API (`getAllAsync`, `runAsync`, kv-store `getItem`…): the sync calls need `SharedArrayBuffer`, which needs the cross-origin isolation headers in the `expo-router` plugin in `app.json`. `expo start` sends those headers but the static build on Cloudflare doesn't, so sync calls would work locally and fail on the live site.

### The old address

Bookie used to live at `bookie.expo.app` (EAS Hosting). It's frozen on its last deploy, which shows a "Bookie has moved" banner: a library lives in the browser, tied to the address it was saved at, so **Move my books** opens `mybookie.pages.dev/move-in` in a new window and hands the library across with `postMessage` (the same JSON as Export backup, plus the shelf layout). Books already there are skipped and nothing at the old address is deleted. Settings → Export backup and Restore from backup also work across the two.

The old address is no longer updated, so keep the receiving side working with it: `src/app/move-in.tsx` and the message format in `src/library/move.ts` (each side only accepts messages from the other's exact origin). Don't send `Cross-Origin-Opener-Policy` from `mybookie.pages.dev`: it cuts the new window off from the old one. Bookie can only open its library in one tab per address, so a move fails if `mybookie.pages.dev` is already open in another tab; the banner says so.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request into `master` (and on pushes to it):

1. **Tests**: the unit tests. Required to merge.
2. **Build**: the same web export the deploy uses. Required to merge.
3. **Typecheck & lint**: advisory. A failure shows as a red cross on the PR but doesn't have to block merging.
4. **Preview deploy**: after Build, deploys that build to Cloudflare Pages under the PR's branch name (`<branch>.mybookie.pages.dev`, the same address for every push to the PR) and posts it on the PR. It's a separate, empty library from the live app.
5. **Deploy to production**: only on pushes to `master` (a merged PR or a direct push). Waits for Tests and Build, then deploys that build to Cloudflare Pages production (`mybookie.pages.dev`). Typecheck & lint doesn't hold it up.

On a PR, the first four run in parallel. `npm run deploy:prod` and `npm run deploy:staging` still work for deploying by hand. One-time setup in the GitHub repo (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` secret (needed for previews and the production deploy): create one at dash.cloudflare.com → My Profile → API Tokens → Create Token → Custom token, with the permission Account → Cloudflare Pages → Edit, for your account. Without it those jobs skip their Cloudflare steps.
- `CLOUDFLARE_ACCOUNT_ID` variable (Variables tab): your account ID, shown in the Cloudflare dashboard (Workers & Pages → Overview, on the right) or in the address bar after `dash.cloudflare.com/`.
- `GOOGLE_BOOKS_API_KEY` secret (optional): the same value as in `.env.local`, so preview builds match the live app.

To block merging until the right checks pass: Settings → Branches (or Rules → Rulesets) → protect `master` → require a pull request and require the **Tests** and **Build** status checks. Leave **Typecheck & lint** (and **Preview deploy**) off that list to keep them optional. Check names come from each job's `name:` in the workflow, and a check only appears in the list after it has run once.

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
- `src/components/BookFlight.tsx`: the book flying between its shelf and its page (geometry in `src/library/bookFlight.ts`)
- `src/components/ScreenTransitions.tsx`: screen slides on web (which way to slide: `src/library/screenTransition.ts`)
- `src/library/fields.ts`: what each book field accepts
- `src/library/move.ts`, `src/app/move-in.tsx`, `src/components/MovedBanner.tsx`: moving a library from the old address
- `scripts/prepare-cloudflare.mjs`: readies the web build for Cloudflare Pages
- `src/app/`: screens (bookshelf, book detail, add: search / scan / manual / import)
