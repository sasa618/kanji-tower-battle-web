import test from 'node:test';
import assert from 'node:assert/strict';
import {WILD,baseChars,kanji,chooseCandidates,createCandidateHistory,recipeFor} from '../src/data';
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
test('small matching or non-matching pools never force one letter to repeat',()=>{
  for(const tower of [['仁'],['木','日','月'],['木','日','寸']]){
    for(const seed of [1,42,20261105]){
      const history=createCandidateHistory(),random=seeded(seed);let previous:string[]=[];
      for(let turn=0;turn<10000;turn++){
        const hand=chooseCandidates(tower,random,history);
        assert.equal(new Set(hand).size,3);
        assert.ok(hand.every(c=>baseChars.includes(c)&&!previous.includes(c)),`${tower}: repeated ${hand}`);
        previous=hand;
      }
      for(const c of baseChars)assert.equal(history.shown.get(c),1500,`${tower}: skewed ${c}`);
    }
  }
});
test('changing towers and bonus slots keep every base character available and balanced',()=>{
  const history=createCandidateHistory(),random=seeded(73),pieces=kanji.filter(k=>!k.wild);
  let previous:string[]=[],bonus=0;
  for(let turn=0;turn<10000;turn++){
    const tower=turn%2?['木','日','寸']:[pieces[turn%pieces.length].char];
    const hand=chooseCandidates(tower,random,history,.3);
    assert.equal(new Set(hand).size,3);
    assert.ok(hand.every(c=>baseChars.includes(c)||c===WILD));
    assert.ok(hand.every(c=>!previous.includes(c)));
    if(hand.includes(WILD))bonus++;
    const counts=baseChars.map(c=>history.shown.get(c)||0);
    assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
    previous=hand;
  }
  assert.ok(bonus>100);
});
test('merge partners get a modest preference when appearances are tied',()=>{
  const random=seeded(52);let biased=0,neutral=0;
  // Fresh histories isolate the preference from balancing in later turns.
  for(let i=0;i<10000;i++){
    biased+=Number(chooseCandidates(['仁'],random).includes('女'));
    neutral+=Number(chooseCandidates([],random).includes('女'));
  }
  assert.ok(biased>neutral*1.2,`${biased} vs ${neutral}`);
  assert.ok(biased<3000,`a single partner was forced too often: ${biased}`);
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
