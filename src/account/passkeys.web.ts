import { browserSupportsWebAuthn, startAuthentication, startRegistration, WebAuthnError } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';

/** Passkeys in the browser, with SimpleWebAuthn. A passkey made here only works on this address. */
export const passkeysSupported = () => browserSupportsWebAuthn();

/** Turns the browser's errors into something to show, and a cancelled prompt into a plain message. */
function readable(e: unknown): Error {
  if (e instanceof WebAuthnError && e.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') return new Error('This device already has a passkey for your account.');
  if (e instanceof Error && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return new Error('The passkey prompt was closed. Try again when you’re ready.');
  return new Error('Your browser couldn’t use a passkey. Try again, or use a password.');
}

export async function createPasskey(options: unknown) {
  try {
    return await startRegistration({ optionsJSON: options as PublicKeyCredentialCreationOptionsJSON });
  } catch (e) {
    throw readable(e);
  }
}

export async function presentPasskey(options: unknown) {
  try {
    return await startAuthentication({ optionsJSON: options as PublicKeyCredentialRequestOptionsJSON });
  } catch (e) {
    throw readable(e);
  }
}
