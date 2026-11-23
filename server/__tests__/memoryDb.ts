import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { Db, Statement } from '../db';

/**
 * D1's API over an in-memory SQLite (Node's built-in), with the real migrations applied. D1 is SQLite too, so the
 * handlers' SQL runs here as it does in production; the end-to-end check against `wrangler pages dev` covers the rest.
 */
class MemoryStatement implements Statement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly values: SQLInputValue[] = [],
  ) {}
  bind(...values: unknown[]): Statement {
    return new MemoryStatement(this.db, this.sql, values as SQLInputValue[]);
  }
  async first<T>(): Promise<T | null> {
    return (this.db.prepare(this.sql).get(...this.values) as T | undefined) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.prepare(this.sql).all(...this.values) as T[] };
  }
  async run() {
    return { meta: { changes: Number(this.db.prepare(this.sql).run(...this.values).changes) } };
  }
  /** For batches: runs whatever kind of statement it is. */
  runNow() {
    const s = this.db.prepare(this.sql);
    return /\bRETURNING\b|^\s*SELECT/i.test(this.sql) ? s.all(...this.values) : s.run(...this.values);
  }
}

export interface MemoryDb extends Db {
  raw: DatabaseSync;
}

export function memoryDb(): MemoryDb {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  const dir = join(__dirname, '..', '..', 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) raw.exec(readFileSync(join(dir, file), 'utf8'));
  return {
    raw,
    prepare: (sql) => new MemoryStatement(raw, sql),
    async batch(statements) {
      raw.exec('BEGIN');
      try {
        const out = statements.map((s) => (s as MemoryStatement).runNow());
        raw.exec('COMMIT');
        return out;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
