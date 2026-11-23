import { cleanDisplayName, usernameKey, usernameProblem } from '../shared/account';
import type { Ctx } from './context';
import { ApiError, badRequest } from './http';

export interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
}

export function findUser(ctx: Ctx, username: string): Promise<UserRow | null> {
  return ctx.db.prepare('SELECT id, username, display_name FROM users WHERE username_key = ?').bind(usernameKey(username)).first<UserRow>();
}

/** A username and display name for a new account, checked; refused if the username is taken. */
export async function newUserFields(ctx: Ctx, body: Record<string, unknown>): Promise<{ username: string; displayName: string | null }> {
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const problem = usernameProblem(username);
  if (problem) throw badRequest(problem, 'invalid_username');
  if (await findUser(ctx, username)) throw usernameTaken();
  return { username, displayName: cleanDisplayName(body.displayName) };
}

export const usernameTaken = () => new ApiError(409, 'username_taken', 'That username is taken. Try another.');

export const insertUser = (ctx: Ctx, id: string, username: string, displayName: string | null) =>
  ctx.db
    .prepare('INSERT INTO users (id, username, username_key, display_name, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, username, usernameKey(username), displayName, ctx.now);

/** Whether a failed insert was the username's unique index: someone took it a moment ago. */
export const isUniqueClash = (e: unknown) => e instanceof Error && /UNIQUE constraint failed: users\.username_key/.test(e.message);
