import {readFileSync,appendFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {normalizeBeaconToken} from './public-meta';

export function inspectAnalytics(html:string,expectedToken?:string){
  const scripts=[...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(m=>m[0]);
  const beacons=scripts.filter(tag=>/\bsrc=["']https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js(?:\?[^"']*)?["']/i.test(tag));
  if(!beacons.length){if(expectedToken)throw Error('設定済みの計測用tokenがHTMLに反映されていません。再公開が必要です。');return {enabled:false};}
  if(beacons.length!==1)throw Error('計測タグが重複しています。二重計測を防ぐため1つにしてください。');
  const raw=/\bdata-cf-beacon=(['"])([\s\S]*?)\1/i.exec(beacons[0])?.[2];
  if(!raw)throw Error('計測タグにdata-cf-beaconがありません。');
  const config=JSON.parse(raw.replaceAll('&quot;','"').replaceAll('&#34;','"'));
  const token=normalizeBeaconToken(config.token);
  if(!token)throw Error('計測タグにtokenがありません。');
  if(expectedToken&&token!==normalizeBeaconToken(expectedToken))throw Error('公開HTMLのtokenが設定値と異なります。');
  return {enabled:true};
}

async function main(){
  const args=process.argv.slice(2),option=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
  if(args.includes('--help')){console.log('設定と再公開: npm run setup:analytics -- --token <公開用token32桁>\n公開先の確認: npm run check:analytics\nビルドの確認: npm run check:analytics -- --file dist/index.html --optional');return;}
  if(args.includes('--setup')){
    const token=normalizeBeaconToken(option('--token'));
    if(!token)throw Error('--tokenにCloudflare Web Analyticsの公開用tokenを指定してください。APIキーは使用しません。');
    const repo=option('--repo')||'sasa618/kanji-tower-battle-web';
    for(const command of [
      ['variable','set','CF_BEACON_TOKEN','--repo',repo,'--body',token],
      ['workflow','run','deploy-pages.yml','--repo',repo,'--ref','main']
    ]){
      const result=spawnSync('gh',command,{encoding:'utf8',shell:false});
      if(result.error)throw Error('GitHub CLIを起動できません。GitHubの画面から設定する手順はdocs/access-analytics.mdを参照してください。');
      if(result.status!==0)throw Error(result.stderr||'GitHubでの設定または再公開の開始に失敗しました。');
    }
    console.log(`計測用IDを保存し，再公開を開始しました。https://github.com/${repo}/actions\n公開完了後に npm run check:analytics でタグの配信を確認できます。`);
    return;
  }
  const file=option('--file'),game=option('--game')||'https://sasa618.github.io/kanji-tower-battle-web/';
  let html:string;
  if(file)html=readFileSync(file,'utf8');
  else{const response=await fetch(game,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`公開サイトを確認できませんでした（${response.status}）。`);html=await response.text();}
  const result=inspectAnalytics(html,normalizeBeaconToken(process.env.VITE_CF_BEACON_TOKEN));
  const message=result.enabled?'アクセス計測タグ：配信を確認しました。実データの受信はCloudflare Web Analyticsで確認してください。':'アクセス計測：未設定です。まだアクセス数を収集していません。設定手順：docs/access-analytics.md';
  console.log(message);
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`\n${message}\n`);
  if(!result.enabled&&!args.includes('--optional'))process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error((error as Error).message);process.exitCode=1;});
