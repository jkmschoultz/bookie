import { flightFrame, useBookFlight } from '../bookFlight';
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

describe('useBookFlight', () => {
  const book = makeBook({ id: 7 });
  const from = { x: 0, y: 0, width: 20, height: 180, style: getSpineStyle(book) };

  afterEach(() => useBookFlight.getState().finish());

  it('only lands the book that is flying, once', () => {
    const { start, land } = useBookFlight.getState();
    start(book, from);
    land(8, { x: 1, y: 1, width: 1, height: 1 });
    expect(useBookFlight.getState().flight?.to).toBeNull();
    land(7, { x: 1, y: 2, width: 3, height: 4 });
    land(7, { x: 9, y: 9, width: 9, height: 9 });
    expect(useBookFlight.getState().flight?.to).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });
});
