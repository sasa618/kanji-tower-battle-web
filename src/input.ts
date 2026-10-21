import { canvasViewport } from './viewport';
type Controls={ready:()=>boolean;move:(x:number)=>void;drop:()=>void;activate:()=>void;interact?:()=>void;dragging?:(active:boolean)=>void};
/** Drag and release drops exactly once, for touch, pen, and mouse alike. */
export function bindCanvasInput(canvas:HTMLCanvasElement,controls:Controls){
  let pointer:number|null=null;
  const move=(e:PointerEvent)=>{
    const r=canvas.getBoundingClientRect(),view=canvasViewport(r.width,r.height);
    controls.move((e.clientX-r.left-view.x)/view.scale);
  };
  canvas.addEventListener('pointerdown',e=>{
    if(pointer!==null||e.button!==0||!controls.ready())return;
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
