# 公開・検証記録

本書は，Web版「合体！漢字タワーバトル」の公開作業で，何をどこまで確認したかを区別して記録するものである．状態は「実装済み」「本番に公開済み」「公開先で動作確認済み」「X上の実表示確認済み」の4段階で書き，確認していない項目を完了扱いにしない．認証情報は記載しない．

## 2026-10-21 時点の状態

| 項目 | 状態 |
|---|---|
| ゲームURL | 未公開（候補は `https://sasa618.github.io/kanji-tower-battle-web/`．リポジトリ `kanji-tower-battle-web` は未作成） |
| Worker URL | 未配布（Cloudflareのログイン期限切れのため．`npx wrangler login` 後に `npm run deploy:worker` で配布する） |
| D1 | 未作成（`wrangler.jsonc` の `database_id` はゼロ埋めの仮値） |
| 共有ページ・画像のサンプルURL | 本番では未発行．ローカルの wrangler dev では発行と配信を確認した |
| X上のカード実表示 | 未検証（公開URLが無いため） |
| iPhone Safari・Android Chrome の実機 | 未検証 |

検証環境は Windows 11，Node.js 22.23.1，npm 10.9.8，wrangler 4.151.1，Vite 7.3.7，Planck.js 1.4.2 である．

## 実装済みで，ローカルで確認した項目

`web/` で次を実行し，いずれも成功した．

```sh
npm ci
npm test            # 72件成功
npm run build       # 公開URLの有無で OGP の絶対URLタグが切り替わることを確認
npx wrangler deploy --dry-run --outdir dist-worker          # 本番環境
npx wrangler deploy --dry-run --outdir dist-worker --env dev # 開発環境
```

ローカルのD1（`wrangler d1 migrations apply kanji-tower-ranking --env dev --local`）に移行ファイル2本を適用し，`wrangler dev --env dev --local --port 8787` を起動して `node tools/check-release.mjs --api http://127.0.0.1:8787 --origin http://127.0.0.1:5173 --share` を実行したところ，14件すべて成功した．確認内容は次のとおりである．

- `/health` が共有画像の件数・容量・上限・受付可否を返す．
- 許可オリジンへのCORSプリフライト，3種目のランキング取得で公開項目（名前・総画数・高さ・字数・日時）だけが返ること．
- 不許可オリジンからの取得・セッション作成が403，Origin無しのPOSTが405，無効な共有IDが404になること．
- `POST /shares` が共有URLを発行し，ページの生HTMLに `twitter:card=summary_large_image`，記録別の題名・説明，絶対URLの画像，`og:url`，遊ぶリンクが含まれること．
- `/s/:id/image.png` が `image/png` と長期キャッシュのヘッダーで送信した画像と同じ内容を返し，HEADも200になること．
- 同じ端末・同じ記録の再送が同じURLを返すこと．トリガーによる容量集計が実際のD1で増えること．

この通し実行で，実際のD1はBLOB列を数値の配列で返すため画像応答が壊れる不具合を見つけ，修正した（`server/shares.ts`）．テストのモックも同じ返し方に合わせた．

自動テストで確認した公開関連の項目は次のとおりである．

- 送信直後に返す順位が，表示と同じ90日間の範囲と同順位の扱い（総画数→高さ→字数→先着）で3種目とも計算されること．
- 1分間に6件の送信制限がINSERT文の中で判定され，7件目が429になること．セッションの重複送信が409になること．
- 画像付き共有の直近24時間の上限（1端末10件・全体200件）と，累積容量の上限（`SHARE_STORAGE_LIMIT_BYTES`）で新規保存が止まり（507），既存の共有ページ・画像の配信と同じ記録の再利用は続くこと．削除で集計が減ること．
- PNGの署名・IHDR・1200×630・IENDの検査と，大きすぎる本文の413．
- 投稿本文がURL分を含めてXの上限に収まるよう，作った字の列挙を省略すること．
- 公開URLが未設定のビルドには候補URLやローカルURLのOGPタグが残らないこと．

## 残件と，必要な操作

1. **Cloudflareへのログイン（本人の操作）**．対話できるターミナルで `npx wrangler login` を実行する．その後 `npm run deploy:worker -- --game-url <ゲームURL>` でD1の作成・移行・Workerの配布まで進む．
2. **公開先の確定（本人の判断）**．既存案は公開リポジトリ `sasa618/kanji-tower-battle-web` に `web/` の内容をルートとして置き，GitHub Pages（GitHub Actions）で配信する．リポジトリ名・公開範囲が決まり次第，`git init` 済みの `web/` を push し，Pagesの Source を GitHub Actions にして，変数 `RANKING_API` に Worker URL を設定する．
3. 公開後に `npm run check:release -- --api <Worker URL> --game <ゲームURL> --share` を実行し，結果を本書に追記する．`--share` は本番DBに試験用の共有を1件残す．
4. Xの投稿画面で本文・URLを確認し，カードの実表示とクリック先を確認する（公開投稿の確定は本人が行う）．
5. iPhone Safari・Android Chrome で操作・画像保存・X投稿画面への遷移を確認する．
6. 図鑑の読み・意味・熟語・画数の辞書照合（公開関連の作業とは別に残っている）．
