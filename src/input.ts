import { canvasViewport } from './viewport';
type Controls={ready:()=>boolean;move:(x:number)=>void;drop:()=>void;activate:()=>void;interact?:()=>void;dragging?:(active:boolean)=>void;guard?:(e:PointerEvent)=>boolean};
/** Drag and release drops exactly once, for touch, pen, and mouse alike. */
export function bindCanvasInput(canvas:HTMLCanvasElement,controls:Controls){
  let pointer:number|null=null;
  const move=(e:PointerEvent)=>{
    const r=canvas.getBoundingClientRect(),view=canvasViewport(r.width,r.height);
    controls.move((e.clientX-r.left-view.x)/view.scale);
  };
  canvas.addEventListener('pointerdown',e=>{
    if(pointer!==null||e.button!==0||!controls.ready())return;
    // A mouse click that misses a board button must not fling the tile to the edge; fingers and pens are unaffected.
    if(e.pointerType==='mouse'&&controls.guard?.(e))return;
    pointer=e.pointerId;
    controls.activate();controls.interact?.();controls.dragging?.(true);canvas.setPointerCapture(pointer);move(e);
  });
  canvas.addEventListener('pointermove',e=>{if(e.pointerId===pointer&&controls.ready()){controls.interact?.();move(e);}});
  canvas.addEventListener('pointerup',e=>{
    if(e.pointerId!==pointer)return;
    const shouldDrop=controls.ready();pointer=null;
    controls.dragging?.(false);controls.interact?.();
    if(shouldDrop){move(e);controls.drop();}
  });
  const cancel=(e:PointerEvent)=>{if(e.pointerId===pointer){pointer=null;controls.dragging?.(false);controls.interact?.();}};
  canvas.addEventListener('pointercancel',cancel);
  canvas.addEventListener('lostpointercapture',cancel);
}
/** The rotate (and pause) buttons sit on the board; mouse presses within this margin around them are ignored. */
export const BUTTON_GUARD_MARGIN=28;
export function nearBoardButtons(e:{clientX:number;clientY:number},box:{left:number;right:number;top:number;bottom:number}|null|undefined,margin=BUTTON_GUARD_MARGIN){
  if(!box)return false;
  return e.clientX>=box.left-margin&&e.clientX<=box.right+margin&&e.clientY>=box.top-margin&&e.clientY<=box.bottom+margin;
}
