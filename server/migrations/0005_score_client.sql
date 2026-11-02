-- セッションを D1 に書かない方式に変える．記録の端末ごとの送信制限は，sessions との結合ではなく scores 自身の client 列で数える．
ALTER TABLE scores ADD COLUMN client TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS scores_client_created ON scores(client, created);
