#!/usr/bin/env node
// 公開ビルドのたびに，3 種目の上位 100 件を Worker から取り，public/ranking-snapshot.json に書く（Worker への要求は 3 件）．
// Worker が無料枠の超過などで応答しないときは，公開中の写しをそのまま引き継ぐ．ゲームは通信できないときにこの写しを表示する．
//   RANKING_API=https://<Worker> PUBLIC_URL=https://<ゲームURL>/ node tools/fetch-ranking-snapshot.mjs
import fs from 'node:fs';
const api=(process.env.RANKING_API||'').replace(/\/$/,''),publicURL=process.env.PUBLIC_URL||'',out='public/ranking-snapshot.json';
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`${r.status} ${url}`);return r.json();};
let snapshot=null;
if(api){
  try{
    const scores={};
    for(const metric of ['score','height','count'])scores[metric]=(await get(`${api}/scores?metric=${metric}`)).scores;
    snapshot={at:Date.now(),scores};console.log('ranking snapshot fetched from the Worker');
  }catch(e){console.log('Worker unavailable, keeping the published snapshot:',e.message);}
}
if(!snapshot&&publicURL){
  try{snapshot=await get(new URL('ranking-snapshot.json',publicURL).href);console.log('kept the published snapshot from',new Date(snapshot.at).toISOString());}
  catch(e){console.log('no published snapshot:',e.message);}
}
if(snapshot)fs.writeFileSync(out,JSON.stringify(snapshot));else console.log('no snapshot written; the game shows only lists kept on the device');
