import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareShareIntent,tryOpenShare} from '../src/share-intent';
const game='https://sasa618.github.io/kanji-tower-battle-web/';
test('image sharing keeps the generated link and the result text',async()=>{
  const r=await prepareShareIntent('得点13画',game,async()=> 'https://ranking.example/s/123');
  assert.equal(r.image,true);assert.equal(new URL(r.intent).searchParams.get('url'),'https://ranking.example/s/123');
  assert.equal(new URL(r.intent).searchParams.get('text'),'得点13画');
});
test('server limits and unavailable fonts still produce a usable text share',async()=>{
  for(const failure of ['429','503','507','font failure']){
    const r=await prepareShareIntent('得点13画',game,async()=>{throw Error(failure);});
    assert.equal(r.image,false);assert.equal(new URL(r.intent).searchParams.get('url'),game);
    assert.equal(new URL(r.intent).searchParams.get('text'),'得点13画');
  }
});
test('a stalled image operation has a bounded wait',async()=>{
  const r=await prepareShareIntent('結果',game,()=>new Promise<string>(()=>{}),5);
  assert.equal(r.image,false);assert.equal(new URL(r.intent).searchParams.get('url'),game);
});
test('popup blocking does not throw away the visible fallback link',()=>{
  assert.doesNotThrow(()=>tryOpenShare('https://twitter.com/intent/tweet',()=>null));
  assert.doesNotThrow(()=>tryOpenShare('https://twitter.com/intent/tweet',()=>{throw Error('blocked');}));
});
