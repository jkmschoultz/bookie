import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

const DISMISSED_KEY = 'bringBooks.dismissed';

/**
 * On iPhone and iPad, Bookie added to the home screen gets its own storage, separate from Safari's (WebKit bug 181849,
 * by design). So the first time it opens there, the library is empty even if Safari has books. Android keeps them
 * together, so this only applies to iOS and iPadOS. iPadOS asks for desktop sites, so it says it's a Mac: the touch
 * screen gives it away.
 */
export function isAppleTouchDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Opened from the home screen rather than in a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as { standalone?: boolean }).standalone === true
  );
}

/** Whether this is the iPhone or iPad home-screen app, with its own library apart from Safari's. Web only. */
export function isAppleHomeScreenApp(): boolean {
  return Platform.OS === 'web' && isStandalone() && isAppleTouchDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}

/**
 * Whether to show the note about bringing books over from Safari. `dismissed` is null until it's been read from
 * storage. Not shown alongside the "Bookie has moved" banner, which has its own way of moving books.
 */
export function shouldShowBringBooks(state: {
  homeScreenApp: boolean;
  loaded: boolean;
  bookCount: number;
  dismissed: boolean | null;
  moved: boolean;
}): boolean {
  return state.homeScreenApp && state.loaded && state.bookCount === 0 && state.dismissed === false && !state.moved;
}

export async function bringBooksDismissed(): Promise<boolean> {
  try {
    return (await Storage.getItem(DISMISSED_KEY)) != null;
  } catch {
    return false;
  }
}

export async function dismissBringBooks(): Promise<void> {
  await Storage.setItem(DISMISSED_KEY, new Date().toISOString());
}
