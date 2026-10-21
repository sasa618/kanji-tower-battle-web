import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, STAGE_Y, STAGE_THICKNESS } from '../src/physics';
import { mergeHintTargets } from '../src/merge-hints';

test('choosing a different candidate immediately changes all compatible targets',()=>{
  const game=new Game();game.reset();game.candidates=['木','日','女'];
  const wood=game.createTile('木',180,450),forest=game.createTile('林',260,450);
  const moon=game.createTile('月',340,450),stone=game.createTile('石',420,450);
  assert.deepEqual(mergeHintTargets(game).map(t=>t.id),[wood.id,forest.id]);
  game.select(1);
  assert.deepEqual(mergeHintTargets(game).map(t=>t.id),[wood.id,moon.id]);
  game.select(2);
  assert.deepEqual(mergeHintTargets(game),[]);
  assert.ok(!mergeHintTargets(game).includes(stone));
});

test('hints follow new combined pieces and disappear outside the selection phase',()=>{
  const game=new Game();game.reset();game.candidates=['木','心','一'];
  const wood=game.createTile('木',230,450),eye=game.createTile('目',300,400);
  const look=game.merge(wood,eye)!;
  game.select(1);
  assert.deepEqual(mergeHintTargets(game).map(t=>t.id),[look.id]);
  game.mode='paused';assert.deepEqual(mergeHintTargets(game),[]);
  game.mode='playing';assert.equal(mergeHintTargets(game).length,1);
  game.drop();assert.deepEqual(mergeHintTargets(game),[]);
  game.mode='over';game.ready=true;assert.deepEqual(mergeHintTargets(game),[]);
});

test('inactive and fallen pieces are never offered as merge targets',()=>{
  const game=new Game();game.reset();game.candidates=['木','日','一'];
  const active=game.createTile('林',160,440);
  const inactive=game.createTile('木',240,440);inactive.body.setActive(false);
  game.createTile('目',320,STAGE_Y+STAGE_THICKNESS+100);
  assert.deepEqual(mergeHintTargets(game).map(t=>t.id),[active.id]);
});
