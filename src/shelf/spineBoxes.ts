import { LINE_HEIGHT, type SpineText } from './spineText';
import { textWidth } from './textWidth';

/**
 * Where things are drawn on a spine, as boxes in px from its top-left corner as it stands upright: its title and author,
 * and its ornaments. getSpineStyle uses them to keep ornaments off the text, and tests check that nothing overlaps.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SpineDecoration = 'plain' | 'bands' | 'band' | 'label' | 'frame';

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
  /** The frame's and label's sides: how far in from the spine's long edges, and how thick (at most). */
  side: 3,
  line: 1,
} as const;

/** The least clear space between text and an ornament. */
export const ORNAMENT_GAP = 1;

/**
 * How far the text must stay in from each long edge of the spine for this decoration: the frame and label have sides
 * running down the spine, so the text must fit between them.
 */
export function sideInset(decoration: SpineDecoration): number {
  return decoration === 'frame' || decoration === 'label' ? DECORATION.side + DECORATION.line + ORNAMENT_GAP : 0;
}

/** The author's line height, as a share of its size (the platform's default for a single line). */
const AUTHOR_LINE = 1.2;
/** The author never takes more than this share of the text's length (see Spine.tsx). */
const AUTHOR_SHARE = 0.4;

/** The title's box, and the author's when there's one: as thick as their lines and as long as their text. */
export function textBoxes(width: number, height: number, text: SpineText): Box[] {
  const length = height - text.start - text.end;
  const across = (lines: number, size: number, lineHeight: number) => Math.min(width, lines * size * lineHeight);
  const titleThickness = across(text.numberOfLines, text.fontSize, LINE_HEIGHT);
  const boxes: Box[] = [{ x: (width - titleThickness) / 2, y: text.start, w: titleThickness, h: Math.min(text.titleLength, length) }];
  if (text.author) {
    const thickness = across(1, text.authorSize, AUTHOR_LINE);
    const authorLength = Math.min(textWidth(text.author, text.authorSize, { italic: true }), length * AUTHOR_SHARE);
    boxes.push({ x: (width - thickness) / 2, y: height - text.end - authorLength, w: thickness, h: authorLength });
  }
  return boxes;
}

/** The ornament's pieces as drawn in Spine.tsx (Decoration). */
export function decorationBoxes(decoration: SpineDecoration, width: number, height: number, text: SpineText): Box[] {
  const { band, bands, frame, labelPad, side, line } = DECORATION;
  const outline = (top: number, bottom: number): Box[] => [
    { x: side, y: top, w: width - 2 * side, h: line },
    { x: side, y: bottom - line, w: width - 2 * side, h: line },
    { x: side, y: top, w: line, h: bottom - top },
    { x: width - side - line, y: top, w: line, h: bottom - top },
  ];
  switch (decoration) {
    case 'bands':
      return [
        { x: 0, y: bands.outer, w: width, h: 2 },
        { x: 0, y: bands.inner, w: width, h: 1 },
        { x: 0, y: height - bands.inner - 1, w: width, h: 1 },
        { x: 0, y: height - bands.outer - 2, w: width, h: 2 },
      ];
    case 'band':
      return [{ x: 0, y: band.top, w: width, h: band.height }];
    case 'frame':
      return outline(frame, height - frame);
    case 'label': {
      const top = text.start - labelPad;
      return outline(top, top + labelBoxHeight(height, text));
    }
    default:
      return [];
  }
}

/** The label box's length: around the title, but never past the end of the text's room. */
export function labelBoxHeight(height: number, text: SpineText): number {
  const pad = DECORATION.labelPad;
  return Math.min(text.titleLength + 2 * pad, height - text.start - text.end + 2 * pad);
}

export function overlaps(a: Box, b: Box, gap = 0): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

/** Whether any ornament comes within `gap` of the text. The label's sides wrap the title, so only its lines count. */
export function ornamentsClear(decoration: SpineDecoration, width: number, height: number, text: SpineText, gap = ORNAMENT_GAP): boolean {
  const words = textBoxes(width, height, text);
  return decorationBoxes(decoration, width, height, text).every((o) => words.every((t) => !overlaps(o, t, gap)));
}

/* Colour */

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `b` laid over `a` at `t` opacity. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  return toHex(pa.map((c, i) => c * (1 - t) + pb[i] * t));
}

/** Text on spines: dark ink or cream. */
export const INK = '#1d1a16';
export const CREAM = '#f4ecd8';
/** WCAG AA for normal text: spine titles are small, so they need it. */
export const MIN_CONTRAST = 4.5;

/** Whichever of ink or cream reads better on this colour. */
export function contrastText(bg: string): string {
  return contrastRatio(INK, bg) >= contrastRatio(CREAM, bg) ? INK : CREAM;
}

/**
 * A text colour and the spine colour to set it on, with at least MIN_CONTRAST between them on every background the text
 * sits on (`under` turns the spine colour into what's under the text, e.g. the label's light wash). Mid-tones where
 * neither ink nor cream is enough are darkened or lightened a little, as little as it takes.
 */
export function readableColours(color: string, under: (c: string) => string[] = (c) => [c]): { color: string; textColor: string } {
  const worst = (text: string, c: string) => Math.min(...under(c).map((bg) => contrastRatio(text, bg)));
  const textColor = worst(INK, color) >= worst(CREAM, color) ? INK : CREAM;
  if (worst(textColor, color) >= MIN_CONTRAST) return { color, textColor };
  const towards = textColor === CREAM ? '#000000' : '#ffffff';
  for (let t = 0.04; t <= 1; t += 0.04) {
    const next = mix(color, towards, t);
    if (worst(textColor, next) >= MIN_CONTRAST) return { color: next, textColor };
  }
  return { color: towards, textColor };
}
