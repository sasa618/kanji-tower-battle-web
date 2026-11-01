# アクセス数の計測と確認

2026-11-01時点では，公開サイトにCloudflare Web Analyticsの計測用tokenが未設定です．アクセス数はまだ計測していません．計測開始前のアクセス数はこの仕組みでは遡って取得できません．ランキングの投稿数やプレイ回数はアクセス数の代わりにはなりません．

## 2026-11-02の設定状況

公開用tokenをGitHubの `CF_BEACON_TOKEN` に保存し，最新のmainで再公開しました．公開HTMLに正しいtokenの計測タグが1つだけあること，配信用スクリプトが200で取得できること，確認用ブラウザーに計測関連のエラーがないことを確認しました．Cloudflare管理画面での実データ受信は未確認です．以後の再公開にも同じ設定が引き継がれます．

## 初回・再設定時の操作

1. [Cloudflare管理画面](https://dash.cloudflare.com/)にログインし，ランキング用Workerを作ったアカウントを選びます．
2. **Web Analytics** を開き，**Add a site（サイトを追加）** を選びます．既に `sasa618.github.io` を登録済みなら，そのサイトの **Manage site** を開きます．
3. ホスト名に **`sasa618.github.io`** を入力して確定します．`https://` や `/kanji-tower-battle-web/` はホスト名の欄には入れません．GitHub Pagesを使っているため，CloudflareのDNSへの移転やCloudflare Pagesの新規作成は不要です．
4. **Manage site** に表示されるJavaScriptスニペットの，`"token": "…"` の値（32桁の16進数）だけをコピーします．これはHTMLに載せる公開用の計測IDです．CloudflareのAPIトークンやパスワードとは別物です．
5. その公開用tokenをこのチャットで渡してください．こちらでGitHubへの設定保存・ゲームの再公開・公開HTMLへの反映確認を行えます．HTMLを手で編集する必要はありません．

登録の公式手順：[Sites not proxied through Cloudflare](https://developers.cloudflare.com/web-analytics/get-started/)．

## 自分でGitHubの設定も行う場合

1. [公開リポジトリのActions変数](https://github.com/sasa618/kanji-tower-battle-web/settings/variables/actions)を開きます．
2. **New repository variable** を選び，Nameを **`CF_BEACON_TOKEN`**，Valueを取得した公開用tokenにして保存します．「Secrets」ではなく「Variables」です．
3. [Deploy to GitHub Pages](https://github.com/sasa618/kanji-tower-battle-web/actions/workflows/deploy-pages.yml) を開き，**Run workflow** → **main** → **Run workflow** で再公開します．変数の保存だけでは公開済みHTMLは変わりません．
4. 実行が緑色で完了したら，ゲームを一度開いてから別タブへ切り替えます．数分後，Cloudflareの **Web Analytics** で登録したサイトの集計を確認します．

GitHub CLIにログイン済みの開発環境なら，`web/` で次のコマンドでも設定保存と再公開を開始できます．

```sh
npm run setup:analytics -- --token <取得した公開用token32桁>
```

## 何を見るか

| 指標 | 意味 |
|---|---|
| Page views | ページの閲覧回数．再読み込みも含み，ゲーム内の「もう一度遊ぶ」の回数ではありません |
| Visits | 外部サイトや直接のリンクから入った訪問．同一人物の厳密な人数ではありません |
| プレイ回数 | ゲームが終了し，サーバーへ終了報告が届いた回数．`GET /stats` で別に集計します |
| ランキング記録数 | 利用者が名前を入力して送信した記録の件数 |

Cloudflareの画面では期間を選び，必要ならPathで `/kanji-tower-battle-web/` のページに絞ります．同じホスト名の別ゲームにも将来同じ計測IDを使う場合は，パスでの絞り込みが必要です．

アクセス計測はCloudflare Web Analyticsが直接受信し，ランキングのWorkerやD1へはアクセス数を書き込みません．そのためランキング用D1の日次上限を消費しません．cookieや端末内のランキング識別子はこの計測に使いません．広告ブロッカー等で計測されない閲覧があり，全アクセス数や厳密な利用者数を保証するものではありません．

指標の定義：[High-level metrics](https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/)．計測されないケース：[Cloudflare FAQ](https://developers.cloudflare.com/web-analytics/faq/)．

## 公開の確認とトラブル時

```sh
npm run check:analytics
```

公開HTMLを読んで，計測タグが1個だけあることとtokenの形式を確認します．このコマンド自体は計測スクリプトを実行せず，テスト用のアクセス数を増やしません．タグがない場合は失敗として終了します．タグが存在することはCloudflareでデータ受信できた証明ではないので，最終確認はWeb Analytics画面で行ってください．

公開処理にも同じ検査を追加しています．未設定なら実行結果のSummaryに未設定と表示し，設定済みのtokenがHTMLに入っていない・形式が違う・タグが重複している場合は公開を止めます．

数字が出ない場合は，公開処理の完了，ホスト名の一致，期間の指定，広告ブロッカーの影響を確認します．ページを開いてからタブを切り替えると送信される計測もあります．
