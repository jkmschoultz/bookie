import { coverPalette } from '../coverPalette';

type Rgba = [number, number, number, number];

/** A width × height image filled by `paint(x, y)`. */
function image(width: number, height: number, paint: (x: number, y: number) => Rgba): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(paint(x, y), (y * width + x) * 4);
  return data;
}

const RED: Rgba = [180, 30, 40, 255];
const CREAM: Rgba = [235, 225, 200, 255];
const NAVY: Rgba = [25, 45, 90, 255];
const GOLD: Rgba = [215, 165, 60, 255];

describe('coverPalette', () => {
  it('returns the main colour and a strong second colour', () => {
    // Top 70% red, bottom 30% cream.
    const px = image(100, 150, (_, y) => (y < 105 ? RED : CREAM));
    expect(coverPalette(px, 100, 150)).toEqual(['#b41e28', '#ebe1c8']);
  });

  it('ignores a second colour that only covers a little of the cover', () => {
    // A thin gold title strip: about 5%.
    const px = image(100, 150, (_, y) => (y >= 70 && y < 78 ? GOLD : NAVY));
    expect(coverPalette(px, 100, 150)).toEqual(['#192d5a']);
  });

  it('treats close shades as one colour', () => {
    // A navy gradient with a gold block: the gradient must win as one colour, not be split in two.
    const px = image(100, 150, (x, y) => (y >= 110 ? GOLD : [NAVY[0] + (x % 8), NAVY[1] + (y % 8), NAVY[2] + ((x + y) % 10), 255]));
    const [main, second] = coverPalette(px, 100, 150);
    expect(parseInt(main.slice(5), 16)).toBeGreaterThan(80); // still navy (blue-dominant)
    expect(parseInt(main.slice(1, 3), 16)).toBeLessThan(40);
    expect(second).toBe('#d7a53c');
  });

  it('does not offer a near-identical shade as the second colour', () => {
    const px = image(100, 150, (_, y) => (y < 75 ? RED : [195, 40, 50, 255]));
    expect(coverPalette(px, 100, 150)).toHaveLength(1);
  });

  it('skips transparent pixels and a scanned border', () => {
    const px = image(100, 150, (x, y) => {
      if (x < 2 || y < 2 || x > 97 || y > 147) return [255, 255, 255, 255]; // white scan border
      return x < 50 ? [0, 0, 0, 0] : RED;
    });
    expect(coverPalette(px, 100, 150)).toEqual(['#b41e28']);
  });

  it('returns nothing for a fully transparent image', () => {
    expect(coverPalette(image(10, 10, () => [0, 0, 0, 0]), 10, 10)).toEqual([]);
  });
});
