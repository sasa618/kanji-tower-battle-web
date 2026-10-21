CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  client TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_client_created ON sessions(client, created);
CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  height REAL NOT NULL,
  count INTEGER NOT NULL,
  duration REAL NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_rank ON scores(score DESC, height DESC, count DESC, created ASC);
CREATE INDEX IF NOT EXISTS scores_height_rank ON scores(height DESC, score DESC, count DESC, created ASC);
CREATE INDEX IF NOT EXISTS scores_count_rank ON scores(count DESC, score DESC, height DESC, created ASC);

CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  client TEXT NOT NULL,
  record TEXT NOT NULL,
  score INTEGER NOT NULL,
  height REAL NOT NULL,
  count INTEGER NOT NULL,
  image BLOB NOT NULL,
  created INTEGER NOT NULL,
  UNIQUE(client, record)
);
CREATE INDEX IF NOT EXISTS shares_client_created ON shares(client,created);
CREATE INDEX IF NOT EXISTS shares_created ON shares(created);
