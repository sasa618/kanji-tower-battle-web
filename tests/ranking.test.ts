import test from 'node:test';
import assert from 'node:assert/strict';
import {load,save,recordResult,type RecordEntry} from '../src/storage';
import {MetricRankings} from '../src/ranking-cache';
import type {RankingMetric} from '../src/ranking';

const entry=(id:string,score:number,height:number,count:number):RecordEntry=>({id,score,height,count,date:'2026-10-18T00:00:00Z',made:[],duration:30});
function withStorage(run:(setRaw:(value:unknown)=>void)=>void){
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');let value:string|null=null;
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>value,setItem:(_key:string,text:string)=>{value=text;}}});
  try{run(raw=>{value=JSON.stringify(raw);});}finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage');}
}
test('height and character bests survive outside the old score top ten and reload',()=>withStorage(()=>{
  const saved=load();
  for(let i=0;i<10;i++)recordResult(saved,entry(`score-${i}`,100+i,1,2));
  recordResult(saved,entry('tall',20,8.7,3));recordResult(saved,entry('many',30,2,20));
  assert.equal(saved.records.some(r=>r.id==='tall'||r.id==='many'),false);
  assert.equal(save(saved),true);const restored=load();
  assert.equal(restored.bests.score?.score,109);assert.equal(restored.bests.height?.id,'tall');assert.equal(restored.bests.count?.id,'many');
}));
test('old saves migrate their available records into three bests and reject corrupt bests',()=>withStorage(setRaw=>{
  setRaw({version:1,records:[entry('score',100,2,5),entry('height',20,6,3),entry('count',30,3,10)],bests:{score:{score:Infinity},height:null,count:'broken'}});
  const saved=load();assert.equal(saved.bests.score?.id,'score');assert.equal(saved.bests.height?.id,'height');assert.equal(saved.bests.count?.id,'count');
}));

test('a personal best retains its tower and existing share link after reload',()=>withStorage(()=>{
  const saved=load(),best=entry('best-image',62,3.8,7);
  best.tower={stats:{score:62,height:3.8,count:7},bounds:{minX:100,minY:150,maxX:420,maxY:510},tiles:[{char:'想',x:280,y:180,angle:.12}]};
  best.shareURL='https://ranking.example/s/ab351954-867d-489e-88c3-4126e15e32d6';
  recordResult(saved,best);assert.equal(save(saved),true);
  const restored=load();assert.deepEqual(restored.bests.score?.tower,best.tower);assert.equal(restored.bests.height?.shareURL,best.shareURL);
}));
test('ranking tab changes reuse per-metric snapshots and cannot mix late responses',async()=>{
  let now=1000;const calls:RankingMetric[]=[],resolve=new Map<RankingMetric,(value:string)=>void>();
  const board=new MetricRankings<string>(metric=>{calls.push(metric);return new Promise(done=>resolve.set(metric,done));},()=>{},()=>now);
  const score=board.load();void board.load();board.metric='height';const height=board.load();
  resolve.get('score')!('score rows');await score;assert.equal(board.current.value,undefined);assert.equal(board.current.loading,true);
  resolve.get('height')!('height rows');await height;assert.equal(board.current.value,'height rows');
  board.metric='score';await board.load();assert.equal(board.current.value,'score rows');
  board.metric='count';const count=board.load();resolve.get('count')!('count rows');await count;
  assert.deepEqual(calls,['score','height','count']);
  now+=300000;const renewed=board.load();resolve.get('count')!('new count rows');await renewed;
  assert.equal(board.current.value,'new count rows');assert.equal(calls.length,4);
});
test('one failing metric is cooled down without blocking another metric',async()=>{
  const calls:RankingMetric[]=[];const board=new MetricRankings(async metric=>{calls.push(metric);if(metric==='score')throw Error('offline');return 'ok';},()=>{},()=>1000);
  await board.load();await board.load();assert.equal(board.current.failed,true);
  board.metric='height';await board.load();assert.equal(board.current.value,'ok');assert.equal(board.current.failed,false);
  board.metric='score';await board.load();assert.equal(board.current.failed,true);assert.deepEqual(calls,['score','height']);
});
