import test from 'node:test';
import assert from 'node:assert/strict';
import { baseChars } from '../src/data';
import { Game, glyphs, STAGE_Y, STAGE_WIDTH, STAGE_THICKNESS, WORLD_WIDTH, GLYPH_SIZE, RULER_STEPS } from '../src/physics';
import { canvasViewport, cameraTarget, FLOOR_MARGIN, VIEW_TOP,visibleRulerMarks } from '../src/viewport';

test('all starting pieces and rotations sit entirely above the fifth initial ruler mark',()=>{
  const game=new Game();game.reset();assert.equal(RULER_STEPS,5);
  const fifthMark=STAGE_Y-5*GLYPH_SIZE;
  for(const char of baseChars)for(let turn=0;turn<4;turn++){
    game.candidates=[char];game.selected=0;game.angle=turn*Math.PI/2;
    const y=game.spawnY(),s=Math.sin(game.angle),c=Math.cos(game.angle);
    const edges=glyphs[char].parts.flat().map(([x,py])=>y+x*s+py*c);
    assert.ok(Math.max(...edges)<fifthMark,`${char}, turn ${turn}: below the 5 mark`);
    assert.ok(Math.min(...edges)>VIEW_TOP+70,`${char}, turn ${turn}: overlaps the gesture guide`);
  }
});

test('the floor remains near the bottom on tall, short and landscape canvases',()=>{
  for(const [width,height] of [[340,500],[280,240],[466,850],[700,300]]){
    const view=canvasViewport(width,height);
    const floorBottom=view.y+(STAGE_Y+STAGE_THICKNESS)*view.scale;
    assert.ok(Math.abs(height-floorBottom-FLOOR_MARGIN*view.scale)<1e-8);
    assert.ok(view.scale>0);
    assert.ok(view.x+(WORLD_WIDTH-STAGE_WIDTH)/2*view.scale>=0);
    assert.ok(view.x+(WORLD_WIDTH+STAGE_WIDTH)/2*view.scale<=width);
  }
});

test('phone playfields use eighty percent of available width for the four-character stage when height permits',()=>{
  for(const width of [280,320,360,390]){
    const view=canvasViewport(width,width*1.5);
    assert.ok(Math.abs(STAGE_WIDTH*view.scale/width-.8)<1e-8);
    assert.ok(view.y+VIEW_TOP*view.scale>=0);
    assert.ok(view.left< (WORLD_WIDTH-STAGE_WIDTH)/2);
    assert.ok(view.right> (WORLD_WIDTH+STAGE_WIDTH)/2);
  }
});

test('the camera keeps a newly selected piece visible as the tower rises',()=>{
  const game=new Game();game.reset();game.candidates=['木'];
  for(const towerY of [460,300,100,-100,-400]){
    game.tiles=[];const tile=game.createTile('口',280,towerY);tile.landed=true;
    const camera=cameraTarget(game.top()),spawn=game.spawnY();
    const top=spawn+glyphs['木'].bounds.minY-camera;
    const bottom=spawn+glyphs['木'].bounds.maxY-camera;
    assert.ok(top>VIEW_TOP+70);assert.ok(bottom<STAGE_Y-5*GLYPH_SIZE);
  }
});

test('opening the ready-to-play game does not count idle time before the first drop',()=>{
  const game=new Game();game.reset();
  for(let i=0;i<180;i++)game.step();
  assert.equal(game.elapsed,0);assert.equal(game.ready,true);assert.equal(game.tiles.length,0);
  game.drop();game.step();assert.ok(game.elapsed>0);
});

test('pieces released from the higher start still land and allow the next choice',()=>{
  for(const char of baseChars)for(let turn=0;turn<4;turn++){
    const game=new Game();game.reset();game.candidates=[char];game.angle=turn*Math.PI/2;
    game.drop();
    for(let frame=0;frame<360&&!game.ready&&game.mode==='playing';frame++)game.step();
    assert.equal(game.mode,'playing',`${char}, turn ${turn}: fell off the platform`);
    assert.equal(game.ready,true,`${char}, turn ${turn}: never reached the next choice`);
    assert.equal(game.tiles[0].landed,true);
  }
});


test('ruler starts at five and gains six, seven and higher as the camera rises',()=>{
  assert.deepEqual(visibleRulerMarks(0),[1,2,3,4,5]);
  assert.equal(visibleRulerMarks(-GLYPH_SIZE).at(-1),6);
  assert.equal(visibleRulerMarks(-GLYPH_SIZE*2).at(-1),7);
  assert.equal(visibleRulerMarks(-GLYPH_SIZE*20).at(-1),25);
  assert.ok(visibleRulerMarks(-GLYPH_SIZE*20)[0]>1);
});
