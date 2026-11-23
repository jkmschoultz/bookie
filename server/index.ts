import { auth, type Ctx } from './context';
import type { Env } from './db';
import { ApiError, json } from './http';
import { deleteAccount, exportAccount, getAccount, updateAccount } from './routes/account';
import { friendActivity, markActivitySeen } from './routes/activity';
import { recover, refresh, setPassword, signInWithPassword, signOut, signUpWithPassword } from './routes/auth';
import { acceptRequest, declineRequest, friendBooks, listFriends, removeFriend, requestFriend } from './routes/friends';
import { addOptions, addVerify, signInOptions, signInVerify, signUpOptions, signUpVerify } from './routes/passkeys';
import { sync } from './routes/sync';

/**
 * The Bookie API, served at /api on the same address as the web app (Cloudflare Pages Functions), so the web app's
 * sign-in cookie is first-party and needs no CORS. The phone app calls it with a bearer token instead.
 *
 * Every request that changes something must carry an X-Bookie header ("web" or "native"). A page on another site can't
 * add that header without the browser asking first, and nothing here says yes, which stops cross-site requests riding
 * on the cookie. An Origin header, when there is one, must be this site's own.
 */

type Handler = (ctx: Ctx) => Promise<Response>;
const signedIn =
  (fn: (ctx: Ctx, userId: string) => Promise<Response>): Handler =>
  async (ctx) =>
    fn(ctx, (await auth(ctx)).userId);

const ROUTES: [method: string, path: RegExp, handler: Handler][] = [
  ['GET', /^\/api\/health$/, health],
  ['POST', /^\/api\/auth\/password\/signup$/, signUpWithPassword],
  ['POST', /^\/api\/auth\/password\/signin$/, signInWithPassword],
  ['POST', /^\/api\/auth\/password\/recover$/, recover],
  ['POST', /^\/api\/auth\/passkey\/signup\/options$/, signUpOptions],
  ['POST', /^\/api\/auth\/passkey\/signup\/verify$/, signUpVerify],
  ['POST', /^\/api\/auth\/passkey\/signin\/options$/, signInOptions],
  ['POST', /^\/api\/auth\/passkey\/signin\/verify$/, signInVerify],
  ['POST', /^\/api\/auth\/refresh$/, refresh],
  ['POST', /^\/api\/auth\/signout$/, signOut],
  ['GET', /^\/api\/account$/, signedIn(getAccount)],
  ['PATCH', /^\/api\/account$/, signedIn(updateAccount)],
  ['DELETE', /^\/api\/account$/, signedIn(deleteAccount)],
  ['GET', /^\/api\/account\/export$/, signedIn(exportAccount)],
  ['POST', /^\/api\/account\/password$/, signedIn(setPassword)],
  ['POST', /^\/api\/account\/passkeys\/options$/, signedIn(addOptions)],
  ['POST', /^\/api\/account\/passkeys\/verify$/, signedIn(addVerify)],
  ['POST', /^\/api\/sync$/, signedIn(sync)],
  ['GET', /^\/api\/friends$/, signedIn(listFriends)],
  ['POST', /^\/api\/friends\/requests$/, signedIn(requestFriend)],
  ['POST', /^\/api\/friends\/requests\/([^/]+)\/accept$/, signedIn(acceptRequest)],
  ['POST', /^\/api\/friends\/requests\/([^/]+)\/decline$/, signedIn(declineRequest)],
  ['DELETE', /^\/api\/friends\/([^/]+)$/, signedIn(removeFriend)],
  ['GET', /^\/api\/friends\/([^/]+)\/books$/, signedIn(friendBooks)],
  ['GET', /^\/api\/friends\/([^/]+)\/activity$/, signedIn(friendActivity)],
  ['POST', /^\/api\/friends\/([^/]+)\/activity\/seen$/, signedIn(markActivitySeen)],
];

/** Whether this deployment has its database and signing key, and the database has its tables. */
async function health(ctx: Ctx): Promise<Response> {
  await ctx.db.prepare('SELECT 1 FROM users LIMIT 1').all();
  return json({ ok: true });
}

function allowedOrigins(env: Env, self: string): string[] {
  return [self, ...(env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)];
}

/** For local development only: lets the Expo dev server on another port call this API. */
function corsHeaders(origin: string | null, self: string): Record<string, string> {
  if (!origin || origin === self) return {};
  return { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', vary: 'Origin' };
}

const errorBody = (e: ApiError) => ({ error: e.code, message: e.message });

export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins(env, url.origin).includes(origin)) return json({ error: 'forbidden', message: 'Not allowed.' }, 403);
  const cors = corsHeaders(origin, url.origin);
  if (request.method === 'OPTIONS') {
    if (!Object.keys(cors).length) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: { ...cors, 'access-control-allow-methods': 'GET, POST, PATCH, DELETE', 'access-control-allow-headers': 'content-type, authorization, x-bookie', 'access-control-max-age': '600' },
    });
  }
  const response = await route(request, env, url, origin);
  for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
  return response;
}

async function route(request: Request, env: Env, url: URL, origin: string | null): Promise<Response> {
  const client = request.headers.get('x-bookie');
  if (request.method !== 'GET' && client !== 'web' && client !== 'native') return json({ error: 'forbidden', message: 'Not allowed.' }, 403);
  const match = ROUTES.map(([method, path, handler]) => ({ method, handler, m: url.pathname.match(path) })).filter((r) => r.m);
  if (!match.length) return json({ error: 'not_found', message: 'Not found.' }, 404);
  const found = match.find((r) => r.method === request.method);
  if (!found) return json({ error: 'method_not_allowed', message: 'Not allowed.' }, 405);
  if (!env.DB || !env.SESSION_SIGNING_KEY || env.SESSION_SIGNING_KEY.length < 32)
    return json({ ok: false, error: 'not_configured', message: 'Accounts aren’t set up here yet.' }, 503);

  const ctx: Ctx = {
    request,
    env,
    db: env.DB,
    url,
    origin: origin ?? url.origin,
    client: client === 'native' ? 'native' : 'web',
    now: Date.now(),
    params: found.m!.slice(1).map(decodeURIComponent),
  };
  try {
    return await found.handler(ctx);
  } catch (e) {
    if (e instanceof ApiError) return json(errorBody(e), e.status);
    // Never log request bodies or headers: they hold passwords and tokens.
    const message = e instanceof Error ? e.message : String(e);
    console.error(`${request.method} ${url.pathname} failed: ${message}`);
    // D1 refuses work once a daily limit is reached, or when it's briefly unavailable: the app keeps the library on
    // the device and tries again later.
    return json({ error: 'unavailable', message: 'Your account can’t be reached just now. Your books are safe on this device; Bookie will try again later.' }, 503);
  }
}
