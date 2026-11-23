/** Tells whoever is listening (the sync) that the library on this device changed. */
const listeners = new Set<() => void>();

export function notifyLocalChange(): void {
  for (const l of listeners) l();
}

export function onLocalChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
