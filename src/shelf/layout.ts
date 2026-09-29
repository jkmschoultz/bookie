import type { Book } from '@/types';

import type { ShelfGroup } from './grouping';
import { hashUnit } from './hash';
import { getSpineStyle, type SpineStyle } from './spineStyle';

export type LayoutMode = 'row' | 'wrap';

export interface SpineItem {
  kind: 'spine';
  key: string;
  book: Book;
  style: SpineStyle;
  width: number;
}

/** A few books lying flat on top of each other. */
export interface StackItem {
  kind: 'stack';
  key: string;
  books: { book: Book; style: SpineStyle }[];
  width: number;
  height: number;
}

/** Separates two groups sharing a shelf in wrap mode. */
export interface BookendItem {
  kind: 'bookend';
  key: string;
  width: number;
}

export type ShelfItem = SpineItem | StackItem | BookendItem;

/** A brass label plate on the shelf edge, positioned under the group's first book. */
export interface ShelfLabel {
  groupKey: string;
  label: string;
  count: number;
  /** Offset from the start of the row's content, in px. */
  x: number;
}

export interface ShelfRow {
  key: string;
  labels: ShelfLabel[];
  items: ShelfItem[];
  width: number;
}

export interface LayoutOptions {
  mode: LayoutMode;
  /** Usable shelf width in px (only used in wrap mode). */
  shelfWidth: number;
  /** Gap between items on a shelf. */
  gap?: number;
  scale?: number;
  /** Books lying flat may not be taller than this. */
  maxStackHeight?: number;
}

export const BOOKEND_WIDTH = 12;
const STACK_CHANCE = 0.4;
const STACK_MIN_GROUP = 5;
/** Room for the books in a pile to sit slightly out of line. */
export const STACK_JITTER = 8;

/** Decide deterministically whether a group ends in a flat stack, and of how many books. */
function stackSize(group: ShelfGroup, styles: SpineStyle[], maxHeight: number): number {
  if (group.books.length < STACK_MIN_GROUP || hashUnit(group.key, 'stack') > STACK_CHANCE) return 0;
  const want = 2 + Math.floor(hashUnit(group.key, 'n') * 2); // 2–3 books
  let height = 0;
  let n = 0;
  for (let i = styles.length - 1; i >= 0 && n < want; i--) {
    if (height + styles[i].width > maxHeight) break;
    height += styles[i].width;
    n++;
  }
  return n >= 2 ? n : 0;
}

function itemsForGroup(group: ShelfGroup, scale: number, maxStackHeight: number): ShelfItem[] {
  const styles = group.books.map((b) => getSpineStyle(b, scale));
  const stacked = stackSize(group, styles, maxStackHeight);
  const upright = group.books.length - stacked;

  const items: ShelfItem[] = [];
  for (let i = 0; i < upright; i++) {
    const book = group.books[i];
    items.push({ kind: 'spine', key: `b${book.id}`, book, style: styles[i], width: styles[i].width });
  }
  if (stacked) {
    // Biggest book on the bottom, like a real pile.
    const books = group.books
      .slice(upright)
      .map((book, i) => ({ book, style: styles[upright + i] }))
      .sort((a, b) => b.style.height - a.style.height);
    items.push({
      kind: 'stack',
      key: `s${books.map((b) => b.book.id).join('-')}`,
      books,
      width: Math.max(...books.map((b) => b.style.height)) + STACK_JITTER,
      height: books.reduce((h, b) => h + b.style.width, 0),
    });
  }
  return items;
}

function rowWidth(items: ShelfItem[], gap: number): number {
  return items.reduce((w, it) => w + it.width, 0) + Math.max(0, items.length - 1) * gap;
}

/**
 * row:  groups are never split. A group wider than the screen gets its own
 *       horizontally swipeable shelf; smaller groups share shelves, separated
 *       by bookends.
 * wrap: groups flow along shelves like a real bookcase, separated by bookends,
 *       wrapping onto the next shelf at the screen width. Nothing scrolls sideways.
 */
export function layoutShelves(groups: ShelfGroup[], opts: LayoutOptions): ShelfRow[] {
  const gap = opts.gap ?? 1;
  const scale = opts.scale ?? 1;
  const maxStackHeight = opts.maxStackHeight ?? 110 * scale;
  const rows: ShelfRow[] = [];

  let items: ShelfItem[] = [];
  let labels: ShelfLabel[] = [];
  let width = 0;
  const flush = () => {
    if (!items.length) return;
    rows.push({ key: `row${rows.length}:${items[0].key}`, labels, items, width: rowWidth(items, gap) });
    items = [];
    labels = [];
    width = 0;
  };
  const place = (item: ShelfItem) => {
    width += (items.length ? gap : 0) + item.width;
    items.push(item);
  };
  const fits = (w: number) => width + (items.length ? gap : 0) + w <= opts.shelfWidth;
  const startGroup = (group: ShelfGroup) => {
    if (items.length) place({ kind: 'bookend', key: `end:${group.key}`, width: BOOKEND_WIDTH });
    labels.push({ groupKey: group.key, label: group.label, count: group.books.length, x: width + (items.length ? gap : 0) });
  };

  for (const group of groups) {
    const groupItems = itemsForGroup(group, scale, maxStackHeight);

    if (opts.mode === 'row') {
      const groupWidth = rowWidth(groupItems, gap);
      if (groupWidth > opts.shelfWidth) {
        flush();
        startGroup(group);
        groupItems.forEach(place);
        flush();
        continue;
      }
      if (items.length && !fits(BOOKEND_WIDTH + gap + groupWidth)) flush();
      startGroup(group);
      groupItems.forEach(place);
      continue;
    }

    // Start a new shelf if not even the bookend and first book fit on this one.
    if (items.length && !fits(BOOKEND_WIDTH + gap + groupItems[0].width)) flush();
    startGroup(group);
    for (const item of groupItems) {
      if (items.length && !fits(item.width)) flush();
      place(item);
    }
  }
  flush();
  return rows;
}
