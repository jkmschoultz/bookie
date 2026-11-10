import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { decode } from 'jpeg-js';
import { Platform } from 'react-native';

import { coverPalette } from '@/shelf/coverPalette';

/** Raw bytes of a cover. Throws only for errors worth retrying later (e.g. offline). */
async function coverBytes(url: string): Promise<Uint8Array | null> {
  if (Platform.OS !== 'web' && url.startsWith('file:')) {
    const file = new File(url);
    return file.exists ? file.bytes() : null;
  }
  // The browser's fetch on web (it also reads data: URIs); expo/fetch on native, which supports arrayBuffer().
  const res = await (Platform.OS === 'web' ? fetch(url) : expoFetch(url));
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * The cover's main colour, and a second one if it has one, for colouring the spine.
 * Returns [] when the cover can't be used (missing, not a JPEG, or on web a host that blocks reading its pixels…)
 * and throws when it may work on a later try.
 */
export async function coverColors(url: string): Promise<string[]> {
  let bytes: Uint8Array | null;
  try {
    bytes = await coverBytes(url);
  } catch (e) {
    // On web, a cover host without CORS headers fails the same way as being offline; only retry when offline.
    if (Platform.OS === 'web' && navigator.onLine) return [];
    throw e;
  }
  if (!bytes) return [];
  try {
    const { data, width, height } = decode(bytes, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 30, maxMemoryUsageInMB: 256 });
    return coverPalette(data, width, height);
  } catch {
    return []; // Not a JPEG we can read (Open Library serves a tiny GIF when it has no cover).
  }
}
