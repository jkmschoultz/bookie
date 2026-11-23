import type { Book } from '@/types';

import { groupBooks } from './grouping';
import { getSpineLook, type SpineLook } from './spineStyle';

/**
 * A friend's books on their bookcase in the Friends hallway: their real books, in the order their own shelf shows them
 * (by genre), each once, filling the shelves from the top. A bookcase with few books is mostly empty: a lone book leans
 * against the side, and a part-filled shelf ends in a bookend. Only so many are drawn, to keep the hallway light.
 */

export interface HallwaySpine {
  key: string;
  style: SpineLook;
  /** Drawn size in the hallway. */
  width: number;
  height: number;
}

export interface HallwayShelf {
  spines: HallwaySpine[];
  /** A lone book on its shelf, leaning against the side. */
  lean: boolean;
  /** A bookend after the last book, holding up a part-filled shelf. */
  bookend: boolean;
}

/** Books drawn per bookcase at most. */
export const MAX_HALLWAY_BOOKS = 96;
/** Space between books. */
const GAP = 1;
/** A shelf less full than this, with more than one book, ends in a bookend. */
const PART_FULL = 0.7;

/**
 * The books on each shelf of a bookcase `shelves` high and `room` wide, drawn at `scale`. Spines are styled as on the
 * friend's own shelf (getSpineLook at full size, then scaled), so they keep the same colours and ornaments. Filling
 * starts at `firstShelf` (the one at eye level, where a few books are easiest to see), carries on down, then fills the
 * shelves above.
 */
export function hallwayShelves(books: Book[], shelves: number, room: number, scale: number, firstShelf = 0): HallwayShelf[] {
  const ordered = groupBooks(books, 'genre').flatMap((g) => g.books);
  const rows: HallwaySpine[][] = Array.from({ length: shelves }, () => []);
  const start = Math.min(Math.max(0, firstShelf), shelves - 1);
  const order = Array.from({ length: shelves }, (_, i) => (start + i) % shelves);
  let at = 0;
  let used = 0;
  for (const book of ordered.slice(0, MAX_HALLWAY_BOOKS)) {
    const style = getSpineLook(book);
    const width = Math.max(2, Math.round(style.width * scale));
    if (used + width > room) {
      at++;
      used = 0;
      if (at >= shelves) break;
    }
    rows[order[at]].push({ key: `${book.id}`, style, width, height: style.height * scale });
    used += width + GAP;
  }
  return rows.map((spines) => {
    const filled = spines.reduce((w, s) => w + s.width + GAP, 0);
    return { spines, lean: spines.length === 1, bookend: spines.length > 1 && filled < room * PART_FULL };
  });
}
