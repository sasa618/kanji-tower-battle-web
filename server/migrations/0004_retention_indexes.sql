-- Retention checks run at the start of each play and after score submission.
-- Index the timestamp itself so an empty cleanup does not scan every saved row.
CREATE INDEX IF NOT EXISTS sessions_created ON sessions(created);
CREATE INDEX IF NOT EXISTS scores_created ON scores(created);
