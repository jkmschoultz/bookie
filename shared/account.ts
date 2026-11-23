/** Account rules shared by the app (to say what's wrong as you type) and the API (which has the final word). */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 10;
/** Long enough for any passphrase; stops someone sending megabytes to be hashed. */
export const PASSWORD_MAX = 200;
export const DISPLAY_NAME_MAX = 40;

/** What's wrong with a username, or null if it's fine. Letters, digits, _ and ., not starting or ending with a dot. */
export function usernameProblem(username: string): string | null {
  if (username.length < USERNAME_MIN) return `A username needs at least ${USERNAME_MIN} characters.`;
  if (username.length > USERNAME_MAX) return `A username can have at most ${USERNAME_MAX} characters.`;
  if (!/^[A-Za-z0-9_.]+$/.test(username)) return 'Use only letters, digits, _ and . in a username.';
  if (username.startsWith('.') || username.endsWith('.') || username.includes('..'))
    return 'A username can’t start or end with a dot, or have two in a row.';
  return null;
}

/** Usernames are unique whatever their case: "Johan" and "johan" are the same person. */
export function usernameKey(username: string): string {
  return username.trim().toLowerCase();
}

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `A password needs at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `A password can have at most ${PASSWORD_MAX} characters.`;
  return null;
}

/** A display name, trimmed and cut to length; empty means none. */
export function cleanDisplayName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, DISPLAY_NAME_MAX);
  return clean || null;
}

/** A recovery code as typed: case, spaces and dashes don't matter. */
export function normaliseRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** An account as the API describes it to its owner. */
export interface AccountSummary {
  id: string;
  username: string;
  displayName: string | null;
  /** Whether accepted friends can see the shelf. */
  shelfVisible: boolean;
  hasPassword: boolean;
  /** `here`: made on this address, so usable here (a passkey belongs to the site it was made on). */
  passkeys: { id: string; createdAt: number; lastUsedAt: number | null; here: boolean }[];
}
