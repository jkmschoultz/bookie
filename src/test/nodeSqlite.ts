import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * The parts of expo-sqlite's async API that Bookie uses, over Node's built-in SQLite, so the library's SQL (and its
 * migrations) can be tested as they run on a device.
 */
export function nodeSqlite(): SQLiteDatabase {
  const raw = new DatabaseSync(':memory:');
  const args = (params: unknown[]): SQLInputValue[] => (params.length === 1 && Array.isArray(params[0]) ? params[0] : params) as SQLInputValue[];
  const db = {
    execAsync: async (sql: string) => raw.exec(sql),
    getFirstAsync: async (sql: string, ...params: unknown[]) => raw.prepare(sql).get(...args(params)) ?? null,
    getAllAsync: async (sql: string, ...params: unknown[]) => raw.prepare(sql).all(...args(params)),
    runAsync: async (sql: string, ...params: unknown[]) => {
      const res = raw.prepare(sql).run(...args(params));
      return { lastInsertRowId: Number(res.lastInsertRowid), changes: Number(res.changes) };
    },
    withTransactionAsync: async (fn: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await fn();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return db as unknown as SQLiteDatabase;
}
