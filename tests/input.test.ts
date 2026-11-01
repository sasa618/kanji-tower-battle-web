import test from 'node:test';
import assert from 'node:assert/strict';
import { bindCanvasInput, nearBoardButtons } from '../src/input';
class TestCanvas extends EventTarget{
  capture:number|null=null;
  setPointerCapture(id:number){this.capture=id;}
  rect={left:10,width:280,height:351};
  getBoundingClientRect(){return this.rect;}
  pointer(type:string,patch:Record<string,unknown>={}){this.dispatchEvent(Object.assign(new Event(type),{pointerId:1,pointerType:'touch',button:0,clientX:150,...patch}));}
}
function setup(guard?:(e:PointerEvent)=>boolean){const canvas=new TestCanvas(),moves:number[]=[];let drops=0,active=true,activations=0;
  bindCanvasInput(canvas as unknown as HTMLCanvasElement,{ready:()=>active,move:x=>moves.push(x),drop:()=>{drops++;active=false;},activate:()=>activations++,guard});
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

test('a mouse press beside the rotate button is ignored, while a finger in the same spot still plays',()=>{
  // Rotate button occupies x 230-290, y 10-54 in client coordinates; the guard adds a 28px margin.
  const box={left:230,right:290,top:10,bottom:54};
  const guard=(e:PointerEvent)=>nearBoardButtons(e,box);
  const mouse=setup(guard);mouse.canvas.pointer('pointerdown',{pointerType:'mouse',clientX:205,clientY:70});mouse.canvas.pointer('pointerup',{pointerType:'mouse',clientX:205,clientY:70});
  assert.equal(mouse.moves.length,0);assert.equal(mouse.drops,0,'a missed click must not drop the tile at the edge');
  mouse.canvas.pointer('pointerdown',{pointerType:'mouse',clientX:150,clientY:200});mouse.canvas.pointer('pointerup',{pointerType:'mouse',clientX:150,clientY:200});
  assert.equal(mouse.drops,1,'ordinary clicks still drop');
  const touch=setup(guard);touch.canvas.pointer('pointerdown',{clientX:205,clientY:70});touch.canvas.pointer('pointerup',{clientX:205,clientY:70});
  assert.equal(touch.moves.length,2);assert.equal(touch.drops,1,'touch behaviour is unchanged');
  assert.equal(nearBoardButtons({clientX:200,clientY:70},box),false);assert.equal(nearBoardButtons({clientX:260,clientY:81},box),true);assert.equal(nearBoardButtons({clientX:260,clientY:30},null),false);
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
