/**
 * Passkeys on phones would need a native module and the app linked to the website (associated domains), which needs
 * a development build. Until then the phone app signs in with a password; passkeys work on the web.
 */
export const passkeysSupported = () => false;

export async function createPasskey(_options: unknown): Promise<unknown> {
  throw new Error('Passkeys aren’t available in the app yet. Use a password, or Bookie on the web.');
}

export async function presentPasskey(_options: unknown): Promise<unknown> {
  throw new Error('Passkeys aren’t available in the app yet. Use a password, or Bookie on the web.');
}
