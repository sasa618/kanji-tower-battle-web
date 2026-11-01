import test from 'node:test';
import assert from 'node:assert/strict';
import {Snapshot} from '../server/snapshot';

test('concurrent readers share one query and snapshots expire after a minute',async()=>{
  let now=0,calls=0,finish!:(value:string)=>void;
  const snapshot=new Snapshot(()=>{calls++;return new Promise<string>(resolve=>{finish=resolve;});},()=>now);
  const reads=Array.from({length:100},()=>snapshot.get());
  assert.equal(calls,1);finish('first');assert.deepEqual(await Promise.all(reads),Array(100).fill('first'));
  now=59999;assert.equal(await snapshot.get(),'first');assert.equal(calls,1);
  now=60000;const next=snapshot.get();assert.equal(calls,2);finish('second');assert.equal(await next,'second');
});

test('outages are cooled down and expired data is not passed off as current',async()=>{
  let now=0,calls=0,offline=false;
  const snapshot=new Snapshot(async()=>{calls++;if(offline)throw Error('offline');return 'rows';},()=>now);
  assert.equal(await snapshot.get(),'rows');now=60000;offline=true;
  await assert.rejects(snapshot.get(),/offline/);await assert.rejects(snapshot.get(),/offline/);assert.equal(calls,2);
  now+=15000;offline=false;assert.equal(await snapshot.get(),'rows');assert.equal(calls,3);
});
