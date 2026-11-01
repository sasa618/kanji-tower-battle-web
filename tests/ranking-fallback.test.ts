import test from 'node:test';
import assert from 'node:assert/strict';
import {OnlineUI} from '../src/online-ui';
import type {OnlineScore} from '../src/online';

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
test('corrupt device data and a missing copy fall back to the plain failure message',()=>withStorage(async saved=>{
  saved.set('kanji-tower-ranking-cache','{"score":{"at":"x","scores":"no"}}');
  const ui=new OnlineUI(()=>{},{...base(),getScores:async()=>{throw Error('通信できませんでした。');},loadSnapshot:async()=>null});
  await ui.load();assert.match(ui.rankingHTML(),/通信できませんでした。しばらく待ってから/);
}));
