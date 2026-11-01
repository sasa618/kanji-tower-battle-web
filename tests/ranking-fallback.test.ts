import test from 'node:test';
import assert from 'node:assert/strict';
import {OnlineUI} from '../src/online-ui';
import type {OnlineScore} from '../src/online';
import type {RecordEntry} from '../src/storage';

const row=(name:string,score:number):OnlineScore=>({name,score,height:1,count:1,created:0});
function withStorage(run:(saved:Map<string,string>)=>Promise<void>){
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),saved=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>saved.get(key)||null,setItem:(key:string,value:string)=>saved.set(key,value)}});
  return run(saved).finally(()=>{if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage');});
}
const base=()=>({enabled:true,beginSession:async()=>'session',reportGame:async()=>{},submitScore:async()=>({rank:1,ranks:{score:1,height:1,count:1}})});

test('while the Worker is unreachable, the published daily copy is shown with a small note',()=>withStorage(async()=>{
  let snapshotReads=0;
  const ui=new OnlineUI(()=>{},{...base(),getScores:async()=>{throw Error('通信できませんでした。');},loadSnapshot:async()=>{snapshotReads++;return {at:Date.UTC(2026,10,2,0,30),scores:{score:[row('昨日の一位',40)],height:[row('高さの一位',5)],count:[]}};}});
  await ui.load();
  assert.match(ui.rankingHTML(),/<small>以前に取得した一覧です。/);assert.doesNotMatch(ui.rankingHTML(),/11\/2|2026/,'no fetch time is shown');assert.match(ui.rankingHTML(),/昨日の一位/);
  // selectMetric starts its own load; let that settle before reading the HTML.
  const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
  ui.selectMetric('height');await settle();assert.match(ui.rankingHTML(),/高さの一位/);
  ui.selectMetric('count');await settle();assert.match(ui.rankingHTML(),/通信できませんでした。しばらく待ってから/,'an empty metric still reports the failure');
  assert.equal(snapshotReads,1,'the copy is fetched once per visit');
}));
test('a list the device fetched earlier is kept and preferred when it is newer than the copy',()=>withStorage(async saved=>{
  let live=true;
  const api={...base(),getScores:async()=>{if(live)return {scores:[row('さっきの一位',30)]};throw Error('通信できませんでした。');},loadSnapshot:async()=>({at:1,scores:{score:[row('古い写し',10)],height:[],count:[]}})};
  const first=new OnlineUI(()=>{},api);await first.load();assert.match(first.rankingHTML(),/さっきの一位/);
  assert.ok(saved.get('kanji-tower-ranking-cache')?.includes('さっきの一位'));
  live=false;const second=new OnlineUI(()=>{},api);await second.load();
  assert.match(second.rankingHTML(),/以前に取得した一覧/);assert.match(second.rankingHTML(),/さっきの一位/);assert.doesNotMatch(second.rankingHTML(),/古い写し/);
  assert.match(second.rankingHTML(),/data-action="online-refresh"/);
}));
test('a personal best from an offline play is offered in the ranking screen and sent late with a new session',()=>withStorage(async()=>{
  const calls:unknown[][]=[];const marked:string[]=[];let session:string|null='fresh';
  const api={...base(),getScores:async()=>({scores:[]}),beginSession:async()=>session,submitScore:async(...args:unknown[])=>{calls.push(args);return {rank:4,ranks:{score:4,height:2,count:9}};}};
  const ui=new OnlineUI(()=>{},api,r=>{marked.push(r.id);});ui.name='木のひと';
  const best:RecordEntry={id:'best',date:'2026-11-01T12:00:00Z',score:40,height:3.5,count:6,duration:95,made:['林','森','明'],moves:9};
  assert.match(ui.lateEntryHTML(best),/data-action="online-submit-best"/);
  assert.equal(ui.lateEntryHTML({...best,submitted:true}),'','already registered records are not offered again');
  assert.equal(ui.lateEntryHTML({...best,count:0,score:0}),'','an empty tower is not offered');
  await ui.submitLate(best);
  assert.deepEqual(calls,[['fresh','木のひと',best,9,true]]);
  assert.equal(best.submitted,true);assert.deepEqual(marked,['best']);
  assert.equal(ui.lateEntryHTML(best),'');assert.match(ui.rankingHTML(),/あなたの直近の送信時：総画数 第4位/);
  // Older records have no move count; drops are estimated from tiles plus merges.
  const old:RecordEntry={id:'old',date:'2026-10-25T12:00:00Z',score:20,height:2,count:4,duration:30,made:['林']};
  await ui.submitLate(old);assert.equal(calls[1][3],5);
  // Without a session the record stays unsent and the message explains.
  session=null;const unsent:RecordEntry={...best,id:'unsent',submitted:false};
  await ui.submitLate(unsent);assert.equal(unsent.submitted,false);assert.match(ui.lateEntryHTML(unsent),/もう一度送信する/);
}));
test('corrupt device data and a missing copy fall back to the plain failure message',()=>withStorage(async saved=>{
  saved.set('kanji-tower-ranking-cache','{"score":{"at":"x","scores":"no"}}');
  const ui=new OnlineUI(()=>{},{...base(),getScores:async()=>{throw Error('通信できませんでした。');},loadSnapshot:async()=>null});
  await ui.load();assert.match(ui.rankingHTML(),/通信できませんでした。しばらく待ってから/);
}));
