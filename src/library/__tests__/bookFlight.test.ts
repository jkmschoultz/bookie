import { findSpine, flightFrame, lyingTilt, registerSpine, standUp, tiltShift, useBookFlight } from '../bookFlight';
import { makeBook } from '@/test/makeBook';
import { getSpineStyle } from '@/shelf/spineStyle';

describe('flightFrame', () => {
  const spine = { x: 40, y: 500, width: 30, height: 200 };
  const cover = { x: 110, y: 92, width: 170, height: 255 };

  it('starts on the shelf, spine facing out', () => {
    expect(flightFrame(spine, cover, 0)).toEqual({ hingeX: 70, top: 500, scale: 1, turn: 0 });
  });

  it('lands with the cover facing out, exactly over the page’s cover', () => {
    expect(flightFrame(spine, cover, 1)).toEqual({ hingeX: 110, top: 92, scale: 255 / 200, turn: 90 });
  });

  it('finishes turning a little before it lands', () => {
    expect(flightFrame(spine, cover, 0.85).turn).toBe(90);
    expect(flightFrame(spine, cover, 0.5).turn).toBeCloseTo(52.9, 1);
  });
});

describe('a book from a pile', () => {
  // Lying on its side: as wide as the book is tall, as high as its spine is wide.
  const lying = { x: 200, y: 600, width: 180, height: 24 };

  it('flies as if upright, about the same middle', () => {
    expect(standUp(lying)).toEqual({ x: 278, y: 522, width: 24, height: 180 });
  });

  it('starts tipped over and is upright well before it lands', () => {
    expect(lyingTilt(0)).toBe(-90);
    expect(lyingTilt(0.45)).toBeCloseTo(0);
    expect(lyingTilt(1)).toBeCloseTo(0);
  });

  it('is drawn exactly where it lay', () => {
    const upright = standUp(lying);
    const { hingeX, top } = flightFrame(upright, { x: 110, y: 92, width: 170, height: 255 }, 0);
    const shift = tiltShift(upright, lyingTilt(0));
    // Tipped over to the left, the top of the hinge (the spine's top right corner) ends up at the pile book's top left.
    expect(hingeX + shift.x).toBeCloseTo(lying.x);
    expect(top + shift.y).toBeCloseTo(lying.y);
  });

  it('needs no shift once upright', () => {
    const shift = tiltShift({ width: 24, height: 180 }, 0);
    expect(shift.x).toBeCloseTo(0);
    expect(shift.y).toBeCloseTo(0);
  });
});

describe('useBookFlight', () => {
  const book = makeBook({ id: 7 });
  const from = { x: 0, y: 0, width: 20, height: 180, style: getSpineStyle(book) };

  afterEach(() => useBookFlight.getState().finish());

  it('only lands the book that is flying, once', () => {
    const { start, land } = useBookFlight.getState();
    start(book, from);
    land(8, { x: 1, y: 1, width: 1, height: 1 });
    expect(useBookFlight.getState().flight?.cover).toBeNull();
    land(7, { x: 1, y: 2, width: 3, height: 4 });
    land(7, { x: 9, y: 9, width: 9, height: 9 });
    expect(useBookFlight.getState().flight).toMatchObject({ direction: 'open', cover: { x: 1, y: 2, width: 3, height: 4 } });
  });

  it('flies back from the cover, then to the spine once the shelf finds it', () => {
    const { returnToShelf, shelve, land } = useBookFlight.getState();
    const cover = { x: 110, y: 92, width: 170, height: 255 };
    returnToShelf(book, cover);
    expect(useBookFlight.getState().flight).toMatchObject({ direction: 'close', cover, spine: null });
    land(7, { x: 0, y: 0, width: 1, height: 1 });
    expect(useBookFlight.getState().flight?.cover).toEqual(cover);
    shelve(7, from);
    expect(useBookFlight.getState().flight?.spine).toEqual(from);
  });
});

describe('findSpine', () => {
  const book = makeBook({ id: 9 });
  const style = getSpineStyle(book);
  const screen = { width: 390, height: 844 };

  it('finds a registered spine that is on screen, and forgets it once unregistered', async () => {
    const unregister = registerSpine(9, async () => ({ x: 40, y: 500, width: 30, height: 200, style }));
    expect(await findSpine(9, screen)).toMatchObject({ x: 40, y: 500 });
    unregister();
    expect(await findSpine(9, screen)).toBeNull();
  });

  it('ignores spines scrolled off screen or hidden', async () => {
    const off = registerSpine(9, async () => ({ x: 40, y: 900, width: 30, height: 200, style }));
    expect(await findSpine(9, screen)).toBeNull();
    off();
    const hidden = registerSpine(9, async () => ({ x: 0, y: 0, width: 0, height: 0, style }));
    expect(await findSpine(9, screen)).toBeNull();
    hidden();
  });
});
