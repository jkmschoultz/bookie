import Storage from 'expo-sqlite/kv-store';

const ALLOWED_KEY = 'camera.allowed';

/**
 * Browsers often forget a camera grant between visits (Safari, and home-screen web apps on iPhone, ask again each time
 * by default; Firefox can't even be asked whether it was granted). So Bookie remembers that the camera worked here
 * once, and next time starts it straight away instead of showing its own "Allow camera" step first. If the browser
 * still asks, that's its own prompt; if it refuses, the step comes back.
 */
export async function cameraAllowedBefore(): Promise<boolean> {
  return (await Storage.getItem(ALLOWED_KEY)) != null;
}

export async function rememberCameraAllowed(allowed: boolean): Promise<void> {
  if (allowed) await Storage.setItem(ALLOWED_KEY, new Date().toISOString());
  else await Storage.removeItem(ALLOWED_KEY);
}

/**
 * What the scan screen shows. `wait`: still finding out. `camera`: the camera. `ask`: Bookie's "Allow camera" step.
 * `blocked`: the camera was refused, so it has to be allowed again in the browser's or phone's settings.
 */
export type CameraGate = 'wait' | 'camera' | 'ask' | 'blocked';

export function cameraGate(
  permission: { granted: boolean; status: string } | null,
  allowedBefore: boolean | null,
  failed: boolean,
): CameraGate {
  if (!permission || allowedBefore == null) return 'wait';
  if (permission.granted) return 'camera';
  if (permission.status === 'denied') return 'blocked';
  return allowedBefore && !failed ? 'camera' : 'ask';
}
