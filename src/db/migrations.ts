import type { SQLiteDatabase } from 'expo-sqlite';

/** Append-only. Each entry runs once, tracked via PRAGMA user_version. */
const MIGRATIONS: string[] = [
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
