/** WebCrypto helpers. Everything here runs the same in Workers, Node and browsers. */

const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** A random token, base64url, with `bytes` bytes of randomness. */
export function randomToken(bytes = 32): string {
  return toBase64Url(randomBytes(bytes));
}

export async function sha256(text: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))));
}

/** Compares in time that depends only on the length, so a match can't be found byte by byte. */
export function constantTimeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** The most PBKDF2 iterations Cloudflare Workers' WebCrypto accepts; it refuses more. */
export const PBKDF2_ITERATIONS = 100_000;

export interface PasswordHash {
  hash: string;
  salt: string;
  iterations: number;
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toBase64Url(new Uint8Array(bits));
}

/** PBKDF2-SHA256 with a fresh 16-byte salt. */
export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<PasswordHash> {
  const salt = randomBytes(16);
  return { hash: await pbkdf2(password, salt, iterations), salt: toBase64Url(salt), iterations };
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  return constantTimeEqual(await pbkdf2(password, fromBase64Url(stored.salt), stored.iterations), stored.hash);
}

/** A stored hash to check against when there's no such user, so a wrong username takes as long as a wrong password. */
export const DUMMY_HASH: PasswordHash = { hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', salt: 'AAAAAAAAAAAAAAAAAAAAAA', iterations: PBKDF2_ITERATIONS };

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function hmac(secret: string, message: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(message))));
}

/** Crockford base32, without letters that look like digits. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A recovery code: 16 characters (80 bits) in groups of four, e.g. 7KQ2-M9XA-0PZD-4RTB. */
export function recoveryCode(): string {
  const chars = [...randomBytes(16)].map((b) => CODE_ALPHABET[b & 31]).join('');
  return chars.match(/.{4}/g)!.join('-');
}
