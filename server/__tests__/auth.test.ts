import { ORIGIN, testApi } from './helpers';

describe('setup', () => {
  it('answers 503 when the database or signing key is missing, so the app stays device-only', async () => {
    const { call, env } = testApi();
    delete env.SESSION_SIGNING_KEY;
    expect((await call('GET', '/api/health')).status).toBe(503);
    const short = testApi();
    short.env.SESSION_SIGNING_KEY = 'short';
    expect((await short.call('POST', '/api/auth/password/signin', { username: 'ann', password: 'x' })).body.error).toBe('not_configured');
  });

  it('is healthy once set up', async () => {
    expect((await testApi().call('GET', '/api/health')).body).toEqual({ ok: true });
  });
});

describe('cross-site protection', () => {
  it('refuses changes without the X-Bookie header', async () => {
    const { call } = testApi();
    expect((await call('POST', '/api/auth/password/signin', { username: 'ann', password: 'x' }, { client: null })).status).toBe(403);
  });

  it('refuses requests from another site', async () => {
    const { call } = testApi();
    expect((await call('POST', '/api/auth/refresh', {}, { client: 'web', origin: 'https://evil.example' })).status).toBe(403);
    expect((await call('OPTIONS', '/api/sync', undefined, { origin: 'https://evil.example' })).status).toBe(403);
  });

  it('lets an origin listed for development call it, with CORS headers', async () => {
    const { call, env } = testApi();
    env.ALLOWED_ORIGINS = 'http://localhost:8081';
    const res = await call('GET', '/api/health', undefined, { origin: 'http://localhost:8081' });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('needs a valid access token for account data', async () => {
    const { call, signUp } = testApi();
    await signUp('ann');
    expect((await call('GET', '/api/account')).status).toBe(401);
    expect((await call('GET', '/api/account', undefined, { token: 'nonsense' })).status).toBe(401);
    expect((await call('POST', '/api/sync', { since: 0 }, { token: 'a.b' })).status).toBe(401);
  });
});

describe('sign-up with a password', () => {
  it('creates the account, signs in, and shows a recovery code once', async () => {
    const { call, db } = testApi();
    const res = await call('POST', '/api/auth/password/signup', { username: 'Johan', displayName: ' Johan S ', password: 'a long password' });
    expect(res.status).toBe(201);
    expect(res.body.account).toMatchObject({ username: 'Johan', displayName: 'Johan S', hasPassword: true, passkeys: [], shelfVisible: true });
    expect(res.body.recoveryCode).toMatch(/^\w{4}-\w{4}-\w{4}-\w{4}$/);
    expect(res.body.refreshToken).toBeTruthy();
    // Only hashes are stored.
    const stored = JSON.stringify(db.raw.prepare('SELECT * FROM password_credentials, recovery_codes').all());
    expect(stored).not.toContain('a long password');
    expect(stored).not.toContain(res.body.recoveryCode.replace(/-/g, ''));
  });

  it('on the web, puts the refresh token in an HttpOnly cookie for /api/auth and not in the body', async () => {
    const res = await testApi().call('POST', '/api/auth/password/signup', { username: 'ann', password: 'a long password' }, { client: 'web' });
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.body.accessToken).toBeTruthy();
    expect(res.headers.get('set-cookie')).toMatch(/^bookie_refresh=[^;]+; Path=\/api\/auth; Max-Age=\d+; HttpOnly; Secure; SameSite=Lax$/);
  });

  it('refuses a taken username whatever its case, and bad usernames or passwords', async () => {
    const { call, signUp } = testApi();
    await signUp('Johan');
    expect((await call('POST', '/api/auth/password/signup', { username: 'johan', password: 'a long password' })).body.error).toBe('username_taken');
    expect((await call('POST', '/api/auth/password/signup', { username: 'jo', password: 'a long password' })).body.error).toBe('invalid_username');
    expect((await call('POST', '/api/auth/password/signup', { username: 'ann', password: 'short' })).body.error).toBe('invalid_password');
  });

  it('limits sign-ups from one address', async () => {
    const { call } = testApi();
    const tries = [];
    for (let i = 0; i < 11; i++) tries.push((await call('POST', '/api/auth/password/signup', { username: `user${i}`, password: 'short' })).status);
    expect(tries.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(tries[10]).toBe(429);
  });
});

describe('sign-in with a password', () => {
  it('signs in with any case of the username', async () => {
    const { call, signUp } = testApi();
    await signUp('Johan');
    const res = await call('POST', '/api/auth/password/signin', { username: 'JOHAN', password: 'a long password' });
    expect(res.status).toBe(200);
    expect(res.body.account.username).toBe('Johan');
  });

  it('gives the same answer for a wrong password and an unknown username', async () => {
    const { call, signUp } = testApi();
    await signUp('ann');
    const wrong = await call('POST', '/api/auth/password/signin', { username: 'ann', password: 'not the password' });
    const unknown = await call('POST', '/api/auth/password/signin', { username: 'nobody', password: 'not the password' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  const signIn = (call: ReturnType<typeof testApi>['call'], password: string, ip: string, username = 'ann') =>
    call('POST', '/api/auth/password/signin', { username, password }, { ip });

  it('can’t be locked out by someone else trying their username', async () => {
    const { call, signUp } = testApi();
    await signUp('ann');
    for (let i = 0; i < 12; i++) await signIn(call, 'wrong password', '198.51.100.66');
    expect((await signIn(call, 'a long password', '203.0.113.20')).status).toBe(200);
  });

  it('stops a username from one address after 10 failed tries, even with the right password', async () => {
    const { call, signUp } = testApi();
    await signUp('ann');
    for (let i = 0; i < 10; i++) expect((await signIn(call, 'wrong password', '198.51.100.7')).status).toBe(401);
    expect((await signIn(call, 'a long password', '198.51.100.7')).status).toBe(429);
  });

  it('doesn’t count successful sign-ins, and forgets failures after one', async () => {
    const { call, signUp } = testApi();
    await signUp('ann');
    for (let i = 0; i < 9; i++) await signIn(call, 'wrong password', '198.51.100.7');
    expect((await signIn(call, 'a long password', '198.51.100.7')).status).toBe(200);
    for (let i = 0; i < 15; i++) expect((await signIn(call, 'a long password', '198.51.100.7')).status).toBe(200);
    for (let i = 0; i < 9; i++) await signIn(call, 'wrong password', '198.51.100.7');
    expect((await signIn(call, 'a long password', '198.51.100.7')).status).toBe(200);
  });

  it('lets no more than 10 wrong guesses through when they’re sent all at once', async () => {
    const { call, signUp } = testApi();
    await signUp('ann');
    const statuses = await Promise.all(Array.from({ length: 60 }, () => signIn(call, 'wrong password', '198.51.100.7')));
    expect(statuses.filter((r) => r.status === 401)).toHaveLength(10);
    expect(statuses.filter((r) => r.status === 429)).toHaveLength(50);
    // Ann, from her own address, is unaffected.
    expect((await signIn(call, 'a long password', '203.0.113.20')).status).toBe(200);
  });

  it('stops a username after 100 failed tries from many addresses in an hour', async () => {
    const { call, signUp } = testApi();
    await signUp('ann');
    for (let i = 0; i < 100; i++) await signIn(call, 'wrong password', `10.0.${Math.floor(i / 5)}.${i % 5}`);
    expect((await signIn(call, 'a long password', '203.0.113.20')).status).toBe(429);
  });

  it('stops one address after 50 failed tries, whatever the usernames', async () => {
    const { call, signUp } = testApi();
    await signUp('ann');
    for (let i = 0; i < 50; i++) await signIn(call, 'wrong password', '198.51.100.7', `user${i}`);
    expect((await signIn(call, 'a long password', '198.51.100.7')).status).toBe(429);
    expect((await signIn(call, 'a long password', '203.0.113.20')).status).toBe(200);
  });

  it('limits recovery codes to 5 wrong tries per username and address', async () => {
    const { call, signUp } = testApi();
    const { recoveryCode } = await signUp('ann');
    const recover = (code: string) => call('POST', '/api/auth/password/recover', { username: 'ann', recoveryCode: code, password: 'a new long password' }, { ip: '198.51.100.7' });
    for (let i = 0; i < 5; i++) expect((await recover('AAAA-AAAA-AAAA-AAAA')).status).toBe(401);
    expect((await recover(recoveryCode)).status).toBe(429);
  });

  it('keeps no raw IPs or usernames in the rate limit table', async () => {
    const { call, db } = testApi();
    await call('POST', '/api/auth/password/signin', { username: 'ann', password: 'wrong password' });
    expect(JSON.stringify(db.raw.prepare('SELECT * FROM rate_limits').all())).not.toMatch(/203\.0\.113|ann/);
  });
});

describe('refresh and sign-out on the web', () => {
  const cookieOf = (h: Headers) => h.get('set-cookie')!.split(';')[0];

  it('rotates the cookie, and an old cookie used again ends the session', async () => {
    const { call } = testApi();
    const signup = await call('POST', '/api/auth/password/signup', { username: 'ann', password: 'a long password' }, { client: 'web' });
    const first = cookieOf(signup.headers);
    const refreshed = await call('POST', '/api/auth/refresh', {}, { client: 'web', cookie: first });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.account.username).toBe('ann');
    const second = cookieOf(refreshed.headers);
    expect(second).not.toBe(first);
    // Much later, someone replays the first cookie.
    const now = Date.now;
    Date.now = () => now() + 60_000;
    try {
      const replay = await call('POST', '/api/auth/refresh', {}, { client: 'web', cookie: first });
      expect(replay.status).toBe(401);
      expect(replay.headers.get('set-cookie')).toContain('Max-Age=0');
      expect((await call('POST', '/api/auth/refresh', {}, { client: 'web', cookie: second })).status).toBe(401);
    } finally {
      Date.now = now;
    }
  });

  it('doesn’t end a session for someone who only knows its id (it is in every access token)', async () => {
    const { call, signUp } = testApi();
    const { token, refreshToken } = await signUp('ann');
    const [id] = refreshToken.split('.');
    await call('POST', '/api/auth/signout', { refreshToken: `${id}.guessed` });
    await call('POST', '/api/auth/signout', { refreshToken: id });
    expect((await call('GET', '/api/account', undefined, { token })).status).toBe(200);
    await call('POST', '/api/auth/signout', { refreshToken });
    expect((await call('GET', '/api/account', undefined, { token })).status).toBe(401);
  });

  it('signs out: the session ends, the access token stops working and the cookie is cleared', async () => {
    const { call } = testApi();
    const signup = await call('POST', '/api/auth/password/signup', { username: 'ann', password: 'a long password' }, { client: 'web' });
    const cookie = cookieOf(signup.headers);
    const out = await call('POST', '/api/auth/signout', {}, { client: 'web', cookie });
    expect(out.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await call('GET', '/api/account', undefined, { token: signup.body.accessToken })).status).toBe(401);
  });

  it('refreshes the phone app from the body', async () => {
    const { call, signUp } = testApi();
    const { refreshToken } = await signUp('ann');
    const res = await call('POST', '/api/auth/refresh', { refreshToken });
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });
});

describe('recovery', () => {
  it('sets a new password with the recovery code, which is then used up', async () => {
    const { call, signUp } = testApi();
    const { recoveryCode, token } = await signUp('ann');
    const res = await call('POST', '/api/auth/password/recover', { username: 'ann', recoveryCode: recoveryCode.toLowerCase().replace(/-/g, ' '), password: 'a new long password' });
    expect(res.status).toBe(200);
    expect(res.body.recoveryCode).not.toBe(recoveryCode);
    // Every other session ended.
    expect((await call('GET', '/api/account', undefined, { token })).status).toBe(401);
    expect((await call('POST', '/api/auth/password/signin', { username: 'ann', password: 'a new long password' })).status).toBe(200);
    expect((await call('POST', '/api/auth/password/recover', { username: 'ann', recoveryCode, password: 'another long password' })).status).toBe(401);
  });
});

describe('adding or changing a password', () => {
  it('needs the current password to change it', async () => {
    const { call, signUp } = testApi();
    const { token } = await signUp('ann');
    expect((await call('POST', '/api/account/password', { password: 'a newer password' }, { token })).status).toBe(401);
    const ok = await call('POST', '/api/account/password', { password: 'a newer password', currentPassword: 'a long password' }, { token });
    expect(ok.status).toBe(200);
    expect(ok.body.recoveryCode).toBeUndefined();
  });
});

describe('passkeys', () => {
  it('hands out sign-up options for this site, with a single-use challenge', async () => {
    const { call, db } = testApi();
    const res = await call('POST', '/api/auth/passkey/signup/options', { username: 'Ann' }, { client: 'web' });
    expect(res.body.options.rp).toEqual({ name: 'Bookie', id: new URL(ORIGIN).hostname });
    expect(res.body.options.authenticatorSelection.residentKey).toBe('required');
    const bad = { challengeId: res.body.challengeId, response: { id: 'x', rawId: 'x', type: 'public-key', response: {}, clientExtensionResults: {} } };
    expect((await call('POST', '/api/auth/passkey/signup/verify', bad, { client: 'web' })).body.error).toBe('passkey_failed');
    // The challenge is gone after one try.
    expect((await call('POST', '/api/auth/passkey/signup/verify', bad, { client: 'web' })).body.error).toBe('challenge_expired');
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM users').get()!.n).toBe(0);
  });

  it('refuses a taken username before asking for a passkey', async () => {
    const { call, signUp } = testApi();
    await signUp('ann');
    expect((await call('POST', '/api/auth/passkey/signup/options', { username: 'ANN' }, { client: 'web' })).body.error).toBe('username_taken');
  });

  it('says a passkey is unknown when it was never registered here', async () => {
    const { call } = testApi();
    const opts = await call('POST', '/api/auth/passkey/signin/options', {}, { client: 'web' });
    const res = await call('POST', '/api/auth/passkey/signin/verify', { challengeId: opts.body.challengeId, response: { id: 'nope', rawId: 'nope', type: 'public-key', response: {}, clientExtensionResults: {} } }, { client: 'web' });
    expect(res.body.error).toBe('unknown_passkey');
  });
});
