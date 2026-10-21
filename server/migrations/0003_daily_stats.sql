-- 匿名の利用状況．日本時間の日付ごとに，終了したプレイ数・合計プレイ秒数・落下数を足し込む．
-- 1 セッションにつき 1 回だけ数えるため，sessions に報告済みの印を持つ．
CREATE TABLE IF NOT EXISTS daily_stats (
  day TEXT PRIMARY KEY,
  games INTEGER NOT NULL DEFAULT 0,
  seconds REAL NOT NULL DEFAULT 0,
  drops INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE sessions ADD COLUMN reported INTEGER NOT NULL DEFAULT 0;
