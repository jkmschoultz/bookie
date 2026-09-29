/** FNV-1a hash — stable across runs so a book always gets the same look. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic number in [0, 1) derived from a string and a salt. */
export function hashUnit(input: string, salt = ''): number {
  return hashString(salt + input) / 0x100000000;
}
