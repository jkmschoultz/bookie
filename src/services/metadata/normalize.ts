import type { BookDraft } from '@/types';

type GenreRule = [genre: string, pattern: RegExp, nonfiction?: true];

/** Curated genres. Nonfiction genres never match subjects that mention fiction. */
const GENRE_RULES: GenreRule[] = [
  ['Graphic Novels', /graphic novel|comics?\b|manga/i],
  ['Poetry', /poetry|poems/i],
  ['Young Adult', /young adult|\bya\b|teen/i],
  ["Children's", /juvenile|children|picture book/i],
  ['Science Fiction', /science fiction|sci-fi|dystopi|space opera|cyberpunk/i],
  ['Fantasy', /fantasy|magic|dragons|wizards/i],
  ['Horror', /horror|ghost stor|supernatural/i],
  ['Mystery & Thriller', /myster|thriller|detective|crime|suspense|noir/i],
  ['Romance', /romance|love stories/i],
  ['Historical Fiction', /historical fiction|fiction.*histor/i],
  ['Classics', /classic/i],
  ['Literary Fiction', /literary fiction/i],
  ['Biography & Memoir', /biograph|memoir|autobiograph/i, true],
  ['Cooking', /cook|recipes|food/i, true],
  ['Travel', /travel/i, true],
  ['Art & Design', /\bart\b|design|photograph|architecture/i, true],
  ['Philosophy', /philosoph/i, true],
  ['Psychology', /psycholog/i, true],
  ['Religion & Spirituality', /religio|spiritual|theolog|bible/i, true],
  ['Business & Economics', /business|economic|management|finance|entrepreneur/i, true],
  ['Self-Help', /self-help|self help|personal development|success/i, true],
  ['Politics & Society', /politic|social science|sociology|society/i, true],
  ['Science & Nature', /science|nature|physics|biology|mathemat|astronom|evolution/i, true],
  ['Technology', /computer|programming|software|technology/i, true],
  ['History', /histor/i, true],
];

export const GENRES = GENRE_RULES.map(([g]) => g).concat('Nonfiction');

/**
 * Map free-form subjects/categories from any API onto our curated genre list.
 * Each genre is scored by how many subjects match it, weighted towards the
 * front of the list (APIs tend to list the most relevant subjects first).
 */
export function mapGenres(subjects: string[], max = 3): string[] {
  const scores = new Map<string, number>();
  subjects.forEach((subject, i) => {
    const weight = 1 / (1 + i / 10);
    const isFiction = /fiction/i.test(subject) && !/non-?fiction/i.test(subject);
    for (const [genre, pattern, nonfiction] of GENRE_RULES) {
      if (nonfiction && isFiction) continue;
      if (pattern.test(subject)) scores.set(genre, (scores.get(genre) ?? 0) + weight);
    }
  });
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g).slice(0, max);
  if (ranked.length) return ranked;
  if (subjects.some((s) => /non-?fiction/i.test(s))) return ['Nonfiction'];
  if (subjects.some((s) => /fiction|novel/i.test(s))) return ['Literary Fiction'];
  return [];
}

export function parseYear(date: string | number | null | undefined): number | null {
  if (date == null) return null;
  const m = String(date).match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return m ? Number(m[1]) : null;
}

export function cleanIsbn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  return s.length === 10 || s.length === 13 ? s : null;
}

export function isbn10to13(isbn10: string): string {
  const core = '978' + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 ? 3 : 1);
  return core + ((10 - (sum % 10)) % 10);
}

/** Parse physical height strings like "24 cm", "9.2 x 6.1 x 1 inches", "20 x 13 x 2 centimeters". */
export function parseHeightMm(dim: string | null | undefined): number | null {
  if (!dim) return null;
  const nums = [...dim.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  if (!nums.length) return null;
  const tallest = Math.max(...nums);
  if (/inch|\bin\b|"/i.test(dim)) return Math.round(tallest * 25.4);
  if (/mm|millimet/i.test(dim)) return Math.round(tallest);
  return Math.round(tallest * 10); // default: centimetres
}

/** "The Fellowship of the Ring (The Lord of the Rings, #1)" → series info + clean title. */
export function splitSeries(title: string): { title: string; series: string | null; seriesIndex: number | null } {
  const m = title.match(/^(.*?)\s*\(([^()]+?),?\s*#(\d+(?:\.\d+)?)\)\s*$/);
  if (!m) return { title: title.trim(), series: null, seriesIndex: null };
  return { title: m[1].trim(), series: m[2].trim(), seriesIndex: Number(m[3]) };
}

/** Fill any empty fields in `base` from `extra`. */
export function mergeDrafts(base: BookDraft, extra: Partial<BookDraft> | null): BookDraft {
  if (!extra) return base;
  const out: BookDraft = { ...base };
  for (const key of Object.keys(extra) as (keyof BookDraft)[]) {
    const current = out[key];
    const empty = current == null || current === '' || (Array.isArray(current) && current.length === 0);
    if (empty && extra[key] != null) (out as unknown as Record<string, unknown>)[key] = extra[key];
  }
  return out;
}
