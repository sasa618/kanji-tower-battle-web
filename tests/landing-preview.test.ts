import test from 'node:test';
import assert from 'node:assert/strict';
import {Vec2} from 'planck';
import {Game,glyphs,STAGE_Y} from '../src/physics';
import {baseChars} from '../src/data';
import {LandingPreview} from '../src/landing-preview';

test('first-contact preview touches the floor with the actual rotated outline',()=>{
  const g=new Game();g.reset();const preview=new LandingPreview();
  for(const char of baseChars)for(let turn=0;turn<4;turn++){
    g.candidates=[char];g.angle=turn*Math.PI/2;
    const bottom=Math.max(...glyphs[char].parts.flat().map(([x,y])=>x*Math.sin(g.angle)+y*Math.cos(g.angle)));
    assert.ok(Math.abs(preview.y(g)!+bottom-(STAGE_Y-2))<.01,`${char}, ${turn}`);
  }
});
test('a high piece away from the fall line does not lift the preview into empty space',()=>{
  const g=new Game();g.reset();g.candidates=['力'];g.x=145;
  const preview=new LandingPreview(),floor=preview.y(g);
  const tower=g.createTile('岩',350,250,.3);tower.landed=true;
  assert.equal(preview.y(g),floor);
  g.x=350;const high=preview.y(g)!;assert.ok(high<floor!-100);
  tower.body.setPosition(Vec2(3.5,3.2));assert.ok(Math.abs(preview.y(g)!-high-70)<.01);
  g.x=0;assert.equal(preview.y(g),null);
});
test('rotated detailed glyphs predict the first real physics contact within a few pixels',()=>{
  for(const [below,char,angle] of [['岩','力',0],['木','日',Math.PI/2],['想','山',-.35],['女','子',.4]] as const){
    const g=new Game();g.reset();const obstacle=g.createTile(below,280,350,.2);obstacle.body.setType('static');
    g.candidates=[char];g.x=290;g.angle=angle;
    const expected=new LandingPreview().y(g)!;
    const falling=g.createTile(char,g.x,expected-12,angle);falling.body.setBullet(true);
    let contact:number|undefined;
    g.world.on('begin-contact',c=>{if(c.getFixtureA().getBody()===falling.body||c.getFixtureB().getBody()===falling.body)contact=falling.body.getPosition().y*100;});
    for(let i=0;i<200&&contact===undefined;i++)g.world.step(1/240,10,4);
    assert.ok(contact!==undefined,`${char}: no contact`);
    assert.ok(Math.abs(contact-expected)<3,`${below}+${char}: predicted ${expected}, actual ${contact}`);
  }
});
