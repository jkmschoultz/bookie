import type { Book } from '@/types';

import { hashUnit } from './hash';
import { END_PAD, fitSpineText, type SpineText } from './spineText';

export const SPINE = {
  /** Spine thickness per page, in layout px. A 300-page book ≈ 26px. */
  pxPerPage: 0.085,
  minWidth: 12,
  maxWidth: 82,
  defaultPages: 300,
  /** px per mm of physical book height (240mm hardback → ~204px). */
  pxPerMm: 0.85,
  baseHeight: 180,
  minHeight: 132,
  maxHeight: 212,
} as const;

/** Clothbound / dust-jacket colours that read well on a wooden shelf. */
const PALETTE = [
  '#7a1f1f', '#a33a2a', '#c4622d', '#d89a3b', '#e3c27a', '#2f4a3a',
  '#3f6b4f', '#6b8f5e', '#1f3a5f', '#2e5c8a', '#5b7fa6', '#3b2f5c',
  '#6a4c93', '#8c3b6b', '#3a3a3a', '#1c1c1c', '#e8e0cf', '#b9a98a',
  '#4d6d73', '#7d5a3c', '#a07850', '#264653', '#9b2226', '#bb3e03',
];

export type SpineDecoration = 'plain' | 'bands' | 'band' | 'label' | 'frame';
const DECORATIONS: SpineDecoration[] = ['plain', 'bands', 'band', 'label', 'frame', 'bands'];
/** Styles that show off a second cover colour: a thick band, thin top and bottom bands, or an inset frame. */
const ACCENT_DECORATIONS: SpineDecoration[] = ['band', 'bands', 'frame'];

/** Where decorations are drawn along the spine, in px from its ends (drawn in Spine.tsx). */
export const DECORATION = {
  /** The thick band near the top. */
  band: { top: 8, height: 10 },
  /** Double rules at each end: a 2px and a 1px line, 8px to 13px from the end. */
  bands: { outer: 8, inner: 12 },
  /** The inset frame. */
  frame: 5,
  /** Space between the label box and the title it surrounds. */
  labelPad: 5,
} as const;

/** Clear space kept between the text and each end of the spine, so decorations frame the text instead of crossing it. */
const TEXT_INSETS: Record<SpineDecoration, { start: number; end: number }> = {
  plain: { start: END_PAD, end: END_PAD },
  label: { start: END_PAD, end: END_PAD }, // the box is drawn around the title itself
  frame: { start: 16, end: 16 },
  bands: { start: 22, end: 22 },
  band: { start: DECORATION.band.top + DECORATION.band.height + 10, end: END_PAD },
};

export type SpineFont = 'serif' | 'sans';

export interface SpineStyle {
  width: number;
  height: number;
  color: string;
  textColor: string;
  accentColor: string;
  decoration: SpineDecoration;
  font: SpineFont;
  uppercase: boolean;
  /** How the title (and author) are set on the spine. */
  text: SpineText;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** A stable identity for hashing, even for books without an ISBN. */
export function bookSeed(book: Pick<Book, 'isbn13' | 'title' | 'authors'>): string {
  return book.isbn13 ?? `${book.title}|${book.authors.join(',')}`;
}

export function spineWidth(pageCount: number | null, scale = 1): number {
  const pages = pageCount && pageCount > 0 ? pageCount : SPINE.defaultPages;
  return Math.round(clamp(pages * SPINE.pxPerPage * scale, SPINE.minWidth * scale, SPINE.maxWidth * scale));
}

export function spineHeight(
  book: Pick<Book, 'heightMm' | 'isbn13' | 'title' | 'authors'>,
  scale = 1,
): number {
  const raw =
    book.heightMm && book.heightMm > 0
      ? book.heightMm * SPINE.pxPerMm
      : SPINE.baseHeight * (0.88 + hashUnit(bookSeed(book), 'h') * 0.24);
  return Math.round(clamp(raw, SPINE.minHeight, SPINE.maxHeight) * scale);
}

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastText(bg: string): string {
  return relativeLuminance(bg) > 0.33 ? '#1d1a16' : '#f4ecd8';
}

export function getSpineStyle(book: Book, scale = 1): SpineStyle {
  const seed = bookSeed(book);
  // A colour the user picked wins; otherwise the cover's colours; otherwise one from the palette.
  const [coverColor, coverAccent] = book.spineColor ? [] : (book.coverPalette ?? []);
  const color = book.spineColor ?? coverColor ?? PALETTE[Math.floor(hashUnit(seed, 'c') * PALETTE.length)];
  const light = relativeLuminance(color) > 0.33;
  const decorations = coverAccent ? ACCENT_DECORATIONS : DECORATIONS;
  const width = spineWidth(book.pageCount, scale);
  const height = spineHeight(book, scale);
  const decoration = decorations[Math.floor(hashUnit(seed, 'd') * decorations.length)];
  const font: SpineFont = hashUnit(seed, 'f') < 0.6 ? 'serif' : 'sans';
  const uppercase = hashUnit(seed, 'u') < 0.45;
  return {
    width,
    height,
    color,
    textColor: contrastText(color),
    accentColor: coverAccent ?? (light ? '#7a5c1e' : '#d4af61'),
    decoration,
    font,
    uppercase,
    text: fitSpineText(book.title, book.authors[0], { width, height, font, uppercase, ...TEXT_INSETS[decoration] }),
  };
}
