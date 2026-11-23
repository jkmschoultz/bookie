/**
 * Which bookcase in the Friends hallway is under a point of the picture: each bookcase's front (along the wall) and its
 * end panel and aisle sign (facing you), projected from the current walk the way the hallway draws them. Nearer
 * bookcases win where they overlap, and ones too far down the hallway to make out don't count. Pure maths, so it can
 * be tested; FriendsLibraryHallway passes its measurements in.
 */

export interface HallwayView {
  /** How far along the hallway the eye has walked. */
  walk: number;
  /** The vanishing point in the picture, and the eye's distance from it. */
  VX: number;
  VY: number;
  EYE: number;
  W: number;
  H: number;
  HALF_WIDTH: number;
  /** Where bookcase fronts stand (from the middle of the hallway), and how long they run. */
  FRONT_X: number;
  CASE_LENGTH: number;
  /** Bookcases' tops and the floor, from eye level. */
  CASE_TOP: number;
  FLOOR: number;
  /** From the wall to the sign's far edge, and the sign's bottom (from eye level). */
  SIGN_SPAN: number;
  SIGN_BOTTOM: number;
}

export interface HallwayCase {
  side: -1 | 1;
  /** Depth of its near end, at the start of the hallway. */
  near: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A bookcase whose near end has walked further than this past the picture is hidden (as drawn). */
const HIDE_AFTER = 100;
/** Farther than this (its middle), a bookcase is mostly fogged over: not something you'd mean to tap. */
export const TAP_DISTANCE = 676;

const depthScale = (v: HallwayView, z: number) => v.EYE / (v.EYE - Math.min(z, v.EYE - 40));

/** Whether a bookcase can be told apart at this walk, and where its near and far ends are. */
function depths(c: HallwayCase, v: HallwayView) {
  const nearZ = c.near + v.walk;
  const farZ = nearZ - v.CASE_LENGTH;
  const shown = nearZ <= HIDE_AFTER && -(nearZ - v.CASE_LENGTH / 2) <= TAP_DISTANCE;
  return { nearZ, shown, dNear: depthScale(v, nearZ), dFar: depthScale(v, farZ) };
}

/** Whether (x, y), in picture units, is on this bookcase. */
function hits(c: HallwayCase, v: HallwayView, x: number, y: number): boolean {
  const { shown, dNear, dFar } = depths(c, v);
  if (!shown) return false;
  const across = c.side * (x - v.VX);
  const up = y - v.VY;
  if (across <= 0) return false;
  // Its front, along the wall: a point there is at the depth that puts the front at this x.
  const d = across / v.FRONT_X;
  if (d >= dFar && d <= dNear && up >= v.CASE_TOP * d && up <= v.FLOOR * d) return true;
  // Its end panel, and the sign held out from it, facing us.
  const inCase = up >= v.CASE_TOP * dNear && up <= v.FLOOR * dNear;
  if (inCase && across >= v.FRONT_X * dNear && across <= v.HALF_WIDTH * dNear) return true;
  const inSign = up >= v.CASE_TOP * dNear && up <= v.SIGN_BOTTOM * dNear;
  return inSign && across >= (v.HALF_WIDTH - v.SIGN_SPAN) * dNear && across <= v.HALF_WIDTH * dNear;
}

/** The index of the bookcase under (x, y) in picture units, the nearest one if several; -1 for none. */
export function caseAt(cases: HallwayCase[], v: HallwayView, x: number, y: number): number {
  let best = -1;
  let bestZ = -Infinity;
  cases.forEach((c, i) => {
    const z = c.near + v.walk;
    if (z > bestZ && hits(c, v, x, y)) {
      best = i;
      bestZ = z;
    }
  });
  return best;
}

/** Where a bookcase is in the picture (its front, end and sign), clipped to the picture; null when it can't be made out. */
export function caseBounds(c: HallwayCase, v: HallwayView): Rect | null {
  const { shown, dNear, dFar } = depths(c, v);
  if (!shown) return null;
  const xs = [v.FRONT_X * dFar, v.HALF_WIDTH * dNear, (v.HALF_WIDTH - v.SIGN_SPAN) * dNear, v.FRONT_X * dNear].map((a) => v.VX + c.side * a);
  const ys = [v.CASE_TOP * dNear, v.FLOOR * dNear, v.CASE_TOP * dFar, v.FLOOR * dFar].map((a) => v.VY + a);
  const x0 = Math.max(0, Math.min(...xs));
  const x1 = Math.min(v.W, Math.max(...xs));
  const y0 = Math.max(0, Math.min(...ys));
  const y1 = Math.min(v.H, Math.max(...ys));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/** How much of a bookcase's front shows in the picture at this walk: its area on screen, clipped to the picture. */
export function visibleArea(c: HallwayCase, v: HallwayView): number {
  const { nearZ, dFar } = depths(c, v);
  if (nearZ > HIDE_AFTER) return 0;
  const dNear = depthScale(v, nearZ);
  // The front is a trapezoid: at each depth d its edge is FRONT_X·d from the middle, from CASE_TOP·d to FLOOR·d.
  // Clip it to the picture's side, then add up its height across the screen in a few slices.
  const half = v.W / 2;
  const dMax = Math.min(dNear, half / v.FRONT_X);
  if (dMax <= dFar) return 0;
  let area = 0;
  const slices = 8;
  for (let i = 0; i < slices; i++) {
    const d0 = dFar + ((dMax - dFar) * i) / slices;
    const d1 = dFar + ((dMax - dFar) * (i + 1)) / slices;
    const d = (d0 + d1) / 2;
    const top = Math.max(-v.VY, v.CASE_TOP * d);
    const bottom = Math.min(v.H - v.VY, v.FLOOR * d);
    area += Math.max(0, bottom - top) * v.FRONT_X * (d1 - d0);
  }
  return area;
}

/** The bookcase most in view at this walk (the biggest on screen), the one the screen names; -1 for none. */
export function focusAt(cases: HallwayCase[], v: HallwayView): number {
  let best = -1;
  let most = 0;
  cases.forEach((c, i) => {
    const a = visibleArea(c, v);
    if (a > most) {
      best = i;
      most = a;
    }
  });
  return best;
}
