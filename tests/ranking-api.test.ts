import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{rankOf} from '../server/worker';
import {env} from './d1-env';
import {RANK_LIMIT,rankLabel} from '../src/ranking';
import {OnlineUI} from '../src/online-ui';
import type {RecordEntry} from '../src/storage';
const ORIGIN='https://sasa618.github.io';
const post=(path:string,body:unknown,type:string)=>new Request(`https://example.invalid${path}`,{method:'POST',headers:{Origin:ORIGIN,'Content-Type':type},body:JSON.stringify(body)});

test('JSON posted as text/plain is accepted (no CORS preflight), other types are still refused',async()=>{
  const e=env(),client=crypto.randomUUID();
  const plain=await worker.fetch(post('/sessions',{client},'text/plain;charset=UTF-8'),e);assert.equal(plain.status,201);
  const json=await worker.fetch(post('/sessions',{client:crypto.randomUUID()},'application/json'),e);assert.equal(json.status,201);
  const form=await worker.fetch(post('/sessions',{client},'application/x-www-form-urlencoded'),e);assert.equal(form.status,415);
  const preflight=await worker.fetch(new Request('https://example.invalid/sessions',{method:'OPTIONS',headers:{Origin:ORIGIN}}),e);assert.equal(preflight.status,204);
});
test(`a submission counts at most ${RANK_LIMIT} better rows, and the client words the overflow`,async()=>{
  const e=env(),db=e.DB,now=Date.now();
  for(let i=0;i<RANK_LIMIT+5;i++)await db.prepare('INSERT INTO sessions(id,client,created) VALUES(?,?,?)').bind(`s${i}`,'c',now).run();
  for(let i=0;i<RANK_LIMIT+5;i++)await db.prepare('INSERT INTO scores(id,session_id,name,score,height,count,duration,created) VALUES(?,?,?,?,?,?,?,?)').bind(`r${i}`,`s${i}`,'n',100+i,1,1,10,now-1000).run();
  assert.equal(await rankOf(db,'score',{score:99,height:1,count:1,created:now},0),RANK_LIMIT+1);
  assert.equal(await rankOf(db,'score',{score:100+RANK_LIMIT+5,height:1,count:1,created:now},0),1);
  // Ten higher scores plus the equal score registered earlier rank above this row.
  assert.equal(await rankOf(db,'score',{score:100+RANK_LIMIT-6,height:1,count:1,created:now},0),12);
  assert.equal(rankLabel(RANK_LIMIT),`第${RANK_LIMIT}位`);assert.equal(rankLabel(RANK_LIMIT+1),`${RANK_LIMIT}位より下`);
  const result:RecordEntry={id:'r',date:'2026-11-02T00:00:00Z',score:1,height:.5,count:1,duration:6,made:[]};
  const ui=new OnlineUI(()=>{},{enabled:true,beginSession:async()=>'s',getScores:async()=>({scores:[]}),reportGame:async()=>{},submitScore:async()=>({rank:RANK_LIMIT+1,ranks:{score:RANK_LIMIT+1,height:3,count:RANK_LIMIT+1}})});
  ui.session='s';ui.result=result;ui.name='木のひと';await ui.submit();
  assert.match(ui.resultHTML(),new RegExp(`総画数 ${RANK_LIMIT}位より下・高さ 第3位・字数 ${RANK_LIMIT}位より下`));
});
test('a best kept on the device can be sent later with a fresh session when marked late',async()=>{
  const e=env(),client=crypto.randomUUID();
  const {session}=await (await worker.fetch(post('/sessions',{client},'text/plain'),e)).json() as {session:string};
  const record={session,name:'あとから',score:40,height:3.5,count:6,duration:95,moves:9};
  const normal=await worker.fetch(post('/scores',record,'text/plain'),e);assert.equal(normal.status,400,'a 95 s play cannot belong to a session created just now');
  const late=await worker.fetch(post('/scores',{...record,late:true},'text/plain'),e);assert.equal(late.status,201);
  assert.deepEqual(await late.json(),{rank:1,ranks:{score:1,height:1,count:1}});
  const again=await worker.fetch(post('/scores',{...record,late:true},'text/plain'),e);assert.equal(again.status,200,'the same late record is idempotent');
  const bogus=await worker.fetch(post('/scores',{...record,late:true,score:9999},'text/plain'),e);assert.equal(bogus.status,400,'late records still pass the value checks');
});
test('a database failure answers 503 with Retry-After so clients pause instead of retrying at once',async()=>{
  const broken=env({DB:{prepare(){throw Error('D1 unavailable');}} as unknown as ReturnType<typeof env>['DB']});
  const response=await worker.fetch(new Request('https://example.invalid/health',{headers:{Origin:ORIGIN}}),broken);
  assert.equal(response.status,503);assert.equal(response.headers.get('Retry-After'),'15');assert.equal(response.headers.get('Cache-Control'),'no-store');
});
