import test from 'node:test';
import assert from 'node:assert/strict';
import {OnlineUI} from '../src/online-ui';
import type {RecordEntry} from '../src/storage';

const result:RecordEntry={id:'record',date:'2026-11-01T00:00:00Z',score:13,height:1,count:1,duration:6,made:[]};
const services=()=>({enabled:true,beginSession:async()=> 'session',getScores:async()=>({scores:[{name:'比較相手',score:14,height:1,count:1,created:0}]}),reportGame:async()=>{},submitScore:async()=>({rank:2,ranks:{score:2,height:3,count:4}})});

test('failed submission can be retried and successful names survive the next visit',async()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),saved=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>saved.get(key)||null,setItem:(key:string,value:string)=>saved.set(key,value)}});
  try{
    const api=services();let attempts=0;
    api.submitScore=async()=>{if(++attempts===1)throw Error('通信できませんでした。');return {rank:2,ranks:{score:2,height:3,count:4}};};
    const ui=new OnlineUI(()=>{},api);ui.session='session';ui.result=result;ui.name='木のひと';
    await ui.submit();assert.match(ui.resultHTML(),/もう一度送信する/);assert.equal(ui.rank,0);
    await ui.submit();assert.equal(ui.rank,2);assert.match(ui.resultHTML(),/全国ランキングで比べる/);
    assert.equal(new OnlineUI(()=>{},api).name,'木のひと');
    await ui.load();assert.match(ui.rankingHTML(),/送信時：総画数 第2位/);
  }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage');}
});

test('late session creation still reports a finished play once',async()=>{
  const api=services();let finish!:(session:string)=>void,reports=0;
  api.beginSession=()=>new Promise(resolve=>{finish=resolve;});api.reportGame=async()=>{reports++;};
  const ui=new OnlineUI(()=>{},api);ui.start();ui.finish(result);finish('session');await Promise.resolve();
  assert.equal(reports,1);assert.equal(ui.session,'session');
});

test('a submission from an earlier play cannot overwrite the next play result',async()=>{
  const api=services();let finish!:(response:{rank:number;ranks:{score:number;height:number;count:number}})=>void;
  api.submitScore=()=>new Promise(resolve=>{finish=resolve;});
  const ui=new OnlineUI(()=>{},api);ui.session='old';ui.result=result;const pending=ui.submit();ui.reset();
  finish({rank:1,ranks:{score:1,height:1,count:1}});await pending;
  assert.equal(ui.rank,0);assert.equal(ui.result,null);assert.equal(ui.sending,false);
});
