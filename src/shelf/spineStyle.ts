import type { Book } from '@/types';

import { hashUnit } from './hash';
import { contrastText, DECORATION, mix, ornamentsClear, readableColours, relativeLuminance, sideInset, textBoxes, type Box, type SpineDecoration } from './spineBoxes';
import { END_PAD, fitSpineText, LINE_HEIGHT, TITLE_SIZE, type SpineText } from './spineText';

export { contrastText, DECORATION, relativeLuminance, type SpineDecoration };

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

/** Books you don't own are drawn this faded, standing up or lying flat; a wanted one is a ghost instead (see spineCues). */
export const UNOWNED_OPACITY = 0.5;

const DECORATIONS: SpineDecoration[] = ['plain', 'bands', 'band', 'label', 'frame', 'bands'];
/** Styles that show off a second cover colour: a thick band, thin top and bottom bands, or an inset frame. */
const ACCENT_DECORATIONS: SpineDecoration[] = ['band', 'bands', 'frame'];

/** Clear space kept between the text and each end of the spine, so decorations frame the text instead of crossing it. */
const TEXT_INSETS: Record<SpineDecoration, { start: number; end: number }> = {
  plain: { start: END_PAD, end: END_PAD },
  label: { start: END_PAD, end: END_PAD }, // the box is drawn around the title itself
  frame: { start: 16, end: 16 },
  bands: { start: 22, end: 22 },
  band: { start: DECORATION.band.top + DECORATION.band.height + 10, end: END_PAD },
};

/** When the chosen ornament would touch the text (a thin spine has no room inside a frame), the next one tried. */
const FALLBACK: Record<SpineDecoration, SpineDecoration | null> = { frame: 'bands', label: 'bands', band: 'bands', bands: 'plain', plain: null };

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
  /** Where the title and author are, at the normal size (zoom 1), for drawing anything else on the spine clear of them. */
  textBoxes: Box[];
  /** How much bigger than normal the spine is drawn, ornaments and all (see zoomSpineStyle). */
  zoom: number;
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

/** The label's light wash behind the title (Spine.tsx). */
export const LABEL_WASH = { color: '#fff8e6', opacity: 0.12 } as const;

/** What a spine looks like before its text is set: size, colours, typeface and the ornament it would like. */
function pickLook(book: Book, scale: number) {
  const seed = bookSeed(book);
  // A colour the user picked wins; otherwise the cover's colours; otherwise one from the palette.
  const [coverColor, coverAccent] = book.spineColor ? [] : (book.coverPalette ?? []);
  const base = book.spineColor ?? coverColor ?? PALETTE[Math.floor(hashUnit(seed, 'c') * PALETTE.length)];
  const light = relativeLuminance(base) > 0.33;
  const decorations = coverAccent ? ACCENT_DECORATIONS : DECORATIONS;
  return {
    base,
    width: spineWidth(book.pageCount, scale),
    height: spineHeight(book, scale),
    font: (hashUnit(seed, 'f') < 0.6 ? 'serif' : 'sans') as SpineFont,
    uppercase: hashUnit(seed, 'u') < 0.45,
    decoration: decorations[Math.floor(hashUnit(seed, 'd') * decorations.length)],
    accentColor: coverAccent ?? (light ? '#7a5c1e' : '#d4af61'),
  };
}

/** The text set on the spine, and the ornament it gets: the one it would like, or a plainer one when that would touch the text. */
function setText(book: Book, look: ReturnType<typeof pickLook>): { decoration: SpineDecoration; text: SpineText } {
  const { width, height, font, uppercase } = look;
  let decoration = look.decoration;
  for (;;) {
    const text = fitSpineText(book.title, book.authors[0], { width, height, font, uppercase, ...TEXT_INSETS[decoration], side: sideInset(decoration) });
    const next = FALLBACK[decoration];
    if (!next || ornamentsClear(decoration, width, height, text)) return { decoration, text };
    decoration = next;
  }
}

/** Text that reads on the spine, and on the label's wash behind the title. */
const readable = (base: string, decoration: SpineDecoration) =>
  readableColours(base, (c) => (decoration === 'label' ? [c, mix(c, LABEL_WASH.color, LABEL_WASH.opacity)] : [c]));

export function getSpineStyle(book: Book, scale = 1): SpineStyle {
  const look = pickLook(book, scale);
  const { decoration, text } = setText(book, look);
  const { width, height } = look;
  return {
    width,
    height,
    ...readable(look.base, decoration),
    accentColor: look.accentColor,
    decoration,
    font: look.font,
    uppercase: look.uppercase,
    text,
    textBoxes: textBoxes(width, height, text).map((b) => ({ ...b })),
    zoom: 1,
  };
}

/** A spine without its text: what getSpineStyle gives, for drawing books too small to have a readable title. */
export type SpineLook = Pick<SpineStyle, 'width' | 'height' | 'color' | 'accentColor' | 'decoration'>;

/**
 * The same size, colours and ornament as getSpineStyle, much more cheaply: the text is only set when it decides the
 * ornament, which is only for a frame or label on a spine too thin to be sure the title fits inside its sides.
 */
export function getSpineLook(book: Book, scale = 1): SpineLook {
  const look = pickLook(book, scale);
  const decoration =
    (look.decoration === 'frame' || look.decoration === 'label') && look.width - 2 * sideInset(look.decoration) < TITLE_SIZE.max * LINE_HEIGHT
      ? setText(book, look).decoration
      : look.decoration;
  return { width: look.width, height: look.height, color: readable(look.base, decoration).color, accentColor: look.accentColor, decoration };
}

/** The same spine drawn `zoom` times as big, text and ornaments too, so it looks just like the page zoomed in. */
export function zoomSpineStyle(style: SpineStyle, zoom: number): SpineStyle {
  if (zoom === style.zoom) return style;
  const k = zoom / style.zoom;
  const { text } = style;
  return {
    ...style,
    width: style.width * k,
    height: style.height * k,
    text: {
      ...text,
      start: text.start * k,
      end: text.end * k,
      titleLength: text.titleLength * k,
      fontSize: text.fontSize * k,
      authorSize: text.authorSize * k,
    },
    zoom,
  };
}
