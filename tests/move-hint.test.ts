import test from 'node:test';
import assert from 'node:assert/strict';
import { MoveHint, HINT_IDLE_MS } from '../src/move-hint';

test('guidance starts visible, hides on interaction, and returns only after five idle seconds',()=>{
  const hint=new MoveHint();assert.equal(hint.visible(0,true),true);
  hint.interact(100);assert.equal(hint.visible(100,true),false);
  assert.equal(hint.visible(100+HINT_IDLE_MS-1,true),false);
  assert.equal(hint.visible(100+HINT_IDLE_MS,true),true);
  hint.interact(6000);assert.equal(hint.visible(6000,true),false);
});
test('held gestures and pauses suppress guidance; a new ready phase gets a fresh idle period',()=>{
  const hint=new MoveHint();hint.visible(0,true);hint.interact(100);hint.dragging=true;
  assert.equal(hint.visible(10000,true),false);
  hint.dragging=false;hint.interact(10001);assert.equal(hint.visible(10001,false),false);
  assert.equal(hint.visible(20000,true),false);
  assert.equal(hint.visible(24999,true),false);assert.equal(hint.visible(25000,true),true);
  hint.reset();assert.equal(hint.visible(26000,true),true);
});
