import { create } from 'zustand';

import type { SpineStyle } from '@/shelf/spineStyle';
import type { Book } from '@/types';

/** How long the book takes to come out of the shelf, towards you, before its page opens underneath it. */
export const PULL_OUT_MS = 200;

/** A box on screen, in window coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a tapped spine is, and how it looks, for the flight to start from. */
export interface SpineRect extends Rect {
  style: SpineStyle;
  /** Lying on its side in a pile, spine text running left to right, so the box is as wide as the book is tall. */
  lying?: boolean;
}

export interface Flight {
  book: Book;
  /** `open`: shelf to page. `close`: back from the page to the shelf. */
  direction: 'open' | 'close';
  /** The spine on its shelf. On the way back it's only known once the shelf is showing again. */
  spine: SpineRect | null;
  /** The cover on the book's page. On the way there it's only known once the page has laid out. */
  cover: Rect | null;
}

interface FlightStore {
  flight: Flight | null;
  /** A book leaves its shelf. Its spine hides, and its page hides its cover until `finish`. */
  start: (book: Book, spine: SpineRect) => void;
  /** The book page reports where its cover is, and the book flies there. */
  land: (bookId: number, cover: Rect) => void;
  /** Leaving the book page: the book flies back from where its cover was. */
  returnToShelf: (book: Book, cover: Rect) => void;
  /** The shelf reports where the spine is, and the returning book flies there. */
  shelve: (bookId: number, spine: SpineRect) => void;
  /** The book has arrived (or the flight was called off). */
  finish: () => void;
}

/**
 * A book's trip between its shelf and its page: it comes out of the shelf, turns from its spine to its front cover, and
 * lands where the page shows the cover; and back again. `BookFlight` draws it above every screen.
 */
export const useBookFlight = create<FlightStore>((set) => ({
  flight: null,
  start: (book, spine) => set({ flight: { book, direction: 'open', spine, cover: null } }),
  land: (bookId, cover) =>
    set((s) => (s.flight?.direction === 'open' && s.flight.book.id === bookId && !s.flight.cover ? { flight: { ...s.flight, cover } } : s)),
  returnToShelf: (book, cover) => set({ flight: { book, direction: 'close', spine: null, cover } }),
  shelve: (bookId, spine) =>
    set((s) => (s.flight?.direction === 'close' && s.flight.book.id === bookId && !s.flight.spine ? { flight: { ...s.flight, spine } } : s)),
  finish: () => set({ flight: null }),
}));

type MeasureSpine = () => Promise<SpineRect | null>;
const spines = new Map<number, MeasureSpine>();

/** Each spine on a shelf registers how to find it on screen, for a book flying back to it. Returns the unregister. */
export function registerSpine(bookId: number, measure: MeasureSpine): () => void {
  spines.set(bookId, measure);
  return () => {
    if (spines.get(bookId) === measure) spines.delete(bookId);
  };
}

/** Where a book's spine is on screen, or null if it isn't on a shelf in view (scrolled away, filtered out, deleted). */
export async function findSpine(bookId: number, screen: { width: number; height: number }): Promise<SpineRect | null> {
  const rect = await spines.get(bookId)?.();
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  const onScreen = rect.x + rect.width > 0 && rect.x < screen.width && rect.y + rect.height > 0 && rect.y < screen.height;
  return onScreen ? rect : null;
}

/**
 * Where the flying book is at `p` (0 = on the shelf, 1 = on the page) and how far it has turned, 0° (spine facing you) to
 * 90° (cover facing you). Pure, so it can be tested and run on the UI thread.
 *
 * The book turns about the corner where spine meets cover (the hinge), so that corner moves from the spine's right
 * edge to the cover's left edge, and the whole book grows from its shelf height to the cover's height.
 */
export function flightFrame(from: Rect, to: Rect, p: number): { hingeX: number; top: number; scale: number; turn: number } {
  'worklet';
  const mix = (a: number, b: number) => a + (b - a) * p;
  // Turn a little ahead of the move, so the cover is facing you before it settles.
  const turn = 90 * Math.min(1, p / 0.85);
  return {
    hingeX: mix(from.x + from.width, to.x),
    top: mix(from.y, to.y),
    scale: mix(1, to.height / from.height),
    turn,
  };
}

/** The box a lying book fills once stood upright about the same middle: the flight works with upright books. */
export function standUp(rect: Rect): Rect {
  return { x: rect.x + (rect.width - rect.height) / 2, y: rect.y + (rect.height - rect.width) / 2, width: rect.height, height: rect.width };
}

/** How a book in a pile lies: its upright spine tipped over this far, so its title reads left to right. */
export const LYING_TILT = -90;

/**
 * How far a book from a pile is still tipped over at `p`: LYING_TILT (lying, as in the pile) to 0° (upright). It stands
 * up in the first part of the flight, while it starts turning to its cover.
 */
export function lyingTilt(p: number): number {
  'worklet';
  return LYING_TILT * (1 - Math.min(1, p / 0.45));
}

/**
 * The flying book is drawn from the top of its hinge (where spine meets cover). Tilting it by `deg` about that corner,
 * then shifting it by this much, tilts it about the middle of its spine instead, so a lying book stays where it lay.
 * `spine` is the spine's size as drawn (after scaling).
 */
export function tiltShift(spine: { width: number; height: number }, deg: number): { x: number; y: number } {
  'worklet';
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  // From the middle of the spine to the hinge's top, before and after turning.
  const dx = spine.width / 2;
  const dy = -spine.height / 2;
  return { x: dx * cos - dy * sin - dx, y: dx * sin + dy * cos - dy };
}
