import test from 'node:test';
import assert from 'node:assert/strict';
import {Vec2} from 'planck';
import {Game,STAGE_Y,STAGE_WIDTH,STAGE_THICKNESS,WORLD_WIDTH,type TowerSnapshot} from '../src/physics';
import {towerFrame} from '../src/result-image';

test('highest tower keeps positions and angles after collapse, and clears on replay',()=>{
  const g=new Game();g.reset();
  const low=g.createTile('森',240,462),high=g.createTile('想',270,365,.23);low.landed=high.landed=true;
  g.step();const peak=structuredClone(g.peakTower!);assert.equal(peak.tiles.length,2);
  assert.ok(Math.abs(peak.tiles[1].angle-.23)<.01);
  high.body.setPosition(Vec2(3.8,4.7));g.step();assert.deepEqual(g.peakTower,peak);
  low.body.setPosition(Vec2(5.2,6));g.step();assert.equal(g.mode,'over');
  for(let i=0;i<20;i++)g.step();assert.deepEqual(g.peakTower,peak);
  g.reset();assert.equal(g.peakTower,null);assert.equal(peak.tiles.length,2);
});
test('unlanded drops are excluded; a genuinely higher landed tower replaces the snapshot',()=>{
  const g=new Game();g.reset();const lower=g.createTile('森',250,450);lower.landed=true;g.step();
  const first=g.peakTower!,flying=g.createTile('想',300,200,.3);g.step();assert.equal(g.peakTower?.tiles.length,1);
  flying.landed=true;g.step();assert.equal(g.peakTower?.tiles.length,2);assert.ok(g.peakTower!.stats.height>first.stats.height);
  const atSnapshot=g.peakTower!.tiles.find(t=>t.char==='想')!;assert.equal(atSnapshot.x,flying.body.getPosition().x*100);assert.equal(atSnapshot.angle,flying.body.getAngle());
});
test('bounds cache follows translation and rotation without altering the geometry',()=>{
  const g=new Game(),tile=g.createTile('力',200,300,.1),initial={...g.bounds(tile)};
  tile.body.setPosition(Vec2(2.3,3.2));const moved=g.bounds(tile);assert.ok(Math.abs(moved.minX-initial.minX-30)<1e-8);assert.ok(Math.abs(moved.maxY-initial.maxY-20)<1e-8);
  tile.body.setAngle(.8);assert.notDeepEqual(g.bounds(tile),moved);
});
test('export fits very tall and wide towers including the full four-character platform',()=>{
  const box={x:96,y:424,width:888,height:670};
  for(const bounds of [{minX:180,minY:420,maxX:350,maxY:510},{minX:-210,minY:-2800,maxX:900,maxY:519}]){
    const tower:TowerSnapshot={stats:{score:100,height:40,count:30},tiles:[],bounds};
    const view=towerFrame(tower,box);
    for(const [x,y] of [[bounds.minX,bounds.minY],[bounds.maxX,bounds.maxY],[(WORLD_WIDTH-STAGE_WIDTH)/2,STAGE_Y],[(WORLD_WIDTH+STAGE_WIDTH)/2,STAGE_Y+STAGE_THICKNESS]]){
      const px=view.x+x*view.scale,py=view.y+y*view.scale;assert.ok(px>=box.x&&px<=box.x+box.width);assert.ok(py>=box.y&&py<=box.y+box.height);
    }
  }
  assert.ok(Number.isFinite(towerFrame(null,box).scale));
});
