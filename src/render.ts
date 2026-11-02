import { Game, glyphs, STAGE_Y, STAGE_WIDTH, WORLD_WIDTH, GLYPH_SIZE } from './physics';
import { renderColor, byChar, type Rarity } from './data';
import { mergeHintTargets, mergeHintTier, type HintTier } from './merge-hints';
import { canvasViewport, cameraTarget, VIEW_TOP, VIEW_BOTTOM,visibleRulerMarks } from './viewport';
// 着地予測は難易度調整のため一時停止。再開時は下記の状態と描画も戻す。
// import {LandingPreview} from './landing-preview';
const paths=new Map<string,Path2D>();
export function glyphPath(char:string) {
  if(paths.has(char))return paths.get(char)!;
  const p=new Path2D();for(const c of glyphs[char].commands){const n=c as Record<string,number>;
    if(c.type==='M')p.moveTo(n.x,n.y);if(c.type==='L')p.lineTo(n.x,n.y);if(c.type==='Q')p.quadraticCurveTo(n.x1,n.y1,n.x,n.y);if(c.type==='C')p.bezierCurveTo(n.x1,n.y1,n.x2,n.y2,n.x,n.y);if(c.type==='Z')p.closePath();
  }paths.set(char,p);return p;
}
// Bright rainbow for the bonus block and the legend glow; silver and gold fills for rare and legend characters.
export const RAINBOW=['#ff4d6d','#ff8f2e','#ffd23a','#39c977','#2fb4ff','#5f78ff','#b45cff'];
const METAL:Record<Rarity,{stops:[number,string][];edge:string}>={
  rare:{stops:[[0,'#ffffff'],[.3,'#dde4ee'],[.58,'#a9b5c8'],[1,'#f0f3f8']],edge:'#6b7a95'},
  legend:{stops:[[0,'#fff6c4'],[.3,'#f8cf45'],[.6,'#cf9a22'],[1,'#ffe9a0']],edge:'#7d5a14'},
};
export function rainbowGradient(c:CanvasRenderingContext2D,x0:number,y0:number,x1:number,y1:number){
  const g=c.createLinearGradient(x0,y0,x1,y1);RAINBOW.forEach((color,i)=>g.addColorStop(i/(RAINBOW.length-1),color));return g;
}
/** The bonus block: a rounded rainbow square with a navy frame and a white question mark, drawn in glyph units. */
export function drawWild(c:CanvasRenderingContext2D){
  const h=36,r=11;
  c.fillStyle=rainbowGradient(c,-h,-h,h,h);c.beginPath();c.roundRect(-h,-h,2*h,2*h,r);c.fill();
  c.lineWidth=5;c.strokeStyle='#293757';c.beginPath();c.roundRect(-h+2.5,-h+2.5,2*h-5,2*h-5,r-2);c.stroke();
  c.lineWidth=1;c.strokeStyle='#ffffff55';c.beginPath();c.roundRect(-h+5.5,-h+5.5,2*h-11,2*h-11,r-4);c.stroke();
  c.fillStyle='#fff';c.font='700 46px Biz,"Noto Serif JP",serif';c.textAlign='center';c.textBaseline='middle';
  c.shadowColor='#00000055';c.shadowBlur=6;c.shadowOffsetY=2;c.fillText('？',0,1);
}
export function drawGlyph(ctx:CanvasRenderingContext2D,char:string,x:number,y:number,angle=0,scale=1,debug=false){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);
  const entry=byChar.get(char)!,path=glyphPath(char);
  if(entry.wild)drawWild(ctx);
  else if(entry.rarity){
    const b=glyphs[char].bounds,metal=METAL[entry.rarity],g=ctx.createLinearGradient(b.minX,b.minY,b.maxX,b.maxY);
    for(const [offset,color] of metal.stops)g.addColorStop(offset,color);
    // The outline comes first and the fill covers its inner half, so the edges between overlapping strokes stay hidden.
    ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle=metal.edge;ctx.stroke(path);
    ctx.fillStyle=g;ctx.fill(path,'nonzero');
  }
  else{ctx.fillStyle=renderColor(char);ctx.fill(path,'nonzero');}
  if(debug){ctx.lineWidth=.45;ctx.strokeStyle='#db2763';for(const p of glyphs[char].parts){ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.stroke();}}
  ctx.restore();
}
export function drawStage(c:CanvasRenderingContext2D){
  const stageX=(WORLD_WIDTH-STAGE_WIDTH)/2;
  c.fillStyle='#29375712';c.beginPath();c.ellipse(WORLD_WIDTH/2,STAGE_Y+22,STAGE_WIDTH*.42,3,0,0,Math.PI*2);c.fill();
  c.fillStyle='#293757';c.fillRect(stageX,STAGE_Y,STAGE_WIDTH,16);
  c.fillStyle='#526078';c.fillRect(stageX,STAGE_Y,STAGE_WIDTH,3);
}
export class Renderer {
  ctx:CanvasRenderingContext2D;camera=0;debug=false;
  reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  private glowTime=0;
  /* 着地予測の状態（再有効化用）
  private landing=new LandingPreview();
  private landingY:number|null=null;
  private landingAt=-Infinity;
  private landingKey='';
  */
  private glowSprites=new Map<string,HTMLCanvasElement>();
  constructor(public canvas:HTMLCanvasElement, public game:Game){this.ctx=canvas.getContext('2d')!;this.resize();}
  resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);}
  private glowSprite(char:string,tier:HintTier){
    const key=`${tier}/${char}`,cached=this.glowSprites.get(key);if(cached)return cached;
    // Blur once per letter, not once per body on every animation frame.
    const sprite=document.createElement('canvas');sprite.width=sprite.height=256;
    const c=sprite.getContext('2d')!;c.setTransform(2,0,0,2,128,128);c.lineJoin='round';
    const path=glyphPath(char);
    if(tier==='legend'){
      // Rainbow outline with a soft violet halo.
      c.strokeStyle=rainbowGradient(c,-48,0,48,0);c.lineWidth=5.5;c.shadowColor='#b48cff';c.shadowBlur=28;c.stroke(path);
      c.shadowBlur=0;c.strokeStyle='#ffffffcc';c.lineWidth=1.6;c.stroke(path);
    }else if(tier==='rare'){
      // Ice silver: a near-white outline with a blue halo, stroked twice so the halo stays visible on the white board.
      c.strokeStyle='#f2f8ff';c.lineWidth=5.5;c.shadowColor='#6fa6ff';c.shadowBlur=30;c.stroke(path);c.stroke(path);
      c.shadowBlur=0;c.strokeStyle='#ffffff';c.lineWidth=1.6;c.stroke(path);
    }else{
      c.strokeStyle='#ffd35a';c.lineWidth=5;c.shadowColor='#ffbc32';c.shadowBlur=28;c.stroke(path);
      c.shadowBlur=0;c.strokeStyle='#fff1bd';c.lineWidth=1.6;c.stroke(path);
    }
    if(this.glowSprites.size>=16)this.glowSprites.delete(this.glowSprites.keys().next().value!);
    this.glowSprites.set(key,sprite);return sprite;
  }
  draw(dt:number) {
    this.glowTime=(this.glowTime+dt)%(Math.PI*2);
    const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);const view=canvasViewport(w,h);c.setTransform(view.scale,0,0,view.scale,view.x,view.y);
    const target=cameraTarget(this.game.top());this.camera+=(target-this.camera)*Math.min(1,dt*5);
    c.save();c.translate(0,-this.camera);
    c.strokeStyle='#e0e7f4';c.lineWidth=.7;c.setLineDash([2,9]);
    const rulerX=Math.max(24,view.left+14),gridRight=Math.min(512,view.right-16);
    for(const i of visibleRulerMarks(this.camera)){const y=STAGE_Y-i*GLYPH_SIZE;if(y<this.camera+VIEW_TOP||y>this.camera+VIEW_BOTTOM)continue;c.beginPath();c.moveTo(rulerX+24,y);c.lineTo(gridRight,y);c.stroke();c.fillStyle='#8d9ab5';c.font='600 15px sans-serif';c.fillText(`${i}`,rulerX,y+5);}
    c.setLineDash([]);
    drawStage(c);
    // Halos go behind every piece, so they never obscure adjacent letterforms.
    const selected=this.game.candidates[this.game.selected];
    for(const tile of mergeHintTargets(this.game)){
      const p=tile.body.getPosition(),y=p.y*100;
      if(y<this.camera+VIEW_TOP-80||y>this.camera+VIEW_BOTTOM+80)continue;
      c.save();c.translate(p.x*100,y);c.rotate(tile.body.getAngle());
      c.globalAlpha=this.reducedMotion ? .9 : .8+.2*Math.sin(this.glowTime*3);
      c.drawImage(this.glowSprite(tile.char,mergeHintTier(selected,tile)),-64,-64,128,128);c.restore();
    }
    for(const tile of this.game.tiles){const p=tile.body.getPosition();c.save();if(tile.restFrames<40){c.shadowColor='#00000014';c.shadowBlur=7;c.shadowOffsetY=3;}drawGlyph(c,tile.char,p.x*100,p.y*100,tile.body.getAngle(),1,this.debug);c.restore();}
    if(this.game.ready && this.game.mode!=='over' && this.game.mode!=='title'){
      const char=this.game.candidates[this.game.selected],y=this.game.spawnY();
      /* 着地予測の計算と薄い漢字の描画は一時的に無効化。
      const key=`${char}/${this.game.x}/${this.game.angle}/${this.game.tiles.length}`,now=performance.now();
      if(key!==this.landingKey||now-this.landingAt>=80){this.landingY=this.landing.y(this.game);this.landingAt=now;this.landingKey=key;}
      const landing=this.landingY;
      if(landing!==null){c.save();c.globalAlpha=.19;drawGlyph(c,char,this.game.x,landing,this.game.angle);c.restore();}
      */
      c.strokeStyle='#a6b9ed';c.lineWidth=1.2;c.setLineDash([4,8]);c.beginPath();c.moveTo(this.game.x,y+GLYPH_SIZE*.55);c.lineTo(this.game.x,STAGE_Y);c.stroke();c.setLineDash([]);
      drawGlyph(c,char,this.game.x,y,this.game.angle,1,this.debug);
    }
    c.globalAlpha=1;c.restore();
  }
}
