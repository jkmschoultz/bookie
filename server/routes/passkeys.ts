import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';

import { accountSummary, rpId, signedIn, type Ctx } from '../context';
import { fromBase64Url, randomToken, toBase64Url } from '../crypto';
import { ApiError, badRequest, json, readJson, str } from '../http';
import { clientIp, hit, LIMITS } from '../rateLimit';
import { insertUser, isUniqueClash, newUserFields, usernameTaken } from '../users';

/**
 * Passkeys (WebAuthn), with SimpleWebAuthn. Each step is two requests: options (with a fresh challenge, kept here for
 * five minutes and usable once), then the browser's signed answer to check. A passkey is tied to the host it was made on.
 */

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

interface ChallengeRow {
  challenge: string;
  rp_id: string;
  user_id: string | null;
  username: string | null;
  display_name: string | null;
}

async function saveChallenge(ctx: Ctx, purpose: 'signup' | 'signin' | 'add', challenge: string, user: { id?: string; username?: string; displayName?: string | null } = {}) {
  const id = randomToken(16);
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM webauthn_challenges WHERE expires_at <= ?').bind(ctx.now),
    ctx.db
      .prepare('INSERT INTO webauthn_challenges (id, purpose, challenge, rp_id, user_id, username, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, purpose, challenge, rpId(ctx), user.id ?? null, user.username ?? null, user.displayName ?? null, ctx.now + CHALLENGE_TTL_MS),
  ]);
  return id;
}

/** Takes a challenge out, so it can't be used twice. */
async function takeChallenge(ctx: Ctx, purpose: 'signup' | 'signin' | 'add', id: string): Promise<ChallengeRow> {
  const row = await ctx.db
    .prepare('DELETE FROM webauthn_challenges WHERE id = ? AND purpose = ? AND rp_id = ? AND expires_at > ? RETURNING challenge, rp_id, user_id, username, display_name')
    .bind(id, purpose, rpId(ctx), ctx.now)
    .first<ChallengeRow>();
  if (!row) throw new ApiError(400, 'challenge_expired', 'That took too long. Try again.');
  return row;
}

function answer<T>(body: Record<string, unknown>): T {
  if (!body.response || typeof body.response !== 'object') throw badRequest('Missing passkey answer.');
  return body.response as T;
}

const notChecked = () => new ApiError(400, 'passkey_failed', 'That passkey couldn’t be checked. Try again.');

/** Whether a failed insert was a passkey that's already registered (its credential id is the primary key). */
const isPasskeyClash = (e: unknown) => e instanceof Error && /UNIQUE constraint failed: passkeys\.id/.test(e.message);
const passkeyExists = () => new ApiError(409, 'passkey_exists', 'That passkey is already registered with Bookie.');

async function registrationOptions(ctx: Ctx, userId: string, username: string, displayName: string | null, exclude: { id: string; transports: string | null }[] = []) {
  return generateRegistrationOptions({
    rpName: 'Bookie',
    rpID: rpId(ctx),
    userName: username,
    userDisplayName: displayName ?? username,
    userID: new Uint8Array(new TextEncoder().encode(userId)),
    attestationType: 'none',
    excludeCredentials: exclude.map((p) => ({ id: p.id, transports: p.transports ? JSON.parse(p.transports) : undefined })),
    // A discoverable passkey, so signing in needs no username.
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  });
}

async function checkRegistration(ctx: Ctx, challenge: ChallengeRow, response: RegistrationResponseJSON) {
  try {
    const result = await verifyRegistrationResponse({ response, expectedChallenge: challenge.challenge, expectedOrigin: ctx.origin, expectedRPID: challenge.rp_id });
    if (result.verified) return result.registrationInfo.credential;
  } catch {
    // Reported below, the same way as a failed check.
  }
  throw notChecked();
}

const insertPasskey = (ctx: Ctx, userId: string, credential: Awaited<ReturnType<typeof checkRegistration>>) =>
  ctx.db
    .prepare('INSERT INTO passkeys (id, user_id, rp_id, public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(credential.id, userId, rpId(ctx), toBase64Url(credential.publicKey), credential.counter, credential.transports ? JSON.stringify(credential.transports) : null, ctx.now);

export async function signUpOptions(ctx: Ctx): Promise<Response> {
  await hit(ctx.db, LIMITS.signupIp, clientIp(ctx.request), ctx.now);
  const { username, displayName } = await newUserFields(ctx, await readJson(ctx.request));
  const userId = crypto.randomUUID();
  const options = await registrationOptions(ctx, userId, username, displayName);
  return json({ challengeId: await saveChallenge(ctx, 'signup', options.challenge, { id: userId, username, displayName }), options });
}

export async function signUpVerify(ctx: Ctx): Promise<Response> {
  const body = await readJson(ctx.request, 65_536);
  const challenge = await takeChallenge(ctx, 'signup', str(body.challengeId, 'challenge'));
  const credential = await checkRegistration(ctx, challenge, answer(body));
  const userId = challenge.user_id!;
  try {
    await ctx.db.batch([insertUser(ctx, userId, challenge.username!, challenge.display_name), insertPasskey(ctx, userId, credential)]);
  } catch (e) {
    if (isUniqueClash(e)) throw usernameTaken();
    if (isPasskeyClash(e)) throw passkeyExists();
    throw e;
  }
  return signedIn(ctx, userId, {}, 201);
}

export async function signInOptions(ctx: Ctx): Promise<Response> {
  await hit(ctx.db, LIMITS.passkeyIp, clientIp(ctx.request), ctx.now);
  const options = await generateAuthenticationOptions({ rpID: rpId(ctx), userVerification: 'preferred' });
  return json({ challengeId: await saveChallenge(ctx, 'signin', options.challenge), options });
}

export async function signInVerify(ctx: Ctx): Promise<Response> {
  const body = await readJson(ctx.request, 65_536);
  const challenge = await takeChallenge(ctx, 'signin', str(body.challengeId, 'challenge'));
  const response = answer<AuthenticationResponseJSON>(body);
  const passkey = await ctx.db
    .prepare('SELECT id, user_id, public_key, counter, transports FROM passkeys WHERE id = ? AND rp_id = ?')
    .bind(str(response.id, 'passkey', 1024), challenge.rp_id)
    .first<{ id: string; user_id: string; public_key: string; counter: number; transports: string | null }>();
  if (!passkey) throw new ApiError(401, 'unknown_passkey', 'That passkey isn’t for an account here.');
  let newCounter: number;
  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: ctx.origin,
      expectedRPID: challenge.rp_id,
      credential: { id: passkey.id, publicKey: fromBase64Url(passkey.public_key), counter: passkey.counter, transports: passkey.transports ? JSON.parse(passkey.transports) : undefined },
    });
    if (!result.verified) throw notChecked();
    newCounter = result.authenticationInfo.newCounter;
  } catch {
    throw notChecked();
  }
  await ctx.db.prepare('UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?').bind(newCounter, ctx.now, passkey.id).run();
  return signedIn(ctx, passkey.user_id);
}

export async function addOptions(ctx: Ctx, userId: string): Promise<Response> {
  const user = await ctx.db.prepare('SELECT username, display_name FROM users WHERE id = ?').bind(userId).first<{ username: string; display_name: string | null }>();
  const { results } = await ctx.db.prepare('SELECT id, transports FROM passkeys WHERE user_id = ? AND rp_id = ?').bind(userId, rpId(ctx)).all<{ id: string; transports: string | null }>();
  const options = await registrationOptions(ctx, userId, user!.username, user!.display_name, results);
  return json({ challengeId: await saveChallenge(ctx, 'add', options.challenge, { id: userId }), options });
}

export async function addVerify(ctx: Ctx, userId: string): Promise<Response> {
  const body = await readJson(ctx.request, 65_536);
  const challenge = await takeChallenge(ctx, 'add', str(body.challengeId, 'challenge'));
  if (challenge.user_id !== userId) throw notChecked();
  const credential = await checkRegistration(ctx, challenge, answer(body));
  try {
    await insertPasskey(ctx, userId, credential).run();
  } catch (e) {
    if (isPasskeyClash(e)) throw passkeyExists();
    throw e;
  }
  return json({ account: await accountSummary(ctx, userId) });
}
