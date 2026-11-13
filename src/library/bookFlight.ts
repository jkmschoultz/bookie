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
}

export interface Flight {
  book: Book;
  from: SpineRect;
  /** Where the cover sits on the book's page, once that page has laid out. */
  to: Rect | null;
}

interface FlightStore {
  flight: Flight | null;
  /** A book leaves its shelf. Its spine hides and the book page hides its cover until `finish`. */
  start: (book: Book, from: SpineRect) => void;
  /** The book page reports where its cover is, and the book flies there. */
  land: (bookId: number, to: Rect) => void;
  /** The book has arrived (or the flight was called off): the page shows its own cover again. */
  finish: () => void;
}

/**
 * A book's trip from the shelf to its page: it comes out of the shelf, turns from its spine to its front cover, and
 * lands where the page shows the cover. `BookFlight` draws it above every screen.
 */
export const useBookFlight = create<FlightStore>((set) => ({
  flight: null,
  start: (book, from) => set({ flight: { book, from, to: null } }),
  land: (bookId, to) => set((s) => (s.flight?.book.id === bookId && !s.flight.to ? { flight: { ...s.flight, to } } : s)),
  finish: () => set({ flight: null }),
}));

/**
 * Where the flying book is at `p` (0 = on the shelf, 1 = landed) and how far it has turned, 0° (spine facing you) to
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
