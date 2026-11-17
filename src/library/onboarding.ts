import Storage from 'expo-sqlite/kv-store';

const SEEN_KEY = 'onboarding.seen';
const VERSION_KEY = 'onboarding.version';

/**
 * Bump this when the welcome tour gains something worth telling people who've already seen it, and give the new or
 * changed steps this version as their `since`. Anyone on an older version is shown just those steps, once, as
 * "What's new" (see `tourSteps`). Version 1 is the original tour, which didn't record a version.
 */
export const TOUR_VERSION = 4;

/** What `tourSteps` needs to know about a step of the tour. */
export interface TourStepInfo {
  /** The tour version that added this step, or last changed it enough to show again. */
  since: number;
  /** Only worth showing in a browser tab: the installed app is already an app. */
  webOnly?: boolean;
}

/**
 * The steps of the tour someone should see: all of them if they've never seen it (`seenVersion` null), and otherwise
 * only those added or changed since the version they saw, which is none once they're up to date. Browser-only steps
 * are left out when `web` is false.
 */
export function tourSteps<T extends TourStepInfo>(steps: readonly T[], seenVersion: number | null, { web }: { web: boolean }): T[] {
  return steps.filter((s) => (web || !s.webOnly) && (seenVersion == null || s.since > seenVersion));
}

/** The tour version last seen on this device, or null if the tour has never been seen. */
export async function seenTourVersion(): Promise<number | null> {
  if ((await Storage.getItem(SEEN_KEY)) == null) return null;
  return Number(await Storage.getItem(VERSION_KEY)) || 1;
}

/** Records that the tour (this version of it) has been finished, skipped, or shown. */
export async function markOnboardingSeen(): Promise<void> {
  await Storage.setItem(SEEN_KEY, new Date().toISOString());
  await Storage.setItem(VERSION_KEY, String(TOUR_VERSION));
}
