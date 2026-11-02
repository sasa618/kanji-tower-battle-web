import test from 'node:test';
import assert from 'node:assert/strict';
import {WILD,baseChars,byChar,chooseCandidates,createCandidateHistory,kanji,rarityOf,recipeFor,recipes,wildChance,WILD_CHANCE} from '../src/data';
import {Game} from '../src/physics';
import {mergeHintTier} from '../src/merge-hints';
import {discoveryText} from '../src/sharing';
import {collectionOrder,collectionSections} from '../src/collection-ui';
import {validateSubmission} from '../server/validation';

test('the bonus block is a 0-stroke non-base entry and every bonus result is rare or legend',()=>{
  const wild=byChar.get(WILD)!;
  assert.equal(wild.strokes,0);assert.ok(wild.wild);assert.ok(!wild.base);assert.ok(!baseChars.includes(WILD));
  const bonus=recipes.filter(r=>r.a===WILD||r.b===WILD);
  assert.ok(bonus.length>=49,`bonus recipes ${bonus.length}`);
  for(const r of bonus){assert.equal(r.kind,'wild');assert.ok(rarityOf(r.result),`${r.result} needs a rarity`);}
  // Each character has at most one bonus result, and the block never reacts with itself.
  const sources=bonus.map(r=>r.a===WILD?r.b:r.a);
  assert.equal(new Set(sources).size,sources.length);assert.ok(!recipeFor(WILD,WILD));
});

test('anything made from a rare or legend character is a legend',()=>{
  for(const r of recipes){
    const tiers=[r.a,r.b].filter(c=>c!==WILD).map(rarityOf).filter(Boolean);
    if(tiers.length)assert.equal(rarityOf(r.result),'legend',`${r.a}+${r.b}=${r.result}`);
  }
  assert.equal(rarityOf('鬱'),'legend');assert.equal(rarityOf('瀧'),'legend');assert.equal(rarityOf('幽'),'rare');
  assert.equal(recipeFor('龍','水')!.result,'瀧');assert.equal(recipeFor('黒','犬')!.result,'黙');
});

test('every entry except the block has strokes and the collection hides the block',()=>{
  for(const k of kanji)if(!k.wild)assert.ok(k.strokes>0,k.char);
  assert.ok(!collectionOrder.includes(kanji.findIndex(k=>k.wild)));
  assert.equal(collectionOrder.length,kanji.length-1);
  assert.deepEqual(collectionSections.map(s=>s.tier),['normal','normal','rare','legend']);
  assert.ok(collectionSections[3].indexes.every(i=>kanji[i].rarity==='legend'));
});

test('the block chance stays zero at first, then rises each turn up to the cap',()=>{
  assert.equal(wildChance(0),0);assert.equal(wildChance(WILD_CHANCE.quietTurns),0);
  assert.equal(wildChance(WILD_CHANCE.quietTurns+1),WILD_CHANCE.start);
  assert.ok(wildChance(10)>wildChance(5));assert.equal(wildChance(1000),WILD_CHANCE.max);
});

test('the block takes one slot only when the tower has a partner, and never twice in a row',()=>{
  let seed=7;const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/2**32;};
  const history=createCandidateHistory();
  const first=chooseCandidates(['木'],random,history,1);
  assert.equal(first.filter(c=>c===WILD).length,1);assert.equal(new Set(first).size,3);
  assert.ok(first.filter(c=>c!==WILD).every(c=>baseChars.includes(c)));
  const second=chooseCandidates(['木'],random,history,1);
  assert.ok(!second.includes(WILD));
  assert.ok(!chooseCandidates([],random,createCandidateHistory(),1).includes(WILD));
  assert.ok(!chooseCandidates(['木'],random,createCandidateHistory(),0).includes(WILD));
  // The default call is unchanged for existing callers.
  assert.equal(chooseCandidates(['木'],random).length,3);
});

test('the block merges into the rare or legend result and scores its strokes',()=>{
  const game=new Game();game.reset();
  const forest=game.createTile('林',280,450),block=game.createTile(WILD,280,350);
  game.candidates=[WILD,'木','日'];
  assert.equal(mergeHintTier(WILD,forest),'legend');
  const made=game.merge(forest,block)!;
  assert.equal(made.char,'鬱');assert.ok(game.made.has('鬱'));
  const wood=game.createTile('木',180,450);
  assert.equal(mergeHintTier(WILD,wood),'rare');assert.equal(mergeHintTier('木',wood),'normal');
});

test('shared text names the tier and the ranking accepts towers with unmerged blocks',()=>{
  assert.match(discoveryText('鬱'),/【レジェンド漢字】「鬱」/);
  assert.match(discoveryText('幽'),/【レア漢字】「幽」/);
  assert.doesNotMatch(discoveryText('森'),/【/);
  const payload={session:'0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0',name:'木のひと',score:0,height:.8,count:1,duration:6,moves:3};
  assert.equal(validateSubmission(payload).score,0);
  assert.equal(validateSubmission({...payload,score:29,count:1,moves:3}).score,29);
});
