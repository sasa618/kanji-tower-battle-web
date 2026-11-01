import test from 'node:test';
import assert from 'node:assert/strict';
import {baseChars,kanji,chooseCandidates,createCandidateHistory,recipeFor} from '../src/data';
import {Game} from '../src/physics';
const seeded=(seed:number)=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);

test('without a tower partner all twenty characters remain balanced across long runs',()=>{
  for(const seed of [1,42,20261018]){
    const history=createCandidateHistory(),random=seeded(seed);let previous:string[]=[];
    for(let turn=0;turn<2000;turn++){
      const hand=chooseCandidates([],random,history);
      assert.equal(new Set(hand).size,3);assert.ok(hand.every(char=>baseChars.includes(char)));
      assert.ok(hand.every(char=>!previous.includes(char)),'free slots should not repeat the last hand');previous=hand;
    }
    const counts=baseChars.map(char=>history.shown.get(char)||0);
    assert.equal(Math.max(...counts)-Math.min(...counts),0);
  }
});
test('a lone tile with one basic partner gets zero or one partner, without forcing any other character',()=>{
  // 仁 merges only with 女 (仁＋女→佞); 子 now has several partners, including itself (子＋子→孖).
  assert.deepEqual(baseChars.filter(char=>recipeFor(char,'仁')),['女']);
  const history=createCandidateHistory(),random=seeded(20261018);let withPartner=0;
  for(let turn=0;turn<2000;turn++){
    const hand=chooseCandidates(['仁'],random,history);if(hand.includes('女'))withPartner++;
  }
  assert.ok(withPartner>1400&&withPartner<1600);
  const other=baseChars.filter(char=>char!=='女').map(char=>history.shown.get(char)||0);
  assert.ok(Math.max(...other)<250,`free slots repeated one character ${Math.max(...other)}/2000 times`);
  assert.ok(Math.max(...other)-Math.min(...other)<=1);
});
test('zero, one and two actionable choices all occur, with one most common',()=>{
  const history=createCandidateHistory(),random=seeded(20261018),counts=[0,0,0];
  const tower=['女','子','好','村','岩'];
  const partners=baseChars.filter(char=>tower.some(tile=>recipeFor(char,tile)));
  for(let turn=0;turn<2000;turn++){
    const hand=chooseCandidates(tower,random,history);
    const matches=hand.filter(char=>partners.includes(char)).length;counts[matches]++;
  }
  assert.ok(counts[0]>400&&counts[0]<600);assert.ok(counts[1]>900&&counts[1]<1100);assert.ok(counts[2]>400&&counts[2]<600);
  const appearances=partners.map(char=>history.shown.get(char)||0);
  assert.ok(Math.max(...appearances)-Math.min(...appearances)<=1);
  for(const char of baseChars)assert.ok((history.shown.get(char)||0)>200,`${char} was starved`);
});
test('changing towers respect the requested match count whenever enough choices exist',()=>{
  const history=createCandidateHistory(),random=seeded(73);
  for(let turn=0;turn<1000;turn++){
    const tower=[kanji[turn%kanji.length].char],desired=turn%3;
    let calls=0;const hand=chooseCandidates(tower,()=>calls++===0?[.1,.5,.9][desired]:random(),history);
    assert.equal(new Set(hand).size,3);assert.ok(hand.every(char=>baseChars.includes(char)));
    const available=baseChars.filter(char=>recipeFor(char,tower[0])).length;
    assert.equal(hand.filter(char=>recipeFor(char,tower[0])).length,Math.min(available,desired));
  }
});
test('a tower compatible with every basic character still produces three distinct choices',()=>{
  const history=createCandidateHistory();for(let i=0;i<20;i++){
    const hand=chooseCandidates(kanji.map(k=>k.char),()=>.1,history);
    assert.equal(new Set(hand).size,3);assert.ok(hand.every(char=>baseChars.includes(char)));
  }
});
test('game rerolls retain appearance history and restarting clears it',()=>{
  const game=new Game(()=>.25);game.reset();const initial=[...game.candidates];
  // A completed character has no available basic partner, so all slots are free.
  const tile=game.createTile('森',280,400);tile.landed=true;game.dropping=tile;game.ready=false;game.wait=3;
  game.step();assert.ok(game.ready);assert.ok(game.candidates.every(char=>!initial.includes(char)));
  game.reset();assert.deepEqual(game.candidates,initial);
});
