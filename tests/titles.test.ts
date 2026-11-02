import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionKanji,kanji} from '../src/data';
import {isJoyo} from '../src/data/joyo';
import {load,save} from '../src/storage';
import {awardTitles,bestTitle,titleById,titleMet,titleProgress,titles} from '../src/titles';
import {collectionSections} from '../src/collection-ui';

const foundAll=(chars:string[])=>{const saved=load();for(const c of chars)saved.collection[c]={drop:1,made:0};return saved;};

test('the five titles cover the dictionary sections, the first 107 characters, and everything',()=>{
  const ordinary=collectionKanji.filter(k=>!k.rarity).map(k=>k.char);
  assert.deepEqual(titleById.get('joyo')!.chars,ordinary.filter(isJoyo));
  assert.deepEqual(titleById.get('nonJoyo')!.chars,ordinary.filter(c=>!isJoyo(c)));
  assert.equal(titleById.get('classic')!.chars.length,107);
  assert.ok(titleById.get('classic')!.chars.every(c=>kanji.some(k=>k.char===c)),'every early character still exists');
  assert.deepEqual(titleById.get('master')!.chars,ordinary);
  assert.equal(titleById.get('trueMaster')!.chars.length,collectionKanji.length);
  assert.ok(titles.every(t=>t.chars.length>0&&!t.chars.includes('？')));
  // The dictionary shows the same split: 常用 and 常用外 among ordinary characters, then rare and legend.
  assert.deepEqual(collectionSections.map(s=>s.key),['joyo','nonJoyo','rare','legend']);
  assert.equal(collectionSections[0].indexes.length,titleById.get('joyo')!.chars.length);
  assert.equal(collectionSections[1].indexes.length,titleById.get('nonJoyo')!.chars.length);
});

test('titles are awarded once, in order, and a player who already completed everything gets them all at once',()=>{
  const saved=foundAll(titleById.get('joyo')!.chars);
  assert.equal(titleProgress(saved,titleById.get('joyo')!),titleById.get('joyo')!.chars.length);
  assert.ok(titleMet(saved,titleById.get('joyo')!));assert.ok(!titleMet(saved,titleById.get('master')!));
  const first=awardTitles(saved,new Date('2026-11-03T00:00:00Z'));
  assert.deepEqual(first.map(t=>t.id),['joyo']);
  assert.deepEqual(awardTitles(saved),[],'nothing is awarded twice');
  assert.equal(saved.titles.joyo,'2026-11-03T00:00:00.000Z');
  const complete=foundAll(collectionKanji.map(k=>k.char));
  assert.deepEqual(awardTitles(complete).map(t=>t.id),['joyo','nonJoyo','classic','master','trueMaster']);
  assert.equal(bestTitle(complete)!.id,'trueMaster');
  assert.equal(bestTitle(saved)!.id,'joyo');
  assert.equal(bestTitle(load()),undefined);
});

test('held titles survive a save and load, and malformed entries are dropped',()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),store=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>store.get(key)||null,setItem:(key:string,value:string)=>store.set(key,value)}});
  try{
    const saved=load();saved.titles={classic:'2026-11-03T01:02:03.000Z',bogus:5 as unknown as string,odd:'yesterday'};
    assert.ok(save(saved));
    assert.deepEqual(load().titles,{classic:'2026-11-03T01:02:03.000Z'});
  }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage');}
});
