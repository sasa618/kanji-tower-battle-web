import type {D1Database} from '@cloudflare/workers-types';
export const MAX_SHARE_BYTES=260000;
// D1 Free allows 500MB per database. Leave headroom for ranking rows and page overhead.
export const DEFAULT_SHARE_STORAGE_LIMIT=350_000_000;
export type ShareEnv={DB:D1Database;GAME_URL?:string;SHARE_STORAGE_LIMIT_BYTES?:string};
export type ShareUsage={count:number;bytes:number;limit:number;accepting:boolean};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export const storageLimit=(env:Pick<ShareEnv,'SHARE_STORAGE_LIMIT_BYTES'>)=>{const v=Number(env.SHARE_STORAGE_LIMIT_BYTES);return Number.isFinite(v)&&v>0?v:DEFAULT_SHARE_STORAGE_LIMIT;};
// A plain loop keeps the 195KB decode well inside the free-plan CPU budget.
function decodeBase64(text:string){const binary=atob(text),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
export function validateShare(data:Record<string,unknown>){
  if(!uuid(data.client)||!uuid(data.record)||!Number.isInteger(data.score)||Number(data.score)<0||Number(data.score)>9999||!Number.isFinite(data.height)||Number(data.height)<0||Number(data.height)>200||!Number.isInteger(data.count)||Number(data.count)<0||Number(data.count)>160)throw Error('共有する記録を確認できません。');
  if(typeof data.image!=='string'||data.image.length>MAX_SHARE_BYTES||data.image.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.image))throw Error('画像を確認できません。');
  const png=decodeBase64(data.image);
  const signature=[137,80,78,71,13,10,26,10],trailer=[0,0,0,0,73,69,78,68,174,66,96,130];
  if(png.length<57||signature.some((n,i)=>png[i]!==n)||new TextDecoder().decode(png.slice(12,16))!=='IHDR'||trailer.some((n,i)=>png[png.length-12+i]!==n))throw Error('PNG画像を確認できません。');
  const header=new DataView(png.buffer);if(header.getUint32(16)!==1200||header.getUint32(20)!==630)throw Error('画像の大きさを確認できません。');
  return {client:data.client,record:data.record,score:Number(data.score),height:Number(data.height),count:Number(data.count),png};
}
export async function shareUsage(env:ShareEnv):Promise<ShareUsage>{
  const rows=await env.DB.prepare(`SELECT key,value FROM meta WHERE key IN ('shares_bytes','shares_count')`).all<{key:string;value:number}>();
  const usage=Object.fromEntries(rows.results.map(r=>[r.key,Number(r.value)||0])),limit=storageLimit(env),bytes=usage.shares_bytes||0;
  return {count:usage.shares_count||0,bytes,limit,accepting:bytes+MAX_SHARE_BYTES<=limit};
}
export async function saveShare(data:Record<string,unknown>,env:ShareEnv,origin:string){
  if(!env.GAME_URL) return {status:503,body:{error:'画像付きの共有は公開準備中です。'}};
  let v;try{v=validateShare(data);}catch(e){return {status:400,body:{error:(e as Error).message}};}
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v.client));
  const client=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  const existing=await env.DB.prepare('SELECT id FROM shares WHERE client=? AND record=?').bind(client,v.record).first<{id:string}>();
  if(existing)return {status:200,body:{url:`${origin}/s/${existing.id}`}};
  const id=crypto.randomUUID(),now=Date.now(),day=now-86400000,limit=storageLimit(env);
  // Store only on a deliberate share. One statement keeps the 24-hour and storage limits atomic under parallel requests.
  const result=await env.DB.prepare(`INSERT OR IGNORE INTO shares(id,client,record,score,height,count,image,created)
    SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM shares WHERE client=? AND created>?)<10
    AND (SELECT COUNT(*) FROM shares WHERE created>?)<200
    AND COALESCE((SELECT value FROM meta WHERE key='shares_bytes'),0)+?<=?`).bind(id,client,v.record,v.score,v.height,v.count,v.png.buffer,now,client,day,day,v.png.length,limit).run();
  if(!result.meta.changes){
    const duplicate=await env.DB.prepare('SELECT id FROM shares WHERE client=? AND record=?').bind(client,v.record).first<{id:string}>();
    if(duplicate)return {status:200,body:{url:`${origin}/s/${duplicate.id}`}};
    const usage=await shareUsage(env);
    if(usage.bytes+v.png.length>usage.limit)return {status:507,body:{error:'画像付き共有の保存容量が上限に達したため、新しい共有リンクを作れません。結果画像の保存は使えます。'}};
    return {status:429,body:{error:'画像付き共有は直近24時間の上限に達しました。しばらく待つか、結果画像を保存してください。'}};
  }
  return {status:201,body:{url:`${origin}/s/${id}`}};
}
export async function serveShare(request:Request,env:ShareEnv):Promise<Response>{
  const url=new URL(request.url),match=url.pathname.match(/^\/s\/([0-9a-f-]{36})(\/image\.png)?$/);
  if(!match||!uuid(match[1]))return new Response('Not found',{status:404});
  // The edge cache is a no-op on workers.dev, so every path below also has to work straight from D1.
  const cache=(globalThis.caches as (CacheStorage&{default?:Cache})|undefined)?.default,key=new Request(url.origin+url.pathname);
  const cached=await cache?.match(key);if(cached)return new Response(request.method==='HEAD'?null:cached.body,cached);
  const image=!!match[2];
  const row=await env.DB.prepare(`SELECT ${image?'image':'score,height,count'} FROM shares WHERE id=?`).bind(match[1]).first<{image:ArrayBuffer|ArrayBufferView|number[];score:number;height:number;count:number}>();
  if(!row)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
  let response:Response;
  if(image){
    // D1 returns BLOB columns as a plain number array; local SQLite gives a typed array. Serve bytes either way.
    const source=row.image instanceof ArrayBuffer?new Uint8Array(row.image):ArrayBuffer.isView(row.image)?new Uint8Array(row.image.buffer,row.image.byteOffset,row.image.byteLength):row.image;
    const bytes=Uint8Array.from(source);
    response=new Response(bytes,{headers:{'Content-Type':'image/png','Content-Length':String(bytes.byteLength),'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*'}});
  }
  else{
    if(!env.GAME_URL)return new Response('Not ready',{status:503});
    const game=new URL(env.GAME_URL);if(game.protocol!=='https:')return new Response('Not ready',{status:503});
    game.search='';game.hash='';
    const title=`合体！漢字タワーバトル ${row.score}画`,description=`高さ${row.height.toFixed(1)}字分・${row.count}文字。タップして新しいゲームを始めよう。`;
    const pageURL=esc(url.origin+url.pathname),imageURL=esc(url.origin+url.pathname+'/image.png'),playURL=esc(game.href);
    // Crawlers read this HTML as served; visitors move on to a fresh game, with a plain link when scripts are off.
    const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="canonical" href="${pageURL}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${imageURL}"><meta name="twitter:image:alt" content="最高到達時の漢字タワーと今回の記録">
<meta property="og:type" content="website"><meta property="og:site_name" content="合体！漢字タワーバトル"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${imageURL}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:url" content="${pageURL}">
<style>body{margin:0;font-family:system-ui,sans-serif;background:#fffefa;color:#293757}main{max-width:640px;margin:0 auto;padding:24px 16px;text-align:center}a{color:inherit;text-decoration:none}img{max-width:100%;height:auto;border-radius:16px}p{font-size:18px;font-weight:700;margin:20px 0}</style></head>
<body><main><a id="play" href="${playURL}"><img src="${imageURL}" width="1200" height="630" alt="${esc(title)}"><p>合体！漢字タワーバトルを遊ぶ →</p></a></main><script>location.replace(document.getElementById('play').href)</script></body></html>`;
    response=new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; img-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
  }
  if(cache)await cache.put(key,response.clone());
  return request.method==='HEAD'?new Response(null,response):response;
}
