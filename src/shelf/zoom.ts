import { Shelf } from '@/constants/theme';

/** Up to this window width (phones) the bookcase is drawn at its normal size. */
export const ZOOM_FROM_WIDTH = 768;
/** From this window width (desktop windows) the bookcase is drawn MAX_ZOOM times bigger. */
export const ZOOM_FULL_WIDTH = 1200;
export const MAX_ZOOM = 1.5;
/** Zoom moves in steps of 1/ZOOM_STEPS (0.05), so resizing a window doesn't redraw the bookcase at every pixel. */
const ZOOM_STEPS = 20;

/**
 * How much bigger than normal the bookcase is drawn in a window this wide: 1 on phones, MAX_ZOOM on desktop windows,
 * growing steadily in between (tablets, narrow windows), like zooming the page in on the bookcase alone.
 */
export function shelfZoom(windowWidth: number): number {
  const t = Math.min(1, Math.max(0, (windowWidth - ZOOM_FROM_WIDTH) / (ZOOM_FULL_WIDTH - ZOOM_FROM_WIDTH)));
  return 1 + Math.round(t * (MAX_ZOOM - 1) * ZOOM_STEPS) / ZOOM_STEPS;
}

export interface ShelfMetrics {
  innerHeight: number;
  plankTop: number;
  plankFront: number;
  sidePanel: number;
  gutter: number;
  gap: number;
  /** One shelf: the room for its books and the plank under them. */
  rowHeight: number;
}

/** The bookcase's measurements (see Shelf in the theme) at this zoom. */
export function shelfMetrics(zoom: number): ShelfMetrics {
  const m = {
    innerHeight: Shelf.innerHeight * zoom,
    plankTop: Shelf.plankTop * zoom,
    plankFront: Shelf.plankFront * zoom,
    sidePanel: Shelf.sidePanel * zoom,
    gutter: Shelf.gutter * zoom,
    gap: Shelf.gap * zoom,
  };
  return { ...m, rowHeight: m.innerHeight + m.plankTop + m.plankFront };
}

/** Remembers what `make` gives for each zoom, so styles are built once per zoom and not for every book drawn. */
export function byZoom<T>(make: (zoom: number) => T): (zoom: number) => T {
  const made = new Map<number, T>();
  return (zoom) => {
    let value = made.get(zoom);
    if (value === undefined) {
      value = make(zoom);
      made.set(zoom, value);
    }
    return value;
  };
}
