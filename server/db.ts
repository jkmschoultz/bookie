/**
 * The slice of D1's API the server uses. D1 satisfies it in production; tests pass an in-memory SQLite that does too,
 * so the handlers run unchanged against the same migrations.
 */
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

export interface Db {
  prepare(sql: string): Statement;
  /** Runs the statements in order as one transaction: all of them or none. */
  batch(statements: Statement[]): Promise<unknown[]>;
}

export interface Env {
  DB?: Db;
  /** Signs access tokens. At least 32 random bytes, set as a secret per Pages environment. */
  SESSION_SIGNING_KEY?: string;
  /** Extra web origins that may call the API, comma separated. Only for local development (.dev.vars). */
  ALLOWED_ORIGINS?: string;
}
