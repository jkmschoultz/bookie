-- Accounts, sign-in, library sync and friends. Applied with `wrangler d1 migrations apply` (see the README).
-- Times are milliseconds since 1970 (UTC). Ids are random: UUIDs for rows people own, random tokens elsewhere.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  -- As typed at sign-up, for showing; username_key is the lower-case form, unique, for finding.
  username TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  display_name TEXT,
  -- Whether accepted friends can see this user's shelf.
  shelf_visible INTEGER NOT NULL DEFAULT 1,
  -- The last sync sequence number handed out to this user's books (see books.seq).
  seq INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- PBKDF2-SHA256: hash and salt are base64url, iterations kept so they can be raised later.
CREATE TABLE password_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- One recovery code per user, for resetting a forgotten password. SHA-256 of the code (it is long and random).
CREATE TABLE recovery_codes (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- WebAuthn credentials. A passkey belongs to the address it was made at (rp_id), e.g. mybookie.pages.dev.
CREATE TABLE passkeys (
  id TEXT PRIMARY KEY, -- credential id, base64url
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rp_id TEXT NOT NULL,
  public_key TEXT NOT NULL, -- COSE public key, base64url
  counter INTEGER NOT NULL,
  transports TEXT, -- JSON array
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX passkeys_user ON passkeys(user_id);

-- Challenges handed out for a passkey sign-up, sign-in or new passkey. Single use, short-lived.
CREATE TABLE webauthn_challenges (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'signin', 'add')),
  challenge TEXT NOT NULL,
  rp_id TEXT NOT NULL,
  -- For 'signup', the account to create; for 'add', the signed-in user.
  user_id TEXT,
  username TEXT,
  display_name TEXT,
  expires_at INTEGER NOT NULL
);
CREATE INDEX webauthn_challenges_expiry ON webauthn_challenges(expires_at);

-- One row per signed-in device. The refresh token is "<id>.<secret>"; only SHA-256 of the secret is kept. Each refresh
-- replaces it; the one before is kept briefly so two requests racing with the same token don't sign the device out.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_hash TEXT NOT NULL,
  previous_hash TEXT,
  rotated_at INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Fixed-window counters for sign-in, sign-up and friend requests. key is SHA-256 of what is counted (never a raw IP).
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

-- Each user's books. data is what friends may see (no notes, ratings or reading dates); private_data is the rest.
-- A deleted book stays as an empty tombstone (deleted_at set) so other devices learn about it. seq orders changes
-- for sync: a device asks for everything after the last seq it saw.
CREATE TABLE books (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  private_data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  seq INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX books_user_seq ON books(user_id, seq);

-- A friend request is 'pending' until the addressee accepts it. Declining or removing deletes the row. pair_key is
-- the two user ids in order, so a pair can only have one row whoever asked.
CREATE TABLE friendships (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pair_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at INTEGER NOT NULL,
  responded_at INTEGER
);
CREATE INDEX friendships_requester ON friendships(requester_id, status);
CREATE INDEX friendships_addressee ON friendships(addressee_id, status);
