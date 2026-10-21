#!/usr/bin/env node
// Cloudflare 側の構築を，ログイン済みの端末で再現する．
//   node tools/deploy-worker.mjs [--game-url https://.../] [--dry-run]
// 既存の D1 は削除せず，未適用の移行だけを適用する．wrangler.jsonc の database_id と GAME_URL/ALLOWED_ORIGINS を書き換える．
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const gameURL=option('--game-url'),dryRun=args.includes('--dry-run');
const configPath='wrangler.jsonc';
let config=fs.readFileSync(configPath,'utf8');
const name=/"database_name":\s*"([^"]+)"/.exec(config)?.[1];
if(!name){console.error('wrangler.jsonc に database_name がありません．');process.exit(1);}
function run(cmd,{capture=false}={}){
  console.log(`\n> ${cmd}`);
  const r=spawnSync(cmd,{shell:true,encoding:'utf8',stdio:capture?['inherit','pipe','pipe']:'inherit'});
  if(r.status!==0){if(capture)process.stderr.write((r.stdout||'')+(r.stderr||''));console.error(`\n失敗しました（終了コード ${r.status}）．`);process.exit(r.status||1);}
  return r.stdout||'';
}
// 1. ログイン状態（期限切れなら対話できるターミナルで wrangler login が要る）
const who=spawnSync('npx wrangler whoami',{shell:true,encoding:'utf8'});
if(who.status!==0||/not logged in|not authenticated/i.test((who.stdout||'')+(who.stderr||''))){
  console.error('Cloudflare にログインしていません．対話できるターミナルで次を実行してから，もう一度このスクリプトを実行してください．\n\n  npx wrangler login\n');
  process.exit(1);
}
process.stdout.write(who.stdout||'');
// 2. D1（無ければ作る．既存は再利用し，削除・再作成はしない）
const find=()=>JSON.parse(run('npx wrangler d1 list --json',{capture:true})).find(d=>d.name===name);
let db=find();
if(!db){run(`npx wrangler d1 create ${name}`);db=find();if(!db){console.error('D1 の作成結果を確認できません．');process.exit(1);}}
else console.log(`既存の D1 を使う: ${db.name} (${db.uuid})`);
// 3. database_id を本番と env.dev の両方に書く
if(!config.includes(`"database_id": "${db.uuid}"`)){
  config=config.replace(/"database_id":\s*"[0-9a-f-]{36}"/g,`"database_id": "${db.uuid}"`);
  fs.writeFileSync(configPath,config);console.log(`wrangler.jsonc の database_id を ${db.uuid} にした．`);
}
// 4. ゲーム URL（GAME_URL は全環境，ALLOWED_ORIGINS は本番だけ．オリジンにパスは含めない）
if(gameURL){
  const u=new URL(gameURL);
  if(u.protocol!=='https:'){console.error('--game-url は HTTPS の URL にしてください．');process.exit(1);}
  u.search='';u.hash='';if(!u.pathname.endsWith('/'))u.pathname+='/';
  config=config.replace(/("GAME_URL":\s*")[^"]*"/g,`$1${u.href}"`).replace(/("ALLOWED_ORIGINS":\s*")[^"]*"/,`$1${u.origin}"`);
  fs.writeFileSync(configPath,config);console.log(`GAME_URL を ${u.href}，本番の ALLOWED_ORIGINS を ${u.origin} にした．`);
}
// 5. 未適用の移行だけを適用する（対話端末では確認を求められる）
run(`npx wrangler d1 migrations apply ${name} --remote`);
// 6. 配布
if(dryRun){run('npx wrangler deploy --dry-run --outdir dist-worker');console.log('\n--dry-run のため配布はしていない．');process.exit(0);}
const out=run('npx wrangler deploy',{capture:true});process.stdout.write(out);
const url=/https:\/\/[a-z0-9.-]+\.workers\.dev/i.exec(out)?.[0];
console.log('\n完了．次の手順:');
if(url){
  console.log(`- Worker URL: ${url}`);
  console.log(`- 疎通確認: node tools/check-release.mjs --api ${url}${gameURL?` --game ${gameURL}`:''}`);
  console.log(`- GitHub Pages のビルド変数: gh variable set RANKING_API --body "${url}"`);
  console.log(`- ローカルの本番ビルド: .env.production.local に VITE_RANKING_API=${url} を書く`);
}else console.log('- 出力から Worker URL を読み取れなかった．wrangler deploy の表示を確認すること．');
