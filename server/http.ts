/** Requests and responses: JSON, errors people can read, and cookies. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = 'bad_request') => new ApiError(400, code, message);
export const notFound = (message = 'Not found.') => new ApiError(404, 'not_found', message);
export const unauthorised = (message = 'Please sign in again.') => new ApiError(401, 'unauthorised', message);

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

/** Refuses bodies over `limit` bytes, and anything that isn't a JSON object. */
export async function readJson(request: Request, limit = 16_384): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > limit) throw new ApiError(413, 'too_large', 'That request is too large.');
  if (!text) return {};
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw badRequest('That request isn’t valid JSON.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('That request isn’t valid.');
  return body as Record<string, unknown>;
}

export function str(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string' || !value || value.length > max) throw badRequest(`Missing or invalid ${field}.`);
  return value;
}

export function cookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Only the sign-in routes read the refresh cookie, so it's only sent to them. */
export const REFRESH_COOKIE = 'bookie_refresh';
const COOKIE_PATH = '/api/auth';

export function refreshCookie(token: string, maxAgeSeconds: number): string {
  return `${REFRESH_COOKIE}=${encodeURIComponent(token)}; Path=${COOKIE_PATH}; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearRefreshCookie(): string {
  return `${REFRESH_COOKIE}=; Path=${COOKIE_PATH}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
