/** Screens that open as sheets over the app on phones; on web they rise from the bottom too. */
const SHEETS = [/^\/settings$/, /^\/add$/, /^\/welcome$/, /^\/book\//];

export type Transition = 'forward' | 'back' | 'sheet-open' | 'sheet-close' | null;

/** Between the shelf and a book's page the book itself flies (see BookFlight), so the screens stay still. */
const BOOK_TRIP = (a: string, b: string) => (a === '/' && /^\/book\//.test(b)) || (b === '/' && /^\/book\//.test(a));

/**
 * Which way to animate when the path changes, given the trail of paths visited so far. Going to a path already on the
 * trail is going back (to it); anything else is going forward. Closing any sheet on the way back closes as a sheet.
 * Nothing between the shelf and a book's page, where the book flies instead.
 * Returns the new trail too. Pure, for testing.
 */
export function nextTransition(trail: string[], path: string): { transition: Transition; trail: string[] } {
  const isSheet = (p: string) => SHEETS.some((re) => re.test(p));
  const top = trail[trail.length - 1];
  if (top === path) return { transition: null, trail };
  const at = trail.lastIndexOf(path);
  if (at >= 0) {
    const leaving = trail.slice(at + 1);
    const transition = BOOK_TRIP(top, path) ? null : leaving.some(isSheet) ? 'sheet-close' : 'back';
    return { transition, trail: trail.slice(0, at + 1) };
  }
  const transition = BOOK_TRIP(top, path) ? null : isSheet(path) ? 'sheet-open' : 'forward';
  return { transition, trail: [...trail, path] };
}
