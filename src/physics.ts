import { World, Vec2, Box, Polygon, type Body } from 'planck';
import glyphData from './data/glyphs.json';
import { byChar, chooseCandidates, createCandidateHistory, recipeFor } from './data';

export type Point = [number, number];
export type Glyph = { commands: Array<Record<string, string | number>>; parts: Point[][]; bounds: { minX:number; minY:number; maxX:number; maxY:number }; area:number };
export const GLYPH_SIZE = 96, STAGE_Y = 510, STAGE_WIDTH = GLYPH_SIZE * 4, STAGE_THICKNESS = 16, WORLD_WIDTH = 560;
// Source outlines use an 80 px em. Scale drawing and collision geometry together.
const glyphScale=GLYPH_SIZE/80;
export const glyphs = Object.fromEntries(Object.entries(glyphData).map(([char,g])=>[char,{
  commands:g.commands.map(command=>Object.fromEntries(Object.entries(command).map(([key,value])=>[key,typeof value==='number'?value*glyphScale:value]))),
  parts:g.parts.map(part=>part.map(([x,y])=>[x*glyphScale,y*glyphScale])),
  bounds:Object.fromEntries(Object.entries(g.bounds).map(([key,value])=>[key,value*glyphScale])),area:g.area*glyphScale*glyphScale,
}])) as Record<string,Glyph>;
export const RULER_STEPS=5, SPAWN_CLEARANCE=160;
export const START_BOTTOM=STAGE_Y-RULER_STEPS*GLYPH_SIZE-18;
export const massForStrokes=(strokes:number)=>1+strokes*.22;
export type Tile = { id: number; char: string; body: Body; landed: boolean; restFrames: number; depth: number };
export type Stats = { score: number; height: number; count: number };
export type TowerBounds={minX:number;minY:number;maxX:number;maxY:number};
export type TowerSnapshot={stats:Stats;bounds:TowerBounds;tiles:{char:string;x:number;y:number;angle:number}[]};
export type GameEvent = { type: 'drop'|'land'|'merge'|'over'; char?: string; x?: number; y?: number; depth?: number; ingredients?: string[] };

export class Game {
  world!: World;
  tiles: Tile[] = [];
  mode: 'title'|'playing'|'paused'|'over' = 'title';
  candidates: string[] = []; selected = 0; x = 280; angle = 0;
  ready = true; dropping: Tile | null = null; wait = 0; elapsed = 0; merges = 0;
  final: Stats | null = null; nextId = 1; events: GameEvent[] = []; made = new Set<string>();
  private candidateHistory=createCandidateHistory();
  peakTower:TowerSnapshot|null=null;
  private boundsCache=new WeakMap<Body,{x:number;y:number;angle:number;bounds:TowerBounds}>();
  constructor(public random = Math.random) { this.reset(false); }
  reset(play = true) {
    this.world = new World(Vec2(0, 9.8));
    const stage = this.world.createBody({ position: Vec2(2.8, (STAGE_Y + 8) / 100) });
    stage.createFixture(Box(STAGE_WIDTH / 200, STAGE_THICKNESS / 200), { friction: 1.3, restitution: 0 });
    this.tiles = []; this.events = []; this.final = null; this.nextId = 1;
    this.peakTower=null;this.boundsCache=new WeakMap();
    this.mode = play ? 'playing' : 'title'; this.ready = true; this.dropping = null;
    this.wait = 0; this.elapsed = 0; this.merges = 0; this.made.clear(); this.x = 280; this.angle = 0; this.selected = 0;
    this.candidateHistory=createCandidateHistory();
    this.candidates = chooseCandidates([], this.random, this.candidateHistory);
    this.world.on('begin-contact', contact => {
      for (const body of [contact.getFixtureA().getBody(), contact.getFixtureB().getBody()]) {
        const tile = body.getUserData() as Tile | undefined;
        if(tile)body.setBullet(false);
        if (tile && !tile.landed) { tile.landed = true; this.events.push({type:'land',char:tile.char,x:body.getPosition().x*100,y:body.getPosition().y*100}); }
      }
    });
  }
  createTile(char: string, x: number, y: number, angle = 0, depth = 0): Tile {
    const strokes=byChar.get(char)!.strokes,glyph=glyphs[char];
    const body = this.world.createDynamicBody({position:Vec2(x/100,y/100), angle, bullet:false, linearDamping:.8+strokes*.025, angularDamping:3.8+strokes*.18, allowSleep:true});
    const density=massForStrokes(strokes)/(glyph.area/10000);
    for (const part of glyph.parts) body.createFixture(new Polygon(part.map(([x,y])=>Vec2(x/100,y/100))), {density,friction:1.05+strokes*.025,restitution:0});
    // Bottom-biased weight and greater rotational inertia keep serif tips from
    // turning a tiny contact impulse into a large wobble. The outline is unchanged.
    const mass={mass:0,center:Vec2(),I:0};body.getMassData(mass);
    const inertia=mass.I-mass.mass*mass.center.lengthSquared();
    const height=(glyph.bounds.maxY-glyph.bounds.minY)/100;
    mass.center.y=Math.min(glyph.bounds.maxY/100-height*.1,mass.center.y+height*(.06+strokes*.004));
    mass.I=inertia*(2.2+strokes*.1)+mass.mass*mass.center.lengthSquared();
    body.setMassData(mass);
    const tile: Tile = { id:this.nextId++,char,body,landed:false,restFrames:0,depth };
    body.setUserData(tile); this.tiles.push(tile); return tile;
  }
  bounds(tile: Tile) {
    const position=tile.body.getPosition(),angle=tile.body.getAngle(),cached=this.boundsCache.get(tile.body);
    if(cached&&cached.x===position.x&&cached.y===position.y&&cached.angle===angle)return cached.bounds;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const part of glyphs[tile.char].parts)for(const [x,y] of part){const p=tile.body.getWorldPoint(Vec2(x/100,y/100));minX=Math.min(minX,p.x*100);maxX=Math.max(maxX,p.x*100);minY=Math.min(minY,p.y*100);maxY=Math.max(maxY,p.y*100);}
    const bounds={minX,minY,maxX,maxY};this.boundsCache.set(tile.body,{x:position.x,y:position.y,angle,bounds});return bounds;
  }
  top() { return Math.min(STAGE_Y, ...this.tiles.filter(t=>t.landed && t.body.getWorldCenter().y*100<STAGE_Y+16).map(t=>this.bounds(t).minY)); }
  spawnY() {
    const g=glyphs[this.candidates[this.selected]];const c=Math.cos(this.angle),s=Math.sin(this.angle);
    const bottom=Math.max(...g.parts.flat().map(([x,y])=>x*s+y*c));
    return Math.min(START_BOTTOM,this.top()-SPAWN_CLEARANCE)-bottom;
  }
  select(i: number) { if(this.mode==='playing' && this.ready) this.selected=i; }
  move(dx: number) { if(this.mode==='playing' && this.ready) this.x=Math.max(40,Math.min(520,this.x+dx)); }
  moveTo(x: number) { if(this.mode==='playing'&&this.ready)this.x=Math.max(40,Math.min(520,x)); }
  rotate() { if(this.mode==='playing' && this.ready)this.angle=(this.angle+Math.PI/2)%(Math.PI*2); }
  drop() {
    if(this.mode!=='playing' || !this.ready)return false;
    if(this.tiles.length>=160){this.finish();return false;}
    const char=this.candidates[this.selected];
    this.dropping=this.createTile(char,this.x,this.spawnY(),this.angle);
    this.dropping.body.setBullet(true);
    this.ready=false;this.wait=0;this.events.push({type:'drop',char});return true;
  }
  stats(): Stats {
    if(this.final)return this.final;
    const valid=this.tiles.filter(t=>t.landed && t.body.getWorldCenter().y*100<=STAGE_Y+STAGE_THICKNESS);
    return {score:valid.reduce((s,t)=>s+byChar.get(t.char)!.strokes,0),height:valid.length?Math.max(0,(STAGE_Y-Math.min(...valid.map(t=>this.bounds(t).minY)))/GLYPH_SIZE):0,count:valid.length};
  }
  private rememberPeak(){
    const stats=this.stats();if(!stats.count)return;
    const old=this.peakTower?.stats;
    if(old&&(stats.height<old.height||(stats.height===old.height&&stats.score<=old.score)))return;
    const tiles=this.tiles.filter(t=>t.landed&&t.body.getWorldCenter().y*100<=STAGE_Y+STAGE_THICKNESS);
    const boxes=tiles.map(t=>this.bounds(t));
    this.peakTower={stats:{...stats},bounds:{minX:Math.min(...boxes.map(b=>b.minX)),minY:Math.min(...boxes.map(b=>b.minY)),maxX:Math.max(...boxes.map(b=>b.maxX)),maxY:Math.max(...boxes.map(b=>b.maxY))},tiles:tiles.map(t=>({char:t.char,x:t.body.getPosition().x*100,y:t.body.getPosition().y*100,angle:t.body.getAngle()}))};
  }
  finish() { if(this.mode==='over')return;this.final={...this.stats()};this.mode='over';this.ready=false;this.events.push({type:'over'}); }
  merge(a: Tile,b: Tile): Tile | null {
    const recipe=recipeFor(a.char,b.char);if(!recipe)return null;
    const anchor=this.dropping===a?a:this.dropping===b?b:
      a.body.getLinearVelocity().y>b.body.getLinearVelocity().y?a:
      b.body.getLinearVelocity().y>a.body.getLinearVelocity().y?b:a.id>b.id?a:b;
    const position=anchor.body.getPosition(),x=position.x*100,y=position.y*100,angle=anchor.body.getAngle();
    const isDropping=this.dropping===a||this.dropping===b;
    this.world.destroyBody(a.body);this.world.destroyBody(b.body);this.tiles=this.tiles.filter(t=>t!==a&&t!==b);
    const tile=this.createTile(recipe.result,x,y,angle,Math.max(a.depth,b.depth)+1);
    tile.body.setLinearVelocity(Vec2(0,0));tile.body.setAngularVelocity(0);tile.landed=true;
    if(isDropping){this.dropping=tile;tile.body.setBullet(true);}
    this.merges++;this.made.add(tile.char);
    this.events.push({type:'merge',char:tile.char,x:tile.body.getPosition().x*100,y:tile.body.getPosition().y*100,depth:tile.depth,ingredients:[a.char,b.char]});
    return tile;
  }
  step() {
    if(this.mode!=='playing'&&this.mode!=='over')return;
    this.world.step(1/60,10,4);
    // Keep the visible fall, then stop simulating bodies far below the screen.
    for(const tile of this.tiles)if(tile.body.isActive()&&tile.body.getPosition().y*100>STAGE_Y+1240)tile.body.setActive(false);
    if(this.mode==='over')return;
    if(this.tiles.length)this.elapsed+=1/60;
    if(this.tiles.some(t=>t.body.getWorldCenter().y*100>STAGE_Y+STAGE_THICKNESS)){this.finish();return;}
    for(let c=this.world.getContactList();c;c=c.getNext()) {
      if(!c.isTouching())continue;
      const a=c.getFixtureA().getBody().getUserData() as Tile|undefined,b=c.getFixtureB().getBody().getUserData() as Tile|undefined;
      if(a&&b&&recipeFor(a.char,b.char)){this.merge(a,b);break;}
    }
    for(const tile of this.tiles){const v=tile.body.getLinearVelocity();tile.restFrames=(v.length()<.1&&Math.abs(tile.body.getAngularVelocity())<.1)?tile.restFrames+1:0;}
    this.rememberPeak();
    if(!this.ready){
      this.wait+=1/60;
      if(this.dropping?.landed&&(this.wait>=2||this.tiles.every(t=>t.restFrames>=40))){
        this.ready=true;this.dropping=null;this.candidates=chooseCandidates(this.tiles.map(t=>t.char),this.random,this.candidateHistory);this.selected=0;this.angle=0;this.x=280;
      }
    }
  }
}
