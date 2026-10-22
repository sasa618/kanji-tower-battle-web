# 合体！漢字タワーバトル

漢字を積み，合体させて総画数・高さ・字数を伸ばす，スマホ向けの物理パズルである．ゲーム本体と図鑑の漢字画像付き共有は静的ファイルで動き，全国ランキング・結果画像付きのX共有・匿名の利用状況がCloudflare Workers + D1のサーバーを使う．

遊べるURL：<https://sasa618.github.io/kanji-tower-battle-web/>（GitHub Pages，2026-10-21 公開）
Worker URL：`https://kanji-tower-battle-ranking.kanji-tower-battle-web.workers.dev`（Cloudflare Workers + D1，2026-10-21 配布）

公開作業の実施状況と確認できた項目は[docs/release-record.md](docs/release-record.md)，制作の経過は[docs/progress.md](docs/progress.md)にある．

## 遊び方

ページを開くとそのまま遊べる．下の3文字から選び，盤面で指を左右に動かして離すと落下する．向きは盤面右上の「回転」で変える．合体できる字は金色に光り，触れると新しい字になる．台から字が落ちると終了する．基本20字，全58字，40の合体がある．

候補のうち塔と合体できる字は，0個・1個・2個を25％・50％・25％の割合で抽選する．塔の相手や非対応の字が不足する場合は可能な数に調整する．それぞれの候補群では出現回数の少ない字を優先し，同数なら直前と違う字を選ぶ．並び順もランダムにする．

PCでもドラッグして離すと落下する．←→で移動，↑で回転，↓で落下，1〜3で選択，Spaceで一時停止，Rで再開，Bで図鑑，Lでランキングを開く．

図鑑は漢字の一覧だけがスクロールし，選んだ字の説明は固定される．合体で作った字はXへ共有できる．結果画面では画像を保存できる．保存画像には，最高到達時の塔を位置・角度・色を保って収める．自己ベストにも塔を保存するので，後から画像付きで共有できる．以前の記録には塔の画像がないため，新しいプレイから対応する．

## 実行

Node.js 22.18以降を使う．このwebフォルダーで以下を実行する．

```sh
npm ci
npm run dev
```

同じWi-Fiのスマホで試す場合は，次を実行し，表示されるNetworkのURLをスマホで開く．PCとサーバーを起動しておく必要があり，これはインターネット向け公開ではない．

```sh
npm run dev:lan
```

ランキングと共有のサーバーも手元で動かす場合は，ローカルのD1に移行ファイルを適用してからWorkerを起動し，`.env.development.local` に `VITE_RANKING_API=http://127.0.0.1:8787` を書いて `npm run dev` を実行する．開発用のオリジン（localhost・127.0.0.1の5173・5174番）は `wrangler.jsonc` の `env.dev` にだけあり，本番の設定には含めない．

```sh
npx wrangler d1 migrations apply kanji-tower-ranking --env dev --local
npm run dev:api
```

検証と公開用ファイルの作成は次のとおりである．

```sh
npm test
npm run build
npx wrangler deploy --dry-run --outdir dist-worker
```

本体の出力はdistに生成される．GitHub Pagesのサブディレクトリーで配信できるよう，相対パスでビルドする．`VITE_RANKING_API` と `VITE_PUBLIC_URL` はビルド時に埋め込まれる公開値であり，`.env.example` に説明がある．秘密情報を `VITE_*` に入れてはならない．`VITE_PUBLIC_URL` が未設定のビルドには，OGPの絶対URL（`og:url`・`og:image`・`twitter:image`）を出力せず，投稿にもURLを含めない．

## 公開構成

| 部分 | 置き場所 | 内容 |
|---|---|---|
| ゲーム本体 | GitHub Pages（GitHub Actionsで配信） | `dist/` の静的ファイル．PCを止めても配信される |
| ランキング・共有API | Cloudflare Workers（`*.workers.dev`） | `server/worker.ts`．`/sessions`，`/scores`，`/shares`，`/s/:id`，`/s/:id/image.png`，`/health` |
| 記録と共有画像 | Cloudflare D1（`kanji-tower-ranking`） | `server/migrations/` のテーブル・索引・トリガー |
| 公開手順 | `.github/workflows/deploy-pages.yml` | `web/` の内容をルートに置いた公開リポジトリで動く |

公開リポジトリは `web/` の内容をルートにする構成を基本とする．`.github/workflows/` は `web/` の中にあるため，親リポジトリの `KanjiBlocks/web/` 配下にあるあいだはGitHubに認識されない．

## 公開と更新の手順

### 1．Cloudflare（Worker・D1）

ログインは本人の操作が必要である．対話できるターミナルで `npx wrangler login` を実行してから，次を実行する．

```sh
npm run deploy:worker -- --game-url https://<公開するゲームのURL>/
```

`tools/deploy-worker.mjs` は，D1 `kanji-tower-ranking` が無ければ作成し（既存なら再利用し，削除・再作成はしない），`wrangler.jsonc` の `database_id` を実際の値に書き換え，`GAME_URL` と本番の `ALLOWED_ORIGINS`（オリジンだけで，リポジトリのパスは含めない）を揃え，未適用の移行だけを `wrangler d1 migrations apply --remote` で適用し，Workerを配布してURLを表示する．`--dry-run` を付けると配布だけを省く．

### 2．GitHub Pages（ゲーム本体）

公開リポジトリは [sasa618/kanji-tower-battle-web](https://github.com/sasa618/kanji-tower-battle-web) で，`web/` の内容がルートにある．初回に行った設定は次のとおりである．

1. 公開リポジトリを作り，`web/` を push した．
2. Pages の Source を「GitHub Actions」にした（`gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`）．
3. Settings → Secrets and variables → Actions → Variables に `RANKING_API`（Worker URL，末尾のスラッシュなし）と `PUBLIC_URL`（ゲームURL）を設定した．`PUBLIC_URL` を省略するとPagesのURLが使われる．
4. mainへのpushでビルド・テスト・配信が実行される．`VITE_PUBLIC_URL` と `index.html` のOGPも同じ公開URLに揃う．

### 3．公開後の確認

```sh
npm run check:release -- --api https://<Worker URL> --game https://<ゲームURL>/ --share
```

`tools/check-release.mjs` は，`/health`，CORS，3種目のランキング取得，不許可オリジンの403，無効な共有IDの404，ゲームのHTML・JS・フォント・カード画像の配信，ビルドにWorker URLが入っていることを確認する．`--share` を付けると試験用の共有を1件作り，共有ページの生HTML・画像・HEAD・再利用を確認する（本番DBに1行残る）．X上のカード表示はこの検査とは別で，実際のXで確認して記録する．

### 4．更新

- ゲーム本体はmainにpushすると再公開される．
- Workerの変更は `npm run deploy:worker` を再実行する．
- DBの変更は `server/migrations/` に番号を続けたファイルを追加し，同じコマンドで未適用分だけが適用される．既存の表・データは残る．
- 本番の値を変える場合は `wrangler.jsonc` の `vars` を直して配布する．

## 全国ランキング

総画数・高さ・字数でそれぞれ上位100件を表示し，同じ画面に各種目の自己ベストを表示する．図鑑，自己ベスト，音の設定はブラウザーのlocalStorageに保存する．別の端末・ブラウザーとは共有されず，ブラウザーのデータを消すと失われる．ローカル版と公開版は保存先のオリジンが異なるため，記録は自動では移らない．

オンライン送信は結果画面で利用者が選んだ場合のみである．ランキングに公開する項目は名前・総画数・高さ・字数・日時で，対象は最近90日間である．並び順は種目の値，次に他の2つの値，最後に先着の順で，送信直後に返す3種目の順位も同じ条件で数える．サーバーにはプレイ時間，セッションID，ランダムな端末識別子のハッシュも保存し，連続送信や明らかな不正値の確認に用いる．これらは公開応答に含めない．古いスコアとセッションは後続の送信・セッション作成時に削除するため，保存期間を過ぎた直後に物理削除されるとは限らない．本名や連絡先は入力しないこと．

セッションは最初の落下時に1回作成し，1端末あたり1日100回・3秒に1回までとする．記録の送信はセッションごとに1回，1端末あたり1分に6件までで，これらの制限はINSERT文の条件として判定し，同時要求でもすり抜けない．名前は1〜12文字に正規化し，HTMLとしては解釈しない．ブラウザーだけで動くゲームであるため，改ざんや不正を完全には防げない．秘密の鍵をクライアントに含めない．

選んだ種目のみ取得し，各種目で5分間キャッシュする．定期取得は行わない．通信できなくてもゲームと自己記録は使える．サーバー側の種目別キャッシュ（Cache API）は `*.workers.dev` では無効なため，その場合は毎回D1から読む．

## 結果画像付きのX共有

図鑑の「Xでシェア」は，完成した漢字を大きく描いた専用画像を使う．合体で作れる40字それぞれに `discovered/<文字コード>/` の静的ページと `kanji-cards/<文字コード>.png` の1200×630画像を用意する．画像には画数と合体の組み合わせも載せる．カードを開くと公開ゲームの先頭へ移動し，新しいゲームを開始する．共有時の画像アップロードやD1への保存・読み込みは不要である．

PNGは `tools/build-discovery-cards.ts` で生成し，`public/kanji-cards/` に追跡する．再生成には `assets/fonts/README.md` の元フォントと `@napi-rs/canvas` が必要で，`KANJI_CANVAS_MODULE` でそのローカルモジュールのパスを指定して `node --import tsx tools/build-discovery-cards.ts` を実行する．HTMLは `VITE_PUBLIC_URL` が設定されたビルドでViteが生成する．CIでは全共有対象のPNG・寸法・専用リンク・公開メタ情報を検査する．

背景の漢字模様は，同じ `KANJI_CANVAS_MODULE` を指定して `node tools/build-backgrounds.mjs` で再生成する．ゲームの輪郭データと淡い赤・紫・青緑の塗りから，`public/*-background.svg` とPC・スマホ幅の背景単体プレビューを出力する．公開サイトでは静的SVGだけを読み込み，描画用の追加ライブラリや通信は使わない．

結果画面・ランキングの自己ベストから「Xでシェア」を押すと，最高到達時の塔と得点を1200×630のPNGにする．WorkerのPOST /sharesで画像と記録を保存し，/s/共有ID の専用リンクを作る．このページは最初のHTMLにXカード・OGPメタ情報を含み，画像URLは /s/共有ID/image.png で返す．リンクを開いた利用者はGAME_URLへ移動して新しいゲームを開始し，JavaScriptが無効でも「遊ぶ」リンクを使える．投稿本文はURL分を含めてXの文字数に収まるよう，作った字の列挙を必要に応じて省略する．Xの投稿確定は利用者が行う．

画像の自動アップロードや定期取得は行わない（自動で送るのはゲーム終了時の匿名の利用状況1回だけである）．同じ端末・同じ記録は専用リンクを再利用し，別のサーバーが発行したリンクは再利用しない．画像はPNGのBase64で260,000文字以下（復号後は最大約195KB），サーバーで署名・IHDR・寸法・IENDを検査する．新規作成は直近24時間で1端末10件・全体200件までである．画像と記録の公開はリンクを持つ人が対象で，リンクを保つため自動削除はしない．画像の配信は長期キャッシュのヘッダーを付け，既存のカード画像を別の記録で上書きしない．ランキング送信とは別で，名前は共有リンクに含めない．

## 無料枠と容量

有料プラン・従量課金への切替は行わない．2026年10月21日時点の公式資料では，D1 Freeはアカウント合計5GBに対し1データベース500MBである（[Cloudflare D1の制限](https://developers.cloudflare.com/d1/platform/limits/)）．読み書き回数の日次上限とWorkersの無料枠（[Workersの制限](https://developers.cloudflare.com/workers/platform/limits/)），[GitHub Pagesの制限](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)は公開時に再確認すること．無料枠を超えた場合はランキングと共有だけが止まり，ゲームと端末内の記録は使える．

共有画像は削除しないため累積する．累積容量は `meta` 表の `shares_bytes` にトリガーで集計し，全件走査はしない．新規保存は `SHARE_STORAGE_LIMIT_BYTES`（既定350,000,000バイト）を超えない範囲でだけ受け付け，超える要求には507と日本語の案内を返し，既存の共有ページ・画像の配信は続く．見積もりは次のとおりである．

| 平均画像サイズ | 350MBに達する件数 |
|---|---|
| 50KB | 約7,000件 |
| 100KB | 約3,500件 |
| 195KB（上限） | 約1,790件 |

全体で1日200件の上限いっぱいの利用が続けば数週間で到達し得るため，`GET /health` の `shares.count`・`shares.bytes`・`shares.accepting` を定期的に確認する．データベース全体の大きさは `npx wrangler d1 info kanji-tower-ranking` で確認できる．上限に近づいた場合の管理者の対応は，D1の実サイズに余裕があれば `SHARE_STORAGE_LIMIT_BYTES` を引き上げる（500MBを超えない安全な値にとどめる），または別のストレージへ移す設計変更を検討することであり，課金を伴うストレージへ自動では移行しない．

## 利用状況の集計

- **アクセス回数**：Cloudflare Web Analytics を使う．cookieを使わず，GitHub Pagesでも動く．ダッシュボードでサイト（ホスト名 `sasa618.github.io`）を追加して得たスニペットの token を `VITE_CF_BEACON_TOKEN`（Actionsの変数は `CF_BEACON_TOKEN`）に設定すると，ビルド時に計測スクリプトが `index.html` に入る．未設定なら入らない．
- **検索での表示回数・クリック数**：Google Search Console にURLプレフィックス プロパティとして公開ゲームURLを登録する．HTMLタグ方式の所有確認コードを `VITE_GOOGLE_SITE_VERIFICATION`（変数は `GOOGLE_SITE_VERIFICATION`）に設定すると，確認用のメタタグが入る．
- **プレイ回数と遊んだ時間**：ゲーム終了時に，セッションID・プレイ秒数・落下数だけを `POST /events` に1回送る．名前・得点・端末識別子は送らない．サーバーは1セッションにつき1回だけ，日本時間の日付ごとに終了したプレイ数・合計秒数・落下数を `daily_stats` に足し込む．`GET /stats` が最近30日の日別値と累計を返す．ランキングに接続していないビルドや，セッション作成に失敗したプレイは数えない．

## 保存する情報

- 利用状況：日付ごとの件数と秒数の合計だけを保存し，個々のプレイや端末と結び付けない．
- ランキング：名前・総画数・高さ・字数・日時を90日間公開する．サーバー内部にプレイ時間・セッションID・端末識別子のハッシュを持ち，公開しない．
- 共有：画像と総画数・高さ・字数・作成日時を保存し，リンクを知る人が閲覧できる．名前は含めない．
- 端末内：図鑑・自己ベスト（塔の位置・角度を含む）・音の設定・ランダムな端末識別子をlocalStorageに保存する．
- 生のIPアドレスや連絡先をゲームのデータベースに保存しない．CloudflareやGitHubが自社のログとして記録する情報は，各社の規約（[Cloudflare利用規約](https://www.cloudflare.com/terms/)，[GitHub利用規約](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)）に従う．Xへの投稿は利用者自身が投稿画面で確定し，このゲームが自動投稿することはない（[X開発者向け資料](https://docs.x.com/overview)）．

## 障害時の対応

- 通信できない，タイムアウト，429（回数の上限），503（一時的に利用不可），507（容量の上限）のいずれでも，ゲーム・図鑑・自己ベスト・結果画像の保存は使える．画面には日本語の案内と再試行または画像保存の手段を示し，成功したようには見せない．
- サーバーの状態は `GET /health` と `npx wrangler tail` で確認する．GitHub Pagesの配信はリポジトリのActionsの実行結果で確認する．
- 再公開はmainへのpushと `npm run deploy:worker` で行い，本番のデータは消えない．D1を作り直す手順は用意しない．

## 字形・ライセンス

- ゲームの漢字：Noto Serif JP Bold，SIL Open Font License 1.1．
- 目立たせるUI：Dela Gothic One，SIL Open Font License 1.1．
- タイトルの「合体！」：Mochiy Pop One，SIL Open Font License 1.1．
- 物理演算：Planck.js，MIT（配布物の `licenses/planck-MIT.txt`）．
- フォント解析：opentype.js，MIT（ビルド時のみ）．
- 輪郭の分割：earcut，ISC（ビルド時のみ）．
- 輪郭の結合：polygon-clipping，MIT（ビルド時のみ）．

フォントのライセンスはpublic/fonts，配布元と生成方法はassets/fonts/README.mdにある．フォントの曲線を描画し，物理判定には複数の凸形状を使う．囲まれた穴は見た目には残し，当たり判定では埋めている．

## 制作

ゲームのコードはAI（ChatGPT）が書いた．合体の表と図鑑の説明は，Windows版の漢字タワーバトルでAI（Claude）が作ったデータを元にしている．合体の式はゲーム上のルールであり，字源の説明ではない．2026年10月21日の公開準備（送信直後の順位を表示と同じ90日・同順位の条件で3種目に揃える修正，共有画像の累積容量の上限，D1の移行ファイル，Workerの本番と開発の設定の分離，OGPの公開URL化，投稿本文の長さ調整，GitHub Actionsの公開手順，配布・検証スクリプト，READMEの公開関連の節）はAI（Claude）が担当した．検証状況と公開前の残件はdocs/progress.mdとdocs/release-record.mdに記載している．
