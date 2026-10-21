import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import worker from '../server/worker';
import { validateSubmission } from '../server/validation';
import { MAX_SHARE_BYTES } from '../server/shares';
import type { Env } from '../server/worker';
const payload={session:crypto.randomUUID(),name:'木のひと',score:13,height:1,count:1,duration:6,moves:3};
const GAME='https://sasa618.github.io/kanji-tower-battle-web/',ORIGIN='https://sasa618.github.io';
test('ranking rejects impossible scores, timings, names and counts',()=>{
  assert.equal(validateSubmission(payload).name,'木のひと');
  for(const patch of [{score:99999},{height:NaN},{duration:0},{duration:2,moves:100},{name:'<script>'},{name:'死ね'},{name:'1234567890'},{name:'あ'.repeat(13)},{count:2,score:1},{count:0,score:1}])assert.throws(()=>validateSubmission({...payload,...patch}));
});
// Tests apply the real migration files in order, exactly as wrangler does for a new or existing database.
export function env(extra:Partial<Env>={}):Env{
  const sqlite=new DatabaseSync(':memory:');
  for(const file of fs.readdirSync('server/migrations').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(`server/migrations/${file}`,'utf8'));
  // Like D1, hand BLOB columns back as plain number arrays rather than typed arrays.
  const row=(r:unknown)=>r&&Object.fromEntries(Object.entries(r as Record<string,unknown>).map(([k,v])=>[k,v instanceof Uint8Array?Array.from(v):v]));
  const db={prepare(sql:string){let values:unknown[]=[];const self={bind(...args:unknown[]){values=args.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);return self;},async first(){return row(sqlite.prepare(sql).get(...values as never[]))||null;},async all(){return {results:sqlite.prepare(sql).all(...values as never[]).map(row)};},async run(){const info=sqlite.prepare(sql).run(...values as never[]);return {meta:{changes:Number(info.changes)}};}};return self;}};
  return {DB:db as unknown as Env['DB'],ALLOWED_ORIGINS:ORIGIN,GAME_URL:GAME,...extra};
}
const req=(path:string,body?:unknown,origin=ORIGIN)=>new Request(`https://example.invalid${path}`,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
const insertScore=(e:Env,id:string,score:number,height:number,count:number,created:number)=>e.DB.prepare('INSERT INTO scores(id,session_id,name,score,height,count,duration,created) VALUES(?,?,?,?,?,?,?,?)').bind(id,id,id,score,height,count,30,created).run();
test('API issues sessions, limits starts, stores one result and sorts leaderboard',async()=>{
  const e=env(),client=crypto.randomUUID();const response=await worker.fetch(req('/sessions',{client}),e);assert.equal(response.status,201);const {session}=await response.json() as {session:string};
  assert.equal((await worker.fetch(req('/sessions',{client}),e)).status,429);
  await e.DB.prepare('UPDATE sessions SET created=? WHERE id=?').bind(Date.now()-10000,session).run();
  const sent=await worker.fetch(req('/scores',{...payload,session}),e);assert.equal(sent.status,201);
  assert.deepEqual(await sent.json(),{rank:1,ranks:{score:1,height:1,count:1}});
  assert.equal((await worker.fetch(req('/scores',{...payload,session}),e)).status,409);
  const scores=await (await worker.fetch(req('/scores'),e)).json() as {scores:unknown[]};assert.equal(scores.scores.length,1);
  assert.equal((await worker.fetch(req('/scores',payload,'https://evil.invalid'),e)).status,403);
  assert.equal((await worker.fetch(req('/sessions',{client:crypto.randomUUID()},'https://evil.invalid'),e)).status,403);
});
test('the rank returned after a submission follows the 90-day window and the list tie order for all three metrics',async()=>{
  const e=env(),now=Date.now();
  await insertScore(e,'expired',999,50,60,now-91*86400000);
  await insertScore(e,'A',100,2,5,now-3000);await insertScore(e,'B',50,5,4,now-2000);await insertScore(e,'C',50,3,20,now-1000);
  const session=crypto.randomUUID();await e.DB.prepare('INSERT INTO sessions(id,client,created) VALUES(?,?,?)').bind(session,'tag',now-10000).run();
  const sent=await worker.fetch(req('/scores',{session,name:'D',score:50,height:5,count:4,duration:6,moves:7}),e);assert.equal(sent.status,201);
  assert.deepEqual(await sent.json(),{rank:3,ranks:{score:3,height:2,count:4}});
  const list=await (await worker.fetch(req('/scores?metric=score'),e)).json() as {scores:{name:string}[]};
  assert.deepEqual(list.scores.map(s=>s.name),['A','B','D','C']);
});
test('six submissions per minute and client are enforced inside the insert statement',async()=>{
  const e=env(),now=Date.now(),sessions=Array.from({length:7},()=>crypto.randomUUID());
  for(const [i,id] of sessions.entries())await e.DB.prepare('INSERT INTO sessions(id,client,created) VALUES(?,?,?)').bind(id,'same-device',now-20000-i*4000).run();
  const statuses=[];for(const session of sessions)statuses.push((await worker.fetch(req('/scores',{...payload,session}),e)).status);
  assert.deepEqual(statuses,[201,201,201,201,201,201,429]);
});
test('API rejects future-duration, missing session and oversized bodies',async()=>{
  const e=env();assert.equal((await worker.fetch(req('/scores',payload),e)).status,400);
  const res=await worker.fetch(req('/sessions',{client:crypto.randomUUID()}),e);const {session}=await res.json() as {session:string};
  assert.equal((await worker.fetch(req('/scores',{...payload,session,duration:100}),e)).status,400);
  assert.equal((await worker.fetch(req('/scores',{...payload,name:'a'.repeat(5000)}),e)).status,413);
});
test('database outage leaves a controlled unavailable response',async()=>{
  const e=env();e.DB.prepare=()=>{throw Error('quota exhausted');};assert.equal((await worker.fetch(req('/scores'),e)).status,503);
  assert.equal((await worker.fetch(req('/health'),e)).status,503);
});
test('edge snapshot avoids repeat database reads and keeps allowed origins separate',async()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'caches');
  let stored:Response|undefined,queries=0;
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{
    async match(){return stored?.clone();},async put(_key:Request,response:Response){stored=response.clone();}
  }}});
  try{
    const e=env(),prepare=e.DB.prepare.bind(e.DB);e.ALLOWED_ORIGINS+=',https://second.example';
    e.DB.prepare=((sql:string)=>{queries++;return prepare(sql);}) as Env['DB']['prepare'];
    const first=await worker.fetch(req('/scores'),e);
    const second=await worker.fetch(req('/scores',undefined,'https://second.example'),e);
    assert.equal(queries,1);
    assert.equal(first.headers.get('Access-Control-Allow-Origin'),ORIGIN);
    assert.equal(second.headers.get('Access-Control-Allow-Origin'),'https://second.example');
    assert.equal(second.headers.get('Cache-Control'),'public, max-age=300');
    assert.deepEqual(await second.json(),{scores:[]});
  }finally{if(original)Object.defineProperty(globalThis,'caches',original);else Reflect.deleteProperty(globalThis,'caches');}
});
test('three rankings use their own order and cache key, with old records excluded',async()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'caches'),snapshots=new Map<string,Response>();
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{
    async match(key:Request){return snapshots.get(key.url)?.clone();},async put(key:Request,response:Response){snapshots.set(key.url,response.clone());}
  }}});
  try{
    const e=env(),now=Date.now();
    for(const [name,score,height,count,created] of [['score',100,2,5,now],['height',40,8,4,now],['count',50,3,20,now],['tied-height',30,8,3,now-1],['expired',999,99,99,now-91*86400000]] as const)await insertScore(e,name,score,height,count,created);
    let queries=0;const prepare=e.DB.prepare.bind(e.DB);e.DB.prepare=((sql:string)=>{queries++;return prepare(sql);}) as Env['DB']['prepare'];
    for(const metric of ['score','height','count']){
      const res=await worker.fetch(req(`/scores?metric=${metric}`),e);assert.equal(res.status,200);
      const {scores}=await res.json() as {scores:{name:string}[]};assert.equal(scores[0].name,metric);assert.equal(scores.length,4);
      if(metric==='height')assert.equal(scores[1].name,'tied-height');
    }
    for(const metric of ['count','height','score'])await worker.fetch(req(`/scores?metric=${metric}`),e);
    assert.equal(queries,3);assert.equal(snapshots.size,3);
    assert.equal((await worker.fetch(req('/scores?metric=invalid'),e)).status,400);assert.equal(queries,3);
    const legacy=await (await worker.fetch(req('/scores'),e)).json() as {scores:{name:string}[]};assert.equal(legacy.scores[0].name,'score');assert.equal(queries,3);
  }finally{if(original)Object.defineProperty(globalThis,'caches',original);else Reflect.deleteProperty(globalThis,'caches');}
});

// Smallest PNG shape the server accepts: signature, IHDR with 1200×630, IEND trailer (57 bytes).
export function sharePayload(){
  const png=Buffer.alloc(57);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);png.writeUInt32BE(1200,16);png.writeUInt32BE(630,20);
  Buffer.from([0,0,0,0,73,69,78,68,174,66,96,130]).copy(png,45);
  return {client:crypto.randomUUID(),record:crypto.randomUUID(),score:62,height:3.8,count:7,image:png.toString('base64')};
}
test('share cards serve public metadata and PNG, link to a fresh game, and reuse records',async()=>{
  const e=env(),data=sharePayload(),created=await worker.fetch(req('/shares',data),e);
  assert.equal(created.status,201);const {url}=await created.json() as {url:string};
  const page=await worker.fetch(new Request(url),e),html=await page.text();
  assert.equal(page.status,200);assert.match(html,/twitter:card" content="summary_large_image/);
  assert.ok(html.includes(`<meta name="twitter:image" content="${url}/image.png">`));assert.ok(html.includes(`<meta property="og:url" content="${url}">`));
  assert.match(html,/62画/);assert.match(html,/高さ3\.8字分・7文字/);assert.match(html,/location.replace/);
  assert.ok(html.includes(`href="${GAME}"`));
  assert.doesNotMatch(html,new RegExp(data.client));
  const image=await worker.fetch(new Request(url+'/image.png'),e);
  assert.equal(image.headers.get('Content-Type'),'image/png');assert.match(image.headers.get('Cache-Control')!,/immutable/);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()),Buffer.from(data.image,'base64'));
  const head=await worker.fetch(new Request(url+'/image.png',{method:'HEAD'}),e);assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
  const again=await worker.fetch(req('/shares',data),e);assert.equal(again.status,200);assert.deepEqual(await again.json(),{url});
  assert.equal((await worker.fetch(new Request('https://example.invalid/s/'+crypto.randomUUID()),e)).status,404);
  assert.equal((await worker.fetch(new Request(url+'/image.png',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:'{}'}),e)).status,404);
});
test('sharing rejects oversized, malformed, unconfigured and over-limit uploads with a 24-hour message',async()=>{
  const e=env(),data=sharePayload();
  assert.equal((await worker.fetch(req('/shares',{...data,image:'x'.repeat(270000)}),e)).status,413);
  assert.equal((await worker.fetch(req('/shares',{...data,image:btoa('<svg onload=alert(1)>')}),e)).status,400);
  const truncated=Buffer.from(data.image,'base64').subarray(0,45).toString('base64');
  assert.equal((await worker.fetch(req('/shares',{...data,image:truncated}),e)).status,400);
  assert.equal((await worker.fetch(req('/shares',{...data,score:-1}),e)).status,400);
  assert.equal((await worker.fetch(req('/shares',data),{...e,GAME_URL:undefined})).status,503);
  for(let i=0;i<10;i++)assert.equal((await worker.fetch(req('/shares',{...data,record:crypto.randomUUID()}),e)).status,201);
  const limited=await worker.fetch(req('/shares',{...data,record:crypto.randomUUID()}),e);assert.equal(limited.status,429);
  assert.match((await limited.json() as {error:string}).error,/直近24時間/);
});
test('cumulative share storage is tracked without scanning images and stops new uploads at the limit',async()=>{
  const e=env({SHARE_STORAGE_LIMIT_BYTES:'100'}),first=sharePayload();
  const created=await worker.fetch(req('/shares',first),e);assert.equal(created.status,201);const {url}=await created.json() as {url:string};
  let health=await (await worker.fetch(req('/health'),e)).json() as {shares:{count:number;bytes:number;limit:number;accepting:boolean}};
  assert.deepEqual(health.shares,{count:1,bytes:57,limit:100,accepting:false});
  const second=await worker.fetch(req('/shares',sharePayload()),e);assert.equal(second.status,507);
  assert.match((await second.json() as {error:string}).error,/保存容量が上限/);
  assert.equal((await worker.fetch(req('/shares',first),e)).status,200,'existing records are still reused');
  assert.equal((await worker.fetch(new Request(url+'/image.png'),e)).status,200,'existing images are still served');
  health=await (await worker.fetch(req('/health'),e)).json() as typeof health;assert.equal(health.shares.count,1);
  await e.DB.prepare('DELETE FROM shares').run();
  health=await (await worker.fetch(req('/health'),e)).json() as typeof health;assert.deepEqual(health.shares,{count:0,bytes:0,limit:100,accepting:false});
  const roomy=env();assert.equal((await (await worker.fetch(req('/health'),roomy)).json() as typeof health).shares.accepting,true);
  assert.ok(MAX_SHARE_BYTES<=(await (await worker.fetch(req('/health'),roomy)).json() as typeof health).shares.limit);
});
