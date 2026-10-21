-- 共有画像の累積容量と件数を，全件走査せずに追跡する集計行とトリガー．
-- 新規保存は shares.ts がこの値と SHARE_STORAGE_LIMIT_BYTES を比べて止める．
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT OR IGNORE INTO meta(key, value) SELECT 'shares_bytes', COALESCE(SUM(length(image)), 0) FROM shares;
INSERT OR IGNORE INTO meta(key, value) SELECT 'shares_count', COUNT(*) FROM shares;
CREATE TRIGGER IF NOT EXISTS shares_usage_insert AFTER INSERT ON shares BEGIN
  UPDATE meta SET value = value + length(NEW.image) WHERE key = 'shares_bytes';
  UPDATE meta SET value = value + 1 WHERE key = 'shares_count';
END;
CREATE TRIGGER IF NOT EXISTS shares_usage_delete AFTER DELETE ON shares BEGIN
  UPDATE meta SET value = value - length(OLD.image) WHERE key = 'shares_bytes';
  UPDATE meta SET value = value - 1 WHERE key = 'shares_count';
END;
