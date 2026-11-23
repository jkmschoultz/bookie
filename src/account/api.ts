import { Platform } from 'react-native';

import type { AccountSummary } from '@shared/account';

import { CLIENT, forgetRefreshToken, loadRefreshToken, saveRefreshToken } from './tokens';

export type { AccountSummary };

/**
 * Talking to the Bookie API. On the web it's on the same address as the app (/api), unless EXPO_PUBLIC_BOOKIE_API_URL
 * points elsewhere (for local development). The phone app calls the address in EXPO_PUBLIC_BOOKIE_API_URL, or the live
 * site. The access token lives only in memory; the refresh token in a cookie (web) or the keychain (phones).
 */
const BASE = (process.env.EXPO_PUBLIC_BOOKIE_API_URL ?? (Platform.OS === 'web' ? '' : 'https://mybookie.pages.dev')).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
  /** Not a problem with the request: offline, the account is unreachable, or it's busy. Worth trying again later. */
  get temporary() {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

const OFFLINE = 'Bookie can’t reach your account just now. Your books are safe on this device.';

let accessToken: string | null = null;
let refreshing: Promise<AccountSummary | null> | null = null;

async function send(method: string, path: string, body?: unknown, auth = true): Promise<Response> {
  const headers: Record<string, string> = { 'x-bookie': CLIENT };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth && accessToken) headers.authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // The refresh cookie: same-origin normally, or the local API during development.
      credentials: BASE ? 'include' : 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'offline', OFFLINE);
  }
}

async function read<T>(res: Response): Promise<T> {
  let body: Record<string, unknown> | null = null;
  try {
    body = await res.json();
  } catch {
    // Not JSON: the web app's own page, so there's no API at this address.
  }
  if (!body) throw new ApiError(res.ok ? 503 : res.status, 'not_configured', 'Accounts aren’t available here.');
  if (!res.ok) throw new ApiError(res.status, String(body.error ?? 'error'), String(body.message ?? OFFLINE));
  return body as T;
}

interface Session {
  accessToken: string;
  refreshToken?: string;
  account: AccountSummary;
}

/** Keep a new session from a sign-in, sign-up or refresh. */
export async function startSession<T extends Session>(session: T): Promise<T> {
  accessToken = session.accessToken;
  if (session.refreshToken) await saveRefreshToken(session.refreshToken);
  return session;
}

export async function forgetSession(): Promise<void> {
  accessToken = null;
  await forgetRefreshToken();
}

/**
 * A new access token from the refresh token. Resolves to the account, or null when the session is over (signed out
 * elsewhere, expired, or deleted). Only one runs at a time.
 */
export function refreshSession(): Promise<AccountSummary | null> {
  refreshing ??= (async () => {
    try {
      for (let attempt = 0; ; attempt++) {
        const refreshToken = CLIENT === 'native' ? await loadRefreshToken() : null;
        if (CLIENT === 'native' && !refreshToken) return null;
        const res = await send('POST', '/api/auth/refresh', CLIENT === 'native' ? { refreshToken } : {}, false);
        // Another request just refreshed with the same token: the new one is on its way, so ask again.
        if (res.status === 409 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        if (res.status === 401) {
          await forgetSession();
          return null;
        }
        return (await startSession(await read<Session>(res))).account;
      }
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Calls the API, refreshing the access token once if it has run out. */
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res = await send(method, path, body);
  if (res.status === 401 && (await refreshSession())) res = await send(method, path, body);
  return read<T>(res);
}

/** Calls the API without a session (signing in or up). */
export async function publicApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  return read<T>(await send(method, path, body, false));
}

/** Whether this address has a working API: the database and key are set up. */
export async function apiAvailable(): Promise<boolean> {
  try {
    await publicApi('GET', '/api/health');
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) throw e;
    return false;
  }
}
