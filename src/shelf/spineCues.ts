import { Colors, Wood } from '@/constants/theme';
import type { Book } from '@/types';

import { hashUnit } from './hash';
import { contrastText, relativeLuminance, UNOWNED_OPACITY } from './spineStyle';

/** What a spine shows about its book's status and whether you own it, one real-book cue each (drawn in Spine.tsx). */
export interface SpineCues {
  /** Reading: a red bookmark ribbon out of the top. */
  ribbon: boolean;
  /** Read: a few faint creases across the spine. */
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

export interface Crease {
  /** Where the crease crosses the spine, as a fraction of its height from the top. */
  at: number;
  /** How strongly it shows, 0–1. */
  strength: number;
  /** Where it starts and how far it runs across the spine, as fractions of its width: wear rarely crosses edge to edge. */
  from: number;
  length: number;
  /** A slight slope, in degrees, so it doesn't look like a printed rule. */
  tilt: number;
}

/** Creases stay off the ends of the spine, where its bands and frame are. */
const CREASE_ZONE = { from: 0.18, to: 0.82 } as const;

/** Two or three creases for a read book, placed differently on every book but always the same on one. */
export function creases(id: number): Crease[] {
  const seed = String(id);
  const count = hashUnit(seed, 'crease-count') < 0.5 ? 2 : 3;
  const span = (CREASE_ZONE.to - CREASE_ZONE.from) / count;
  // One crease in each part of the zone, somewhere within it, so they never bunch up.
  return Array.from({ length: count }, (_, i) => ({
    at: CREASE_ZONE.from + span * (i + 0.15 + 0.7 * hashUnit(seed, `crease-at-${i}`)),
    strength: 0.5 + 0.5 * hashUnit(seed, `crease-strength-${i}`),
    from: 0.25 * hashUnit(seed, `crease-from-${i}`),
    length: 0.5 + 0.25 * hashUnit(seed, `crease-length-${i}`),
    tilt: (hashUnit(seed, `crease-tilt-${i}`) - 0.5) * 6,
  }));
}

/** How much of its colour a ghost book's see-through fill keeps. */
export const GHOST_FILL = 0.35;

/**
 * A ghost book's dashed outline, in the spine colour, lifted a little when it would vanish against the dark shelf,
 * and a title colour that reads against its see-through fill over the shelf.
 */
export function ghostColors(color: string): { outline: string; text: string } {
  const fill = mix(Wood.backPanel[1], color, GHOST_FILL);
  return {
    outline: relativeLuminance(color) < 0.1 ? mix(color, Colors.text, 0.4) : color,
    text: contrastText(fill),
  };
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}
