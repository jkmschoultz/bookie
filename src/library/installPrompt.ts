import { Platform } from 'react-native';

/** Chrome's install prompt event, which isn't in the standard DOM types. */
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let pending: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// Chrome offers the install prompt once, early in the page's life, so it's caught here when the app starts and kept
// until someone taps the button. Safari on iPhone never sends it: there, people use Share → Add to Home Screen.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pending = e as InstallEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    pending = null;
    notify();
  });
}

export const canInstall = () => pending != null;

export function onInstallChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Shows the browser's own "Install Bookie?" box. Resolves to whether they said yes. */
export async function promptInstall(): Promise<boolean> {
  if (!pending) return false;
  const event = pending;
  pending = null;
  notify();
  await event.prompt();
  return (await event.userChoice).outcome === 'accepted';
}
