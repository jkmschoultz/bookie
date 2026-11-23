import { normaliseRecoveryCode, passwordProblem, usernameKey } from '../../shared/account';
import { accountSummary, signedIn, signedOut, sessionResponse, type Ctx } from '../context';
import { DUMMY_HASH, hashPassword, recoveryCode, sha256, verifyPassword, constantTimeEqual, type PasswordHash } from '../crypto';
import { ApiError, clearRefreshCookie, cookie, json, readJson, REFRESH_COOKIE, str, unauthorised } from '../http';
import { clear, clientIp, giveBack, hit, LIMITS, take, type Counter } from '../rateLimit';
import { endSession, refreshSession } from '../sessions';
import { findUser, insertUser, isUniqueClash, newUserFields, usernameTaken } from '../users';

/** The same answer for a wrong username or a wrong password, so neither gives away which accounts exist. */
const wrongDetails = () => new ApiError(401, 'wrong_details', 'That username and password don’t match.');

function checkPassword(password: unknown): string {
  const text = typeof password === 'string' ? password : '';
  const problem = passwordProblem(text);
  if (problem) throw new ApiError(400, 'invalid_password', problem);
  return text;
}

/** A new recovery code, stored hashed. Returns the statement to store it and the code to show once. */
async function newRecoveryCode(ctx: Ctx, userId: string) {
  const code = recoveryCode();
  const statement = ctx.db
    .prepare('INSERT INTO recovery_codes (user_id, code_hash, created_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET code_hash = excluded.code_hash, created_at = excluded.created_at')
    .bind(userId, await sha256(normaliseRecoveryCode(code)), ctx.now);
  return { code, statement };
}

const storePassword = (ctx: Ctx, userId: string, h: PasswordHash) =>
  ctx.db
    .prepare('INSERT INTO password_credentials (user_id, hash, salt, iterations, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET hash = excluded.hash, salt = excluded.salt, iterations = excluded.iterations, updated_at = excluded.updated_at')
    .bind(userId, h.hash, h.salt, h.iterations, ctx.now);

export async function signUpWithPassword(ctx: Ctx): Promise<Response> {
  await hit(ctx.db, LIMITS.signupIp, clientIp(ctx.request), ctx.now);
  const body = await readJson(ctx.request);
  const { username, displayName } = await newUserFields(ctx, body);
  const password = checkPassword(body.password);
  const id = crypto.randomUUID();
  const recovery = await newRecoveryCode(ctx, id);
  try {
    await ctx.db.batch([insertUser(ctx, id, username, displayName), storePassword(ctx, id, await hashPassword(password)), recovery.statement]);
  } catch (e) {
    if (isUniqueClash(e)) throw usernameTaken();
    throw e;
  }
  return signedIn(ctx, id, { recoveryCode: recovery.code }, 201);
}

/** Failed sign-ins are counted per username and address (strict), per username (loose) and per address. */
function signInCounters(ctx: Ctx, username: string, strict = LIMITS.signinUserIp, loose = LIMITS.signinUser): Counter[] {
  const ip = clientIp(ctx.request);
  const who = usernameKey(username);
  return [
    [strict, `${who}|${ip}`],
    [loose, who],
    [LIMITS.signinIp, ip],
  ];
}

/** A sign-in that worked doesn't count: forget this username's failures from this address, and give the attempt back. */
async function succeeded(ctx: Ctx, [strict, ...rest]: Counter[]) {
  await clear(ctx.db, ...strict);
  await giveBack(ctx.db, rest);
}

export async function signInWithPassword(ctx: Ctx): Promise<Response> {
  const body = await readJson(ctx.request);
  const username = str(body.username, 'username', 100);
  const password = str(body.password, 'password', 1000);
  const counters = signInCounters(ctx, username);
  await take(ctx.db, counters, ctx.now);
  const user = await findUser(ctx, username);
  const stored = user
    ? await ctx.db.prepare('SELECT hash, salt, iterations FROM password_credentials WHERE user_id = ?').bind(user.id).first<PasswordHash>()
    : null;
  // Always hash once, so a missing user or a passkey-only account answers as slowly as a wrong password.
  const ok = await verifyPassword(password, stored ?? DUMMY_HASH);
  if (!user || !stored || !ok) throw wrongDetails();
  await succeeded(ctx, counters);
  return signedIn(ctx, user.id);
}

/** Set a new password with the recovery code. Uses up the code, signs out everywhere, and hands out a new code. */
export async function recover(ctx: Ctx): Promise<Response> {
  const body = await readJson(ctx.request);
  const username = str(body.username, 'username', 100);
  const code = str(body.recoveryCode, 'recovery code', 100);
  const password = checkPassword(body.password);
  const counters = signInCounters(ctx, username, LIMITS.recoverUserIp, LIMITS.recoverUser);
  await take(ctx.db, counters, ctx.now);
  const user = await findUser(ctx, username);
  const stored = user ? await ctx.db.prepare('SELECT code_hash FROM recovery_codes WHERE user_id = ?').bind(user.id).first<{ code_hash: string }>() : null;
  const presented = await sha256(normaliseRecoveryCode(code));
  if (!user || !stored || !constantTimeEqual(presented, stored.code_hash))
    throw new ApiError(401, 'wrong_details', 'That username and recovery code don’t match.');
  await succeeded(ctx, counters);
  const next = await newRecoveryCode(ctx, user.id);
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    storePassword(ctx, user.id, await hashPassword(password)),
    next.statement,
  ]);
  return signedIn(ctx, user.id, { recoveryCode: next.code });
}

/** The refresh token, from the cookie on the web or the body in the app. */
async function presentedRefresh(ctx: Ctx): Promise<string | null> {
  if (ctx.client === 'web') return cookie(ctx.request, REFRESH_COOKIE);
  const body = await readJson(ctx.request);
  return typeof body.refreshToken === 'string' ? body.refreshToken : null;
}

export async function refresh(ctx: Ctx): Promise<Response> {
  const token = await presentedRefresh(ctx);
  if (!token) throw unauthorised('Not signed in.');
  try {
    const issued = await refreshSession(ctx.db, ctx.env.SESSION_SIGNING_KEY, token, ctx.now);
    return sessionResponse(ctx, issued, { account: await accountSummary(ctx, issued.userId) });
  } catch (e) {
    // A dead session also clears the web cookie, so the browser stops sending it.
    if (e instanceof ApiError && e.status === 401)
      return json({ error: e.code, message: e.message }, 401, ctx.client === 'web' ? { 'set-cookie': clearRefreshCookie() } : {});
    throw e;
  }
}

export async function signOut(ctx: Ctx): Promise<Response> {
  const token = await presentedRefresh(ctx);
  if (token) await endSession(ctx.db, token);
  return signedOut(ctx);
}

/** Add a password to an account (e.g. one made with a passkey), or change it. Changing needs the current one. */
export async function setPassword(ctx: Ctx, userId: string): Promise<Response> {
  const body = await readJson(ctx.request);
  const password = checkPassword(body.password);
  const stored = await ctx.db.prepare('SELECT hash, salt, iterations FROM password_credentials WHERE user_id = ?').bind(userId).first<PasswordHash>();
  if (stored) {
    const counters: Counter[] = [[LIMITS.passwordChange, userId]];
    await take(ctx.db, counters, ctx.now);
    if (typeof body.currentPassword !== 'string' || !(await verifyPassword(body.currentPassword, stored)))
      throw new ApiError(401, 'wrong_details', 'Your current password isn’t right.');
    await giveBack(ctx.db, counters);
  }
  const statements = [storePassword(ctx, userId, await hashPassword(password))];
  // A first password comes with a recovery code, for when it's forgotten.
  const recovery = stored ? null : await newRecoveryCode(ctx, userId);
  if (recovery) statements.push(recovery.statement);
  await ctx.db.batch(statements);
  return json({ account: await accountSummary(ctx, userId), ...(recovery ? { recoveryCode: recovery.code } : {}) });
}
