/**
 * Estimates how wide a line of text will render, without measuring it (layout runs before anything is drawn).
 * Widths are per glyph class, in ems, for the bold faces the shelf uses (Georgia Bold, the system font in bold).
 * They err on the wide side: overestimating only makes text shrink or wrap a little early, while underestimating
 * would bring back "…".
 */

export type TextFont = 'serif' | 'sans';

const SPACE = 0.27;
const NARROW = 0.3; // i l j . , : ; ' ! |
const SEMI_NARROW = 0.42; // t f r I ( ) [ ] -
const DIGIT = 0.62;
const LOWER = 0.6;
const WIDE_LOWER = 0.88; // m w
const UPPER = { serif: 0.75, sans: 0.71 } as const;
const WIDE_UPPER = 0.98; // M W
const OTHER = 0.72; // & ? and anything unusual
/** Headroom on top of the estimate. */
const SAFETY = 1.08;

function glyph(ch: string, font: TextFont): number {
  if (ch === ' ') return SPACE;
  if ("ilj.,:;'’!|".includes(ch)) return NARROW;
  if ('tfrI()[]-'.includes(ch)) return SEMI_NARROW;
  if (ch === 'm' || ch === 'w') return WIDE_LOWER;
  if (ch === 'M' || ch === 'W') return WIDE_UPPER;
  if (ch >= '0' && ch <= '9') return DIGIT;
  if (ch.toLowerCase() !== ch.toUpperCase()) return ch === ch.toUpperCase() ? UPPER[font] : LOWER;
  return OTHER;
}

export function textWidth(
  text: string,
  fontSize: number,
  { font = 'sans', letterSpacing = 0, italic = false }: { font?: TextFont; letterSpacing?: number; italic?: boolean } = {},
): number {
  let ems = 0;
  for (const ch of text) ems += glyph(ch, font);
  // Italic is set in the regular weight, which is narrower than bold.
  const weight = italic ? 0.9 : 1;
  return (ems * fontSize * weight + [...text].length * letterSpacing) * SAFETY;
}
