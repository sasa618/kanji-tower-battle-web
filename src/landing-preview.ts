import {glyphs,STAGE_Y,STAGE_WIDTH,STAGE_THICKNESS,WORLD_WIDTH,type Game,type Point,type Tile} from './physics';
type Shape={points:Point[];minX:number;maxX:number;minY:number;maxY:number};
const shape=(points:Point[]):Shape=>({points,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))});
const transformed=(char:string,x:number,y:number,angle:number)=>{
  const c=Math.cos(angle),s=Math.sin(angle);
  return glyphs[char].parts.map(part=>shape(part.map(([px,py])=>[x+px*c-py*s,y+px*s+py*c])));
};
// Exact swept SAT for convex parts moving straight down, with Planck's skin.
export function firstContact(a:Shape,b:Shape,limit=Infinity):number|null{
  const skin=2;
  if(a.maxX+skin<b.minX||a.minX-skin>b.maxX||b.maxY+skin<a.minY||b.minY-a.maxY-skin>limit)return null;
  let enter=0,exit=limit;
  for(const polygon of [a.points,b.points])for(let i=0;i<polygon.length;i++){
    const p=polygon[i],q=polygon[(i+1)%polygon.length],length=Math.hypot(q[0]-p[0],q[1]-p[1]);
    if(length<1e-8)continue;
    const nx=-(q[1]-p[1])/length,ny=(q[0]-p[0])/length;
    let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
    for(const [x,y] of a.points){const v=x*nx+y*ny;amin=Math.min(amin,v);amax=Math.max(amax,v);}
    for(const [x,y] of b.points){const v=x*nx+y*ny;bmin=Math.min(bmin,v);bmax=Math.max(bmax,v);}
    if(Math.abs(ny)<1e-9){if(amax+skin<bmin||amin-skin>bmax)return null;continue;}
    const t1=(bmin-amax-skin)/ny,t2=(bmax-amin+skin)/ny;
    enter=Math.max(enter,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2));
    if(enter>exit)return null;
  }
  return enter;
}
export class LandingPreview{
  private cache=new WeakMap<Tile,{x:number;y:number;angle:number;parts:Shape[]}>();
  private floor=shape([[(WORLD_WIDTH-STAGE_WIDTH)/2,STAGE_Y],[(WORLD_WIDTH+STAGE_WIDTH)/2,STAGE_Y],[(WORLD_WIDTH+STAGE_WIDTH)/2,STAGE_Y+STAGE_THICKNESS],[(WORLD_WIDTH-STAGE_WIDTH)/2,STAGE_Y+STAGE_THICKNESS]]);
  private parts(tile:Tile){
    const p=tile.body.getPosition(),angle=tile.body.getAngle(),old=this.cache.get(tile);
    if(old&&old.x===p.x&&old.y===p.y&&old.angle===angle)return old.parts;
    const parts=transformed(tile.char,p.x*100,p.y*100,angle);this.cache.set(tile,{x:p.x,y:p.y,angle,parts});return parts;
  }
  y(game:Game):number|null{
    const start=game.spawnY(),moving=transformed(game.candidates[game.selected],game.x,start,game.angle);
    let best=Infinity;
    const minX=Math.min(...moving.map(p=>p.minX)),maxX=Math.max(...moving.map(p=>p.maxX)),maxY=Math.max(...moving.map(p=>p.maxY));
    const obstacles=game.tiles.filter(t=>t.body.isActive()).sort((a,b)=>game.bounds(a).minY-game.bounds(b).minY);
    const test=(parts:Shape[])=>{for(const b of parts)for(const a of moving){const hit=firstContact(a,b,best);if(hit!==null)best=Math.min(best,hit);}};
    test([this.floor]);
    for(const tile of obstacles){const bounds=game.bounds(tile);
      if(bounds.minX>maxX+2||bounds.maxX<minX-2||bounds.minY-maxY-2>best)continue;
      test(this.parts(tile));
    }
    return Number.isFinite(best)?start+best:null;
  }
}
