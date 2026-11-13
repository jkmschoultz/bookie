/**
 * What each book field accepts. Form fields hold text while editing: `digitsOnly` and friends tidy what's typed, and
 * the `check*` functions say what's wrong with it (or null when it's fine, including when it's left empty).
 */

export const PAGE_MAX = 20_000;
export const HEIGHT_MM = { min: 50, max: 500 } as const;
export const GENRE_MAX_LENGTH = 30;

/** Keeps the digits, up to `max` of them. */
export function digitsOnly(text: string, max: number): string {
  return text.replace(/\D/g, '').slice(0, max);
}

/** Keeps a number with at most one decimal point, e.g. a series index like 2.5. */
export function decimalOnly(text: string, maxLength = 6): string {
  const [whole, ...rest] = text.replace(/[^\d.]/g, '').split('.');
  return (rest.length ? `${whole}.${rest.join('')}` : whole).slice(0, maxLength);
}

/** Keeps the characters an ISBN can have: digits, hyphens and spaces, plus X as the last ISBN-10 digit. */
export function isbnChars(text: string): string {
  return text.replace(/[^\dXx\- ]/g, '').toUpperCase().slice(0, 17);
}

export function checkPageCount(text: string): string | null {
  if (!text) return null;
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= PAGE_MAX ? null : `Pages must be a whole number from 1 to ${PAGE_MAX.toLocaleString('en')}`;
}

export function checkYear(text: string, now = new Date()): string | null {
  if (!text) return null;
  const n = Number(text);
  const latest = now.getFullYear() + 1;
  return /^\d{1,4}$/.test(text) && n >= 1 && n <= latest ? null : `Year published must be from 1 to ${latest}`;
}

export function checkHeight(text: string): string | null {
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= HEIGHT_MM.min && n <= HEIGHT_MM.max ? null : `Height must be from ${HEIGHT_MM.min} to ${HEIGHT_MM.max} mm`;
}

export function checkSeriesIndex(text: string): string | null {
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && n < 10_000 ? null : 'Series number must be a number, like 2 or 2.5';
}

/** True for a well-formed ISBN-10 or ISBN-13 whose check digit adds up. */
export function isValidIsbn(raw: string): boolean {
  const s = raw.replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(s)) {
    const sum = [...s].reduce((acc, c, i) => acc + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
    return sum % 11 === 0;
  }
  if (/^\d{13}$/.test(s)) {
    const sum = [...s].reduce((acc, c, i) => acc + Number(c) * (i % 2 ? 3 : 1), 0);
    return sum % 10 === 0;
  }
  return false;
}

export function checkIsbn(text: string): string | null {
  if (!text.trim()) return null;
  return isValidIsbn(text) ? null : 'That ISBN doesn’t look right: check for a missing or mistyped digit';
}

/** A real calendar date in YYYY-MM-DD form. */
export function isValidDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Problems with a started/finished pair. Either can be empty; `today` is YYYY-MM-DD. */
export function checkReadingDates(started: string, finished: string, today: string): { started: string | null; finished: string | null } {
  const one = (v: string) => (!v ? null : !isValidDate(v) ? 'Use a real date, like 2024-03-17' : v > today ? 'That’s in the future' : null);
  const result = { started: one(started), finished: one(finished) };
  if (!result.started && !result.finished && started && finished && finished < started) result.finished = 'Finished is before started';
  return result;
}

/**
 * A custom genre as typed: trimmed, spaces collapsed, and matched to an existing genre regardless of case so
 * "science fiction" joins the "Science Fiction" shelf instead of starting a new one. Null when there's nothing left.
 */
export function cleanGenre(text: string, existing: string[]): string | null {
  const name = text.replace(/\s+/g, ' ').trim().slice(0, GENRE_MAX_LENGTH);
  if (!name) return null;
  return existing.find((g) => g.toLowerCase() === name.toLowerCase()) ?? name;
}

/** Typing a date on a number pad: keeps up to 8 digits and puts the dashes in, so 20240317 reads 2024-03-17. */
export function formatDateTyping(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join('-');
}
