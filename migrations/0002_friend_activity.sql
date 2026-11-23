-- What friends see change on a shelf: a book added, started or finished. Written by sync as changes arrive, never for
-- deletions, and not while the shelf is hidden. Holds the title only (friends can see it on the shelf anyway), never
-- notes, ratings or reading dates. Kept 30 days. kind 'added_many' is a big import in one go, with its book count.
CREATE TABLE friend_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('added', 'started', 'finished', 'added_many')),
  title TEXT,
  count INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX friend_activity_user ON friend_activity(user_id, created_at);

-- The newest of a friend's activity a viewer has seen (friend_activity.id), so anything newer shows as a dot on that
-- friend's aisle sign. Without a row, it's whatever happened since they became friends.
CREATE TABLE activity_seen (
  viewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seen_id INTEGER NOT NULL,
  PRIMARY KEY (viewer_id, friend_id)
);
