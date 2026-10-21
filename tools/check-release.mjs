#!/usr/bin/env node
// 公開後の疎通確認．
//   node tools/check-release.mjs --api https://<worker>.workers.dev [--game https://.../] [--share]
// 読み取り系（/health，3種目の /scores，CORS，不許可オリジン，無効な共有ID）は常に確認する．
// --share を付けると試験用の共有を 1 件作成し，ページの生HTML・画像・HEAD・再利用を確認する（本番 DB に 1 行残る）．
// --game を付けるとゲームの配信（HTML・JS・フォント・カード画像・ローカルURLの混入）も確認する．
import zlib from 'node:zlib';
const args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const api=option('--api')?.replace(/\/$/,''),game=option('--game'),withShare=args.includes('--share');
if(!api){console.error('--api <Worker URL> を指定してください．');process.exit(1);}
// --origin は要求に付ける Origin（省略時はゲーム URL のオリジン．ローカルの wrangler dev では http://127.0.0.1:5173 など）
const gameOrigin=option('--origin')||(game?new URL(game).origin:'https://sasa618.github.io');
const results=[];
async function check(label,fn){try{const detail=await fn();results.push({label,ok:true,detail:detail||''});console.log(`OK   ${label}${detail?` — ${detail}`:''}`);}catch(e){results.push({label,ok:false,detail:e.message});console.log(`NG   ${label} — ${e.message}`);}}
const expect=(cond,message)=>{if(!cond)throw Error(message);};
const get=(url,init={})=>fetch(url,{redirect:'manual',...init});
// 1200×630 のグレースケール PNG（約1KB）を作る
function makePNG(width=1200,height=630,shade=200){
  const table=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
  const crc=buf=>{let c=0xffffffff;for(const b of buf)c=table[(c^b)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;};
  const chunk=(type,data)=>{const t=Buffer.from(type,'latin1'),len=Buffer.alloc(4);len.writeUInt32BE(data.length);const c=Buffer.alloc(4);c.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([len,t,data,c]);};
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=0;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
  const raw=Buffer.alloc((width+1)*height,shade);for(let y=0;y<height;y++)raw[y*(width+1)]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
await check('GET /health が ok を返す',async()=>{const r=await get(`${api}/health`);expect(r.status===200,`status ${r.status}`);const j=await r.json();expect(j.ok===true,'ok ではない');return j.shares?`共有 ${j.shares.count}件 / ${(j.shares.bytes/1e6).toFixed(1)}MB / 上限 ${(j.shares.limit/1e6).toFixed(0)}MB / 受付 ${j.shares.accepting}`:'';});
await check('OPTIONS /scores が公開オリジンに CORS を返す',async()=>{const r=await get(`${api}/scores`,{method:'OPTIONS',headers:{Origin:gameOrigin,'Access-Control-Request-Method':'GET'}});expect(r.status===204,`status ${r.status}`);expect(r.headers.get('access-control-allow-origin')===gameOrigin,`ACAO ${r.headers.get('access-control-allow-origin')}`);});
for(const metric of ['score','height','count'])await check(`GET /scores?metric=${metric} が公開項目だけを返す`,async()=>{const r=await get(`${api}/scores?metric=${metric}`,{headers:{Origin:gameOrigin}});expect(r.status===200,`status ${r.status}`);const {scores}=await r.json();expect(Array.isArray(scores),'scores が配列ではない');for(const s of scores)expect(Object.keys(s).sort().join()==='count,created,height,name,score',`余分な項目 ${Object.keys(s)}`);return `${scores.length}件`;});
await check('不許可オリジンからの要求は 403',async()=>{const r=await get(`${api}/scores`,{headers:{Origin:'https://evil.invalid'}});expect(r.status===403,`status ${r.status}`);});
await check('不許可オリジンからのセッション作成は 403',async()=>{const r=await get(`${api}/sessions`,{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json'},body:JSON.stringify({client:crypto.randomUUID()})});expect(r.status===403,`status ${r.status}`);});
await check('無効な共有IDは 404',async()=>{const r=await get(`${api}/s/${crypto.randomUUID()}`);expect(r.status===404,`status ${r.status}`);});
await check('Origin 無しの POST は 405',async()=>{const r=await get(`${api}/scores`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});expect(r.status===405,`status ${r.status}`);});
if(withShare){
  const png=makePNG(),payload={client:crypto.randomUUID(),record:crypto.randomUUID(),score:62,height:3.8,count:7,image:png.toString('base64')};
  let url='';
  await check('POST /shares が共有URLを発行する',async()=>{const r=await get(`${api}/shares`,{method:'POST',headers:{Origin:gameOrigin,'Content-Type':'application/json'},body:JSON.stringify(payload)});const j=await r.json();expect(r.status===201,`status ${r.status} ${j.error||''}`);url=j.url;expect(url.startsWith(api+'/s/'),`url ${url}`);return url;});
  if(url){
    await check('共有ページの生HTMLに記録別のカード情報がある',async()=>{const r=await get(url);expect(r.status===200,`status ${r.status}`);expect((r.headers.get('content-type')||'').startsWith('text/html'),`content-type ${r.headers.get('content-type')}`);const html=await r.text();for(const needle of ['twitter:card" content="summary_large_image"',`content="${url}/image.png"`,'62画','高さ3.8字分・7文字',`og:url" content="${url}"`])expect(html.includes(needle),`${needle} が無い`);if(game)expect(html.includes(`href="${new URL(game).href}"`),'遊ぶリンクがゲームURLではない');expect(!/localhost|127\.0\.0\.1|192\.168\./.test(html.replaceAll(api,'')),'API 以外のローカルURLが含まれる');});
    await check('共有画像が認証なしで PNG を返す',async()=>{const r=await get(`${url}/image.png`);expect(r.status===200,`status ${r.status}`);expect(r.headers.get('content-type')==='image/png',`content-type ${r.headers.get('content-type')}`);const body=Buffer.from(await r.arrayBuffer());expect(body.equals(png),'画像の内容が一致しない');return `${body.length} bytes, cache-control: ${r.headers.get('cache-control')}`;});
    await check('共有画像の HEAD が 200',async()=>{const r=await get(`${url}/image.png`,{method:'HEAD'});expect(r.status===200,`status ${r.status}`);});
    await check('同じ記録の再送は同じURLを返す',async()=>{const r=await get(`${api}/shares`,{method:'POST',headers:{Origin:gameOrigin,'Content-Type':'application/json'},body:JSON.stringify(payload)});const j=await r.json();expect(r.status===200&&j.url===url,`status ${r.status} url ${j.url}`);});
  }
}
if(game){
  const base=new URL(game).href;
  let html='';
  await check('ゲームの公開URLが HTML を返す',async()=>{const r=await get(base);expect(r.status===200,`status ${r.status}`);html=await r.text();expect(html.includes('<title>合体！漢字タワーバトル</title>'),'タイトルが無い');expect(!/localhost|127\.0\.0\.1|192\.168\./.test(html),'ローカルURLが含まれる');});
  if(html){
    await check('固定カードの og:url と画像が公開URLを指す',async()=>{expect(html.includes(`property="og:url" content="${base}"`),'og:url が公開URLではない');expect(html.includes(`content="${base}social-card.png"`),'カード画像が公開URLではない');const r=await get(`${base}social-card.png`);expect(r.status===200&&r.headers.get('content-type')==='image/png',`social-card ${r.status}`);});
    await check('JS・CSS・フォントがサブパスから読める',async()=>{const assets=[...html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g)].map(m=>m[1]);expect(assets.length>=2,`assets ${assets.length}`);for(const path of [...assets,'fonts/KanjiTowerSerif.woff2','fonts/KanjiTowerDisplay.woff2','icon.svg']){const r=await get(base+path);expect(r.status===200,`${path} ${r.status}`);}return `${assets.length+3} files`;});
    await check('ビルドに Worker の URL が入っている',async()=>{const js=[...html.matchAll(/src="\.\/(assets\/index-[^"]+\.js)"/g)].map(m=>m[1]);expect(js.length===1,`index js ${js.length}`);const code=await (await get(base+js[0])).text();expect(code.includes(api),`${api} が無い（VITE_RANKING_API 未設定のビルド）`);});
  }
}
const failed=results.filter(r=>!r.ok);
console.log(`\n${results.length-failed.length}/${results.length} 件成功`);
process.exit(failed.length?1:0);
