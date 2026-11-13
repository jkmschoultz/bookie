import { Platform } from 'react-native';

import type { LayoutMode } from '@/shelf/layout';

/**
 * Moving the web app to a new address.
 *
 * Browsers keep each site's storage to itself, so a library at the old address can't be read from the new one. Instead
 * the old site opens the new one's /move-in screen in a new window and the two talk with postMessage:
 *
 *   new → old  ready     (repeated until the library arrives, so neither side has to win a race)
 *   old → new  library   (the same JSON as Settings → Export backup, plus the shelf layout)
 *   new → old  done | failed
 *
 * Each side only listens to the other's exact origin and only sends to it, so no other site can read or inject a
 * library. One build serves both addresses: the banner only shows when the page is running at OLD_URL.
 */

const OLD_URL = process.env.EXPO_PUBLIC_OLD_URL || 'https://bookie.expo.app';
const NEW_URL = process.env.EXPO_PUBLIC_NEW_URL || null;

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export const OLD_ORIGIN = originOf(OLD_URL);
export const NEW_ORIGIN = NEW_URL ? originOf(NEW_URL) : null;

/** The path on the new site that receives a library. */
export const MOVE_IN_PATH = '/move-in';

/** The new address, when this page is the old site and there's somewhere to move to. Null everywhere else. */
export function movedTo(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !NEW_ORIGIN || NEW_ORIGIN === OLD_ORIGIN) return null;
  return window.location.origin === OLD_ORIGIN ? NEW_ORIGIN : null;
}

export type MoveMessage =
  | { type: 'bookie-move:ready' }
  | { type: 'bookie-move:library'; backup: string; layoutMode?: LayoutMode }
  | { type: 'bookie-move:done'; added: number; skipped: number }
  | { type: 'bookie-move:failed'; message: string };

export interface MoveResult {
  added: number;
  skipped: number;
}

/** A message from the other site, or null for anything that isn't one (other scripts use postMessage too). */
export function asMoveMessage(data: unknown): MoveMessage | null {
  if (!data || typeof data !== 'object') return null;
  const m = data as Record<string, unknown>;
  switch (m.type) {
    case 'bookie-move:ready':
      return { type: m.type };
    case 'bookie-move:library':
      if (typeof m.backup !== 'string') return null;
      return {
        type: m.type,
        backup: m.backup,
        layoutMode: m.layoutMode === 'row' || m.layoutMode === 'wrap' ? m.layoutMode : undefined,
      };
    case 'bookie-move:done':
      if (typeof m.added !== 'number' || typeof m.skipped !== 'number') return null;
      return { type: m.type, added: m.added, skipped: m.skipped };
    case 'bookie-move:failed':
      return { type: m.type, message: typeof m.message === 'string' ? m.message : 'Something went wrong.' };
    default:
      return null;
  }
}

export type MoveErrorKind = 'blocked' | 'closed' | 'timeout' | 'failed';

export class MoveError extends Error {
  constructor(
    readonly kind: MoveErrorKind,
    message?: string,
  ) {
    super(message ?? kind);
  }
}

/**
 * Opens the new site and hands it the library. Call it straight from a tap, before any `await`: browsers only allow
 * a new window while they're still handling the tap.
 */
export function sendLibrary(
  newOrigin: string,
  library: { backup: string; layoutMode?: LayoutMode },
  timeoutMs = 30_000,
): Promise<MoveResult> {
  return new Promise((resolve, reject) => {
    // Not noopener: the new window needs `window.opener` to reply.
    const win = window.open(`${newOrigin}${MOVE_IN_PATH}`, 'bookie-move');
    if (!win) {
      reject(new MoveError('blocked'));
      return;
    }
    let sent = false;
    const stop = () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      clearInterval(closedCheck);
    };
    function onMessage(e: MessageEvent) {
      if (e.origin !== newOrigin || e.source !== win) return;
      const msg = asMoveMessage(e.data);
      if (msg?.type === 'bookie-move:ready' && !sent) {
        sent = true;
        win!.postMessage({ type: 'bookie-move:library', ...library } satisfies MoveMessage, newOrigin);
      } else if (msg?.type === 'bookie-move:done') {
        stop();
        resolve({ added: msg.added, skipped: msg.skipped });
      } else if (msg?.type === 'bookie-move:failed') {
        stop();
        reject(new MoveError('failed', msg.message));
      }
    }
    window.addEventListener('message', onMessage);
    const timer = setTimeout(() => {
      stop();
      reject(new MoveError('timeout'));
    }, timeoutMs);
    const closedCheck = setInterval(() => {
      if (!win.closed) return;
      stop();
      reject(new MoveError('closed'));
    }, 500);
  });
}
