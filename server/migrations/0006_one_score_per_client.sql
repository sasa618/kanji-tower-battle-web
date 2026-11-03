-- 同じ端末の記録は 1 件だけ残す．端末が分かる行（client が空でない）のうち，総画数の並び（総画数，高さ，字数，先着）で最も良い 1 件以外を消し，以後は一意索引で 2 件目を防ぐ．
DELETE FROM scores WHERE client<>'' AND id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY client ORDER BY score DESC, height DESC, count DESC, created ASC) AS rn
    FROM scores WHERE client<>''
  ) WHERE rn=1
);
CREATE UNIQUE INDEX IF NOT EXISTS scores_client_unique ON scores(client) WHERE client<>'';
