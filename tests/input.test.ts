import test from 'node:test';
import assert from 'node:assert/strict';
import { bindCanvasInput } from '../src/input';
class TestCanvas extends EventTarget{
  capture:number|null=null;
  setPointerCapture(id:number){this.capture=id;}
  rect={left:10,width:280,height:351};
  getBoundingClientRect(){return this.rect;}
  pointer(type:string,patch:Record<string,unknown>={}){this.dispatchEvent(Object.assign(new Event(type),{pointerId:1,pointerType:'touch',button:0,clientX:150,...patch}));}
}
function setup(){const canvas=new TestCanvas(),moves:number[]=[];let drops=0,active=true,activations=0;
  bindCanvasInput(canvas as unknown as HTMLCanvasElement,{ready:()=>active,move:x=>moves.push(x),drop:()=>{drops++;active=false;},activate:()=>activations++});
  return {canvas,moves,get drops(){return drops;},get activations(){return activations;},pause(){active=false;}};
}
test('touch follows the finger and drops exactly once at the release position',()=>{
  const s=setup();s.canvas.pointer('pointerdown');s.canvas.pointer('pointermove',{clientX:170});
  assert.equal(s.drops,0);assert.equal(s.moves.at(-1),320);
  s.canvas.pointer('pointerup',{clientX:190});s.canvas.pointer('pointerup');
  assert.equal(s.moves.at(-1),360);assert.equal(s.drops,1);assert.equal(s.activations,1);
});
test('cancellation, lost capture and paused play never cause a drop',()=>{
  for(const event of ['pointercancel','lostpointercapture']){const s=setup();s.canvas.pointer('pointerdown');s.canvas.pointer(event);s.canvas.pointer('pointerup');assert.equal(s.drops,0,event);}
  const s=setup();s.canvas.pointer('pointerdown');s.pause();s.canvas.pointer('pointerup');assert.equal(s.drops,0);
});
test('a second finger cannot move or release the first finger tile',()=>{
  const s=setup();s.canvas.pointer('pointerdown');s.canvas.pointer('pointerdown',{pointerId:2,clientX:5});s.canvas.pointer('pointermove',{pointerId:2,clientX:5});s.canvas.pointer('pointerup',{pointerId:2});
  assert.equal(s.moves.length,1);assert.equal(s.drops,0);s.canvas.pointer('pointerup');assert.equal(s.drops,1);
});
test('mouse and pen both drop on release without a separate drop button',()=>{
  const mouse=setup();mouse.canvas.pointer('pointerdown',{pointerType:'mouse'});mouse.canvas.pointer('pointerup',{pointerType:'mouse'});assert.equal(mouse.drops,1);
  const pen=setup();pen.canvas.pointer('pointerdown',{pointerType:'pen'});pen.canvas.pointer('pointerup',{pointerType:'pen'});assert.equal(pen.drops,1);
});

test('finger coordinates stay aligned when the playfield has horizontal letterboxing',()=>{
  const s=setup();s.canvas.rect={left:10,width:560,height:351};
  s.canvas.pointer('pointerdown',{clientX:360});
  assert.equal(s.moves.at(-1),420);
  s.canvas.pointer('pointerup',{clientX:270});
  assert.equal(s.moves.at(-1),240);assert.equal(s.drops,1);
});

test('phone touches stay aligned when the enlarged playfield crops the side margins',()=>{
  const s=setup();s.canvas.rect={left:10,width:360,height:600};
  s.canvas.pointer('pointerdown',{clientX:70});assert.equal(s.moves.at(-1),120);
  s.canvas.pointer('pointermove',{clientX:190});assert.equal(s.moves.at(-1),280);
  s.canvas.pointer('pointerup',{clientX:310});assert.equal(s.moves.at(-1),440);assert.equal(s.drops,1);
});
