import { textWidth, type TextFont } from './textWidth';

/** Title sizes in px: the smallest that's still comfortable to read, and the largest a spine uses. */
export const TITLE_SIZE = { min: 8, max: 13 } as const;
export const LINE_HEIGHT = 1.15;
/** Space kept clear at each end of the spine. */
export const END_PAD = 14;
/** Space kept clear along each long edge. */
const EDGE_PAD = 2;
const AUTHOR_GAP = 8;
/** The author never takes more than this share of the spine's length. */
const AUTHOR_SHARE = 0.4;
/** Spines thinner than this have no room for the author. */
const AUTHOR_MIN_WIDTH = 20;
/** Shrinking further than this to keep the author isn't worth it; the author is dropped instead. */
const AUTHOR_MIN_TITLE_SIZE = 10;

export interface SpineText {
  /** Clear space before and after the text along the spine (top and bottom when upright). */
  start: number;
  end: number;
  /** Estimated length of the title's longest line, for decorations that sit around it. */
  titleLength: number;
  /** The title split into the lines it's drawn on. */
  lines: string[];
  /** Lines allowed when drawing. Only more than `lines.length` in the last resort, where the title is cut off with "…". */
  numberOfLines: number;
  fontSize: number;
  /** Author's surname, or null when there's no room for it. */
  author: string | null;
  authorSize: number;
}

interface SpineBox {
  /** Thickness of the spine (across the text). */
  width: number;
  /** Length of the spine (along the text). */
  height: number;
  font: TextFont;
  uppercase: boolean;
  /** Clear space to keep at each end, e.g. below a decorative band. Defaults to END_PAD. */
  start?: number;
  end?: number;
}

/** Greedy word wrap. Null when a single word is longer than a whole line. */
function wrap(words: string[], maxWidth: number, measure: (s: string) => number): string[] | null {
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (measure(word) > maxWidth) return null;
    const joined = line ? `${line} ${word}` : word;
    if (line && measure(joined) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = joined;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * How to set a book's title on its spine without cutting it off: the largest size that fits, wrapping onto
 * more lines when the spine is thick enough, shrinking down to TITLE_SIZE.min, and dropping the author's
 * surname before going small. Only a title that can't fit even then is cut off.
 */
export function fitSpineText(title: string, author: string | undefined, box: SpineBox): SpineText {
  const text = box.uppercase ? title.toUpperCase() : title;
  const words = text.split(/\s+/).filter(Boolean);
  const start = box.start ?? END_PAD;
  const end = box.end ?? END_PAD;
  const length = box.height - start - end;
  const across = box.width - 2 * EDGE_PAD;
  const letterSpacing = box.uppercase ? 0.8 : 0.2;
  const largest = Math.max(TITLE_SIZE.min, Math.min(TITLE_SIZE.max, box.width * 0.42));
  const surname = box.width >= AUTHOR_MIN_WIDTH ? (author?.split(' ').at(-1) ?? null) : null;
  const measure = (s: string, size: number) => textWidth(s, size, { font: box.font, letterSpacing });
  const longest = (lines: string[], size: number) => Math.max(...lines.map((l) => measure(l, size)));
  const linesAt = (size: number) => Math.max(1, Math.floor(across / (size * LINE_HEIGHT)));
  const authorSizeAt = (size: number) => Math.max(7, size * 0.72);

  const attempt = (withAuthor: string | null, smallest: number): SpineText | null => {
    for (let size = largest; size >= smallest; size -= 0.5) {
      let room = length;
      if (withAuthor) {
        const authorWidth = textWidth(withAuthor, authorSizeAt(size), { italic: true });
        if (authorWidth > length * AUTHOR_SHARE) continue;
        room -= authorWidth + AUTHOR_GAP;
      }
      const lines = wrap(words, room, (s) => measure(s, size));
      if (lines && lines.length <= linesAt(size)) {
        const titleLength = longest(lines, size);
        return { start, end, titleLength, lines, numberOfLines: lines.length, fontSize: size, author: withAuthor, authorSize: authorSizeAt(size) };
      }
    }
    return null;
  };

  return (
    (surname ? attempt(surname, Math.min(largest, AUTHOR_MIN_TITLE_SIZE)) : null) ??
    attempt(null, TITLE_SIZE.min) ?? {
      // Last resort: let the text wrap as far as the spine allows and end in "…".
      start,
      end,
      titleLength: length,
      lines: [text],
      numberOfLines: linesAt(TITLE_SIZE.min),
      fontSize: TITLE_SIZE.min,
      author: null,
      authorSize: authorSizeAt(TITLE_SIZE.min),
    }
  );
}
