import { caseAt, caseBounds, focusAt, type HallwayCase, type HallwayView } from '../hallwayHit';

// The full-screen hallway at 390×844: the picture is 340 wide and 736 tall (see FriendsLibraryHallway).
const view = (walk: number): HallwayView => ({
  walk,
  VX: 170,
  VY: 335,
  EYE: 320,
  W: 340,
  H: 736,
  HALF_WIDTH: 170,
  FRONT_X: 134,
  CASE_LENGTH: 150,
  CASE_TOP: -112,
  FLOOR: 401,
  SIGN_SPAN: 97,
  SIGN_BOTTOM: -112 + 68,
});
const STOP = 87;
/** Bookcases alternate sides, half a spacing apart, as hallwayFor places them. */
const cases: HallwayCase[] = Array.from({ length: 10 }, (_, i) => ({ side: i % 2 ? 1 : -1, near: -40 - i * STOP }));

const centre = (i: number, walk: number) => {
  const b = caseBounds(cases[i], view(walk))!;
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
};

describe('caseAt', () => {
  it('finds the bookcase in front, and the one on the other wall', () => {
    const v = view(0);
    // Its sign, just left of the middle near the top of the bookcase.
    expect(caseAt(cases, v, 170 - 100, 335 - 80)).toBe(0);
    // The first bookcase on the right wall, by its front.
    expect(caseAt(cases, v, 255, 335 + 60)).toBe(1);
  });

  it('finds farther bookcases down either wall, where they show', () => {
    const v = view(0);
    for (const i of [2, 3, 4]) {
      // A point on the bookcase's front, halfway along it.
      const z = cases[i].near - 75;
      const d = 320 / (320 - z);
      expect(caseAt(cases, v, 170 + cases[i].side * 134 * d, 335 + 100 * d)).toBe(i);
    }
  });

  it('gives the nearer bookcase where two overlap, and nothing in the middle of the hallway', () => {
    const v = view(2 * STOP);
    const p = centre(3, 2 * STOP);
    const hit = caseAt(cases, v, p.x, p.y);
    expect([3, 5, 1]).toContain(hit);
    expect(caseAt(cases, v, 170, 335 + 200)).toBe(-1);
  });

  it('leaves out bookcases walked past or too far away to make out', () => {
    expect(caseBounds(cases[0], view(5 * STOP))).toBeNull();
    expect(caseBounds(cases[9], view(0))).toBeNull();
    expect(caseBounds(cases[2], view(0))).not.toBeNull();
  });
});

describe('focusAt', () => {
  it('names the nearer bookcase diagonally across: one stop on from where it is just ahead', () => {
    for (let j = 0; j < cases.length; j++) expect(focusAt(cases, view((j + 1) * STOP))).toBe(j);
  });

  it('agrees with the box mode hallway too', () => {
    const box = (walk: number): HallwayView => ({ ...view(walk), H: 330, VY: 150, CASE_TOP: -50, FLOOR: 180, SIGN_BOTTOM: -50 + 68 });
    for (let j = 0; j < cases.length; j++) expect(focusAt(cases, box((j + 1) * STOP))).toBe(j);
  });
});
