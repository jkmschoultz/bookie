import type { SQLiteDatabase } from 'expo-sqlite';

/** Append-only. Each entry runs once, tracked via PRAGMA user_version. */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    isbn13 TEXT,
    isbn10 TEXT,
    title TEXT NOT NULL,
    subtitle TEXT,
    authors TEXT NOT NULL DEFAULT '[]',
    genres TEXT NOT NULL DEFAULT '[]',
    series TEXT,
    series_index REAL,
    page_count INTEGER,
    published_year INTEGER,
    publisher TEXT,
    cover_url TEXT,
    height_mm REAL,
    spine_color TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'owned',
    rating REAL,
    owned INTEGER NOT NULL DEFAULT 1,
    date_added TEXT NOT NULL,
    date_started TEXT,
    date_finished TEXT,
    notes TEXT
  );
  CREATE INDEX idx_books_isbn13 ON books(isbn13);
  `,
  `
  ALTER TABLE books ADD COLUMN cover_palette TEXT;
  `,
  // For syncing with an account: an id that's the same on every device (a random UUID), when the book last changed
  // (ms), deletions kept as tombstones until they've been sent, and whether there's a change still to send.
  `
  ALTER TABLE books ADD COLUMN uid TEXT;
  ALTER TABLE books ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE books ADD COLUMN deleted_at INTEGER;
  ALTER TABLE books ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;
  UPDATE books SET
    uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' ||
      substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
    updated_at = CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER);
  CREATE UNIQUE INDEX idx_books_uid ON books(uid);
  CREATE INDEX idx_books_dirty ON books(dirty);
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
    });
    version++;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
