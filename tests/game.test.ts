import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec2 } from 'planck';
import { kanji, recipes, baseChars, recipeFor, chooseCandidates } from '../src/data';
import { Game, glyphs, STAGE_Y, STAGE_WIDTH, GLYPH_SIZE, massForStrokes } from '../src/physics';
import { compareRecords } from '../src/storage';

test('all characters reachable; no isolated base; no ambiguous recipe',()=>{
  const reachable=new Set(baseChars),keys=new Set();
  for(const r of recipes){const key=[r.a,r.b].sort().join('|');assert.ok(!keys.has(key),key);keys.add(key);assert.equal(recipeFor(r.b,r.a)?.result,r.result);}
  for(let pass=0;pass<kanji.length;pass++)for(const r of recipes)if(reachable.has(r.a)&&reachable.has(r.b))reachable.add(r.result);
  for(const k of kanji)assert.ok(reachable.has(k.char),k.char);
  for(const char of baseChars)assert.ok(recipes.some(r=>r.a===char||r.b===char),char);
});
test('floor width is exactly four enlarged 96-pixel character cells',()=>{
  assert.equal(STAGE_WIDTH,4*GLYPH_SIZE);
  const g=new Game(),floor=g.world.getBodyList()!.getFixtureList()!;
  assert.ok(floor.testPoint(Vec2(.881,5.18)));
  assert.ok(floor.testPoint(Vec2(4.719,5.18)));
  assert.ok(!floor.testPoint(Vec2(.87,5.18)));
  assert.ok(!floor.testPoint(Vec2(4.73,5.18)));
});
test('candidates stay distinct and legal for every tower character',()=>{
  for(const char of kanji.map(k=>k.char))for(let i=0;i<30;i++){
    const c=chooseCandidates([char]);assert.equal(new Set(c).size,3);assert.ok(c.every(k=>baseChars.includes(k)));
  }
});
test('font fixtures valid, convex, at most 8 vertices; enclosed mouth counter filled',()=>{
  // Serif terminals require more small convex pieces; bound the total separately.
  for(const k of kanji){const g=glyphs[k.char];assert.ok(g);assert.ok(g.parts.length<=128,k.char);for(const p of g.parts){assert.ok(p.length>=3&&p.length<=8);for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],c=p[(i+2)%p.length];assert.ok((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>=-.01,k.char);}}}
  const game=new Game(),mouth=game.createTile('口',280,250);let inside=false;for(let f=mouth.body.getFixtureList();f;f=f.getNext())if(f.testPoint(Vec2(2.8,2.5)))inside=true;assert.ok(inside);
  for(const k of kanji){const g=new Game(),tile=g.createTile(k.char,0,0);assert.ok(Math.abs(tile.body.getMass()-massForStrokes(k.strokes))<.01,`${k.char}: fixture area must preserve the intended stroke-based mass`);}
});
test('every merge takes the falling character position and angle, in either argument order',()=>{
  for(const r of recipes)for(const [a,b] of [[r.a,r.b],[r.b,r.a]]){
    for(const reverse of [false,true]){
      const g=new Game();g.reset();const lower=g.createTile(a,270,460,-.1),upper=g.createTile(b,290,385,.35);g.dropping=upper;
      const result=reverse?g.merge(upper,lower)!:g.merge(lower,upper)!;
      assert.equal(result.char,r.result);assert.equal(g.tiles.length,1);assert.equal(result.body.getPosition().x,2.9);assert.equal(result.body.getPosition().y,3.85);assert.equal(result.body.getAngle(),.35);assert.equal(g.dropping,result);assert.equal(result.body.getLinearVelocity().length(),0);assert.equal(result.body.getAngularVelocity(),0);
    }
  }
});
test('more strokes give greater mass and stronger resistance to rotation',()=>{
  const g=new Game(),light=g.createTile('口',150,200),heavy=g.createTile('想',350,200);
  assert.ok(heavy.body.getMass()>light.body.getMass());
  assert.ok(heavy.body.getAngularDamping()>light.body.getAngularDamping());
  for(const tile of [light,heavy]){tile.body.applyAngularImpulse(.1,true);assert.ok(tile.body.getAngularVelocity()>0);}
  assert.ok(heavy.body.getAngularVelocity()<light.body.getAngularVelocity());
});
test('four successive merges: mouth → sun → eye → look → thought',()=>{
  const g=new Game();let current=g.createTile('口',280,460);
  for(const [ingredient,result] of [['一','日'],['一','目'],['木','相'],['心','想']]){const b=g.createTile(ingredient,280,400);current=g.merge(current,b)!;assert.equal(current.char,result);}
  assert.equal(current.depth,4);
});
test('airborne excluded; game over excludes fallen and freezes stats while physics continues',()=>{
  const g=new Game();g.reset();const safe=g.createTile('口',200,STAGE_Y-40);safe.landed=true;
  const falling=g.createTile('木',520,STAGE_Y+30);assert.equal(g.stats().score,3);g.step();assert.equal(g.mode,'over');const final=g.stats(),y=falling.body.getPosition().y;for(let i=0;i<60;i++)g.step();assert.deepEqual(g.stats(),final);assert.ok(falling.body.getPosition().y>y);g.reset();assert.equal(g.mode,'playing');assert.equal(g.stats().score,0);assert.equal(g.tiles.length,0);
});
test('select keeps position and angle; pause stops simulation',()=>{
  const g=new Game();g.reset();g.move(16);g.rotate();g.select(1);assert.equal(g.x,296);assert.equal(g.angle,Math.PI/2);g.drop();const y=g.dropping!.body.getPosition().y;g.mode='paused';for(let i=0;i<60;i++)g.step();assert.equal(g.dropping!.body.getPosition().y,y);
});
test('finger positioning is continuous while keyboard nudges retain their step',()=>{
  const g=new Game();g.reset();g.moveTo(281.25);assert.equal(g.x,281.25);g.move(8);assert.equal(g.x,289.25);
  g.moveTo(-10);assert.equal(g.x,40);g.moveTo(900);assert.equal(g.x,520);
});
test('ranking breaks ties by exact height then count',()=>{
  const rows=[{score:10,height:2,count:2},{score:10,height:2,count:3},{score:10,height:2.1,count:1},{score:12,height:1,count:1}].sort(compareRecords);assert.deepEqual(rows.map(r=>r.count),[1,1,3,2]);
});
