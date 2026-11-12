import Storage from 'expo-sqlite/kv-store';

const SEEN_KEY = 'onboarding.seen';
const VERSION_KEY = 'onboarding.version';

/**
 * Bump this when the welcome tour gains something worth telling people who've already seen it. Anyone on an older
 * version is offered the new tour once (see `tourStatus`). Version 1 is the original tour, which didn't record a version.
 */
export const TOUR_VERSION = 3;

/** `new`: never seen the tour. `updated`: saw an older one. `current`: nothing to say. */
export type TourStatus = 'new' | 'updated' | 'current';

export async function tourStatus(): Promise<TourStatus> {
  if ((await Storage.getItem(SEEN_KEY)) == null) return 'new';
  const seen = Number(await Storage.getItem(VERSION_KEY)) || 1;
  return seen < TOUR_VERSION ? 'updated' : 'current';
}

/** Records that the tour (this version of it) has been finished, skipped, or offered. */
export async function markOnboardingSeen(): Promise<void> {
  await Storage.setItem(SEEN_KEY, new Date().toISOString());
  await Storage.setItem(VERSION_KEY, String(TOUR_VERSION));
}
