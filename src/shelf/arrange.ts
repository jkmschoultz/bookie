import type { Book } from '@/types';

import { groupBooks, combineRanges, type SortMode } from './grouping';
import { layoutShelves, type LayoutMode, type ShelfRow } from './layout';
import { spineWidth } from './spineStyle';

/**
 * The shelves a set of books makes in a given sort: grouped, letters or decades combined into ranges that fill a
 * shelf, then laid out. Every sort goes through here, so piles and the rest of the layout apply to all of them alike.
 */
export function arrangeShelves(
  books: Book[],
  opts: { sortMode: SortMode; layoutMode: LayoutMode; shelfWidth: number; zoom: number; gap: number },
): ShelfRow[] {
  const { sortMode, layoutMode, shelfWidth, zoom, gap } = opts;
  const widthOf = (g: { books: Book[] }) => g.books.reduce((w, b) => w + spineWidth(b.pageCount) * zoom + gap, 0);
  const groups = combineRanges(groupBooks(books, sortMode), shelfWidth, widthOf);
  return layoutShelves(groups, { mode: layoutMode, shelfWidth, gap, zoom });
}
