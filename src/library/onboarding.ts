import Storage from 'expo-sqlite/kv-store';

const SEEN_KEY = 'onboarding.seen';

/** Whether the first-launch walkthrough has been finished or skipped on this device. */
export async function hasSeenOnboarding(): Promise<boolean> {
  return (await Storage.getItem(SEEN_KEY)) != null;
}

export async function markOnboardingSeen(): Promise<void> {
  await Storage.setItem(SEEN_KEY, new Date().toISOString());
}
