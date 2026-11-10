/**
 * Picks a spine palette from cover pixels: the most common colour, plus a
 * second colour when one also covers a good share of the cover and looks
 * clearly different.
 */

/** Pixels to look at per cover, at most. Plenty for a stable answer. */
const MAX_SAMPLES = 12_000;
/** Ignore the outer edge, where scans often have borders or shadows. */
const EDGE = 0.03;
/** Colours closer than this (CIE76 ΔE) count as the same colour. */
const SAME_COLOUR = 18;
/** A second colour must cover at least this share of the cover… */
const SECONDARY_SHARE = 0.12;
/** …and be at least this different from the main colour. */
const SECONDARY_DISTANCE = 28;

type Rgb = [number, number, number];
type Lab = [number, number, number];

function toLab([r, g, b]: Rgb): Lab {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  // sRGB → XYZ (D65), normalised to the white point.
  const x = (0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.95047;
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  const z = (0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function distance(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

interface Cluster {
  lab: Lab;
  count: number;
  sum: Rgb;
}

/**
 * RGBA pixels (4 bytes each, row by row) → one or two hex colours, most common first.
 * Returns [] when there's nothing usable, e.g. a fully transparent image.
 */
export function coverPalette(rgba: Uint8Array, width: number, height: number): string[] {
  const x0 = Math.floor(width * EDGE);
  const y0 = Math.floor(height * EDGE);
  const x1 = width - x0;
  const y1 = height - y0;
  const step = Math.max(1, Math.round(Math.sqrt(((x1 - x0) * (y1 - y0)) / MAX_SAMPLES)));

  // Bucket at 5 bits per channel, keeping exact sums so averages stay true to the cover.
  const buckets = new Map<number, { count: number; sum: Rgb }>();
  let total = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const i = (y * width + x) * 4;
      if (rgba[i + 3] < 128) continue;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.count++;
        bucket.sum[0] += r;
        bucket.sum[1] += g;
        bucket.sum[2] += b;
      } else {
        buckets.set(key, { count: 1, sum: [r, g, b] });
      }
      total++;
    }
  }
  if (!total) return [];

  // Group buckets into colours, biggest first, so each colour is led by its most common shade.
  const clusters: Cluster[] = [];
  for (const { count, sum } of [...buckets.values()].sort((a, b) => b.count - a.count)) {
    const lab = toLab([sum[0] / count, sum[1] / count, sum[2] / count]);
    const near = clusters.find((c) => distance(c.lab, lab) < SAME_COLOUR);
    if (near) {
      near.count += count;
      near.sum[0] += sum[0];
      near.sum[1] += sum[1];
      near.sum[2] += sum[2];
    } else {
      clusters.push({ lab, count, sum: [...sum] });
    }
  }
  clusters.sort((a, b) => b.count - a.count);

  const mean = (c: Cluster): Rgb => [c.sum[0] / c.count, c.sum[1] / c.count, c.sum[2] / c.count];
  const [main, ...rest] = clusters;
  const mainLab = toLab(mean(main));
  const second = rest.find((c) => c.count / total >= SECONDARY_SHARE && distance(toLab(mean(c)), mainLab) >= SECONDARY_DISTANCE);
  return second ? [toHex(mean(main)), toHex(mean(second))] : [toHex(mean(main))];
}
