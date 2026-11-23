import { Colors, Wood } from '@/constants/theme';
import type { Book } from '@/types';

import { hashUnit } from './hash';
import { contrastRatio, CREAM, INK, MIN_CONTRAST, mix, overlaps, relativeLuminance, type Box } from './spineBoxes';
import { UNOWNED_OPACITY } from './spineStyle';

/** What a spine shows about its book's status and whether you own it, one real-book cue each (drawn in Spine.tsx). */
export interface SpineCues {
  /** Reading: a red bookmark ribbon out of the top. */
  ribbon: boolean;
  /** Read: a few faint creases down the spine, where it was bent open. */
  creases: boolean;
  /** Unread or wanted, on your shelf: a crisp spine with a soft sheen. */
  sheen: boolean;
  /** Wanted and on your shelf: a sticky tab out of the top, for "next up". */
  tab: boolean;
  /** Did not finish: a paper slip out of the top at a slant, where you stopped. */
  slip: boolean;
  /** Wanted and not owned: only the outline of a book, dashed, with a see-through fill. */
  ghost: boolean;
  /** How opaque the whole book is drawn: faded when you don't own it, unless it's already a ghost. */
  opacity: number;
}

export function spineCues({ status, owned }: Pick<Book, 'status' | 'owned'>): SpineCues {
  const ghost = status === 'want' && !owned;
  return {
    ribbon: status === 'reading',
    creases: status === 'read',
    sheen: (status === 'owned' || status === 'want') && owned,
    tab: status === 'want' && owned,
    slip: status === 'dnf',
    ghost,
    opacity: owned || ghost ? 1 : UNOWNED_OPACITY,
  };
}

/** How far each marker sticks out of the top of the spine, in px (the slip's slant lifts one corner a little higher). */
export const MARKER_REACH = { ribbon: 11, tab: 6, slip: 14 } as const;

/** How far the book's markers stick out of the top of its spine, in px; 0 when it has none. */
export function markerReach(book: Pick<Book, 'status' | 'owned'>): number {
  const cues = spineCues(book);
  return Math.max(0, cues.ribbon ? MARKER_REACH.ribbon : 0, cues.tab ? MARKER_REACH.tab : 0, cues.slip ? MARKER_REACH.slip : 0);
}

/** One straight piece of a crease, in px from the spine's top-left corner as it stands upright. */
export interface CreaseSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** How strongly it shows, 0–1. */
  strength: number;
  /** Whether it fades out at its top or bottom end: where the crease starts, stops or breaks off. */
  fadeStart: boolean;
  fadeEnd: boolean;
}

/** Creases stay off the ends of the spine, where its bands and frame are, as fractions of its height. */
export const CREASE_ZONE = { from: 0.14, to: 0.9 } as const;
/** The middle of the spine's width, where the title runs, as fractions of the width: creases run either side of it. */
export const CREASE_LANES = { from: 0.14, to: 0.86, centre: 0.12 } as const;
/** Pieces drawn per book at most, to keep a shelf of read books light. */
export const MAX_CREASE_SEGMENTS = 6;
/** How far a crease wanders sideways from its line, in px at most. */
const WANDER = 1.2;

/**
 * A read book's spine creases: one to three lines running down the spine where it was bent open, each a few pieces
 * that wander a little and sometimes break off, the first one long through the middle and the others shorter.
 * Placed differently on every book but always the same on one, and fewer on a thin spine.
 */
export function creases(id: number, width: number, height: number, avoid: Box[] = []): CreaseSegment[][] {
  return avoid.length ? placeCreases(id, width, height).map((c) => clearOf(c, avoid)).filter((c) => c.length) : placeCreases(id, width, height);
}

/** How close a crease may come to the text. */
const CREASE_GAP = 1.5;
/** Pieces shorter than this, left over after cutting around the text, are dropped. */
const MIN_PIECE = 4;

/** A crease with the stretches that would cross the title or author cut out, fading out where they're cut. */
function clearOf(crease: CreaseSegment[], avoid: Box[]): CreaseSegment[] {
  let pieces = crease;
  for (const box of avoid) {
    pieces = pieces.flatMap((p) => {
      const span = { x: Math.min(p.x1, p.x2), y: p.y1, w: Math.abs(p.x2 - p.x1), h: p.y2 - p.y1 };
      if (!overlaps(span, box, CREASE_GAP)) return [p];
      const at = (y: number) => p.x1 + ((p.x2 - p.x1) * (y - p.y1)) / (p.y2 - p.y1 || 1);
      const top = box.y - CREASE_GAP;
      const bottom = box.y + box.h + CREASE_GAP;
      const out: CreaseSegment[] = [];
      if (top - p.y1 >= MIN_PIECE) out.push({ ...p, y2: top, x2: at(top), fadeEnd: true });
      if (p.y2 - bottom >= MIN_PIECE) out.push({ ...p, y1: bottom, x1: at(bottom), fadeStart: true });
      return out;
    });
  }
  return pieces;
}

function placeCreases(id: number, width: number, height: number): CreaseSegment[][] {
  const seed = String(id);
  const r = (key: string) => hashUnit(seed, `crease-${key}`);
  const roll = r('count');
  const room = width < 20 ? 1 : width < 34 ? 2 : 3;
  const count = Math.min(room, roll < 0.3 ? 1 : roll < 0.75 ? 2 : 3);
  const lanes = creaseLanes(count, r('side') < 0.5);
  const zone = { from: CREASE_ZONE.from * height, to: CREASE_ZONE.to * height };
  let budget = MAX_CREASE_SEGMENTS;

  return lanes.map(([laneFrom, laneTo], i) => {
    const k = (key: string) => r(`${i}-${key}`);
    // The first crease is the long one where the spine bent most, through its middle; the others are shorter and anywhere.
    const main = i === 0;
    const length = (zone.to - zone.from) * (main ? 0.55 + 0.4 * k('length') : 0.22 + 0.3 * k('length'));
    const centre = main ? height * (0.45 + 0.1 * k('at')) : zone.from + length / 2 + (zone.to - zone.from - length) * k('at');
    const top = Math.max(zone.from, centre - length / 2);
    const bottom = Math.min(zone.to, centre + length / 2);
    const pieces = Math.min(budget - (lanes.length - 1 - i), main ? 3 : 1 + Math.floor(2 * k('pieces')));
    budget -= pieces;
    // Where the crease bends a little, and maybe breaks off for a stretch.
    const cuts = Array.from({ length: pieces - 1 }, (_, c) => (c + 0.6 + 0.8 * k(`cut-${c}`)) / pieces).sort((a, b) => a - b);
    const gap = pieces > 1 && k('gap') < 0.35 ? Math.floor(k('gap-at') * (pieces - 1)) : -1;
    const gapLength = (0.03 + 0.04 * k('gap-length')) * height;
    const lane = { from: laneFrom * width, to: laneTo * width };
    const xAt = (j: number) => clamp(lane.from + (lane.to - lane.from) * k('x') + WANDER * (2 * k(`wander-${j}`) - 1), lane.from, lane.to);
    const ys = [0, ...cuts, 1].map((t) => top + (bottom - top) * t);
    const xs = ys.map((_, j) => xAt(j));
    const strength = main ? 0.75 + 0.25 * k('strength') : 0.45 + 0.35 * k('strength');
    return Array.from({ length: pieces }, (_, j) => {
      const broken = (c: number) => c === gap;
      return {
        x1: xs[j],
        y1: broken(j - 1) ? ys[j] + gapLength / 2 : ys[j],
        x2: xs[j + 1],
        y2: broken(j) ? ys[j + 1] - gapLength / 2 : ys[j + 1],
        // Strongest in the middle of the crease and weaker towards its ends.
        strength: strength * (pieces > 2 && (j === 0 || j === pieces - 1) ? 0.75 : 1),
        fadeStart: j === 0 || broken(j - 1),
        fadeEnd: j === pieces - 1 || broken(j),
      };
    });
  });
}

/** Ranges across the spine's width for each crease, as fractions, on either side of the title and never sharing one. */
function creaseLanes(count: number, leftFirst: boolean): [number, number][] {
  const { from, to, centre } = CREASE_LANES;
  const left: [number, number] = [from, 0.5 - centre];
  const right: [number, number] = [0.5 + centre, to];
  const [first, second] = leftFirst ? [left, right] : [right, left];
  if (count === 1) return [first];
  if (count === 2) return [first, second];
  // Three: the long one on its own side, the two short ones sharing the other, each in its own half of it.
  const mid = (second[0] + second[1]) / 2;
  return [first, [second[0], mid - 0.02], [mid + 0.02, second[1]]];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** How much of its colour a ghost book's see-through fill keeps. */
export const GHOST_FILL = 0.35;

/**
 * A ghost book's dashed outline, in the spine colour, lifted a little when it would vanish against the dark shelf,
 * and a title colour that reads against its see-through fill over the shelf.
 */
export function ghostColors(color: string): { outline: string; text: string } {
  const fill = mix(Wood.backPanel[1], color, GHOST_FILL);
  // Ink or cream as on other spines, or white or black when the see-through fill is a mid-tone neither reads on.
  const best = (options: string[]) => options.reduce((a, b) => (contrastRatio(b, fill) > contrastRatio(a, fill) ? b : a));
  const usual = best([INK, CREAM]);
  const text = contrastRatio(usual, fill) >= MIN_CONTRAST ? usual : best(['#ffffff', '#000000']);
  return {
    outline: relativeLuminance(color) < 0.1 ? mix(color, Colors.text, 0.4) : color,
    text,
  };
}
