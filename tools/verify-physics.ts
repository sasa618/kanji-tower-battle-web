import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { Vec2 } from 'planck';
import { Game, STAGE_Y,GLYPH_SIZE,WORLD_WIDTH,STAGE_WIDTH } from '../src/physics';
import { baseChars, recipes } from '../src/data';
const wrap=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
const stability=[];
for(const char of baseChars){const row:{char:string;trials:unknown[]}={char,trials:[]};for(const angle of [0,-.2,.2,-.4,.4,-.6,.6]){
  const g=new Game(),t=g.createTile(char,280,0,angle);t.body.setPosition(Vec2(2.8,(STAGE_Y-g.bounds(t).maxY-2)/100));
  for(let i=0;i<600;i++)g.world.step(1/60,10,4);
  row.trials.push({initialAngle:angle,finalAngle:+wrap(t.body.getAngle()).toFixed(3),speed:+(t.body.getLinearVelocity().length()*100).toFixed(3),asleep:!t.body.isAwake(),fallen:t.body.getWorldCenter().y*100>STAGE_Y+16,upright:Math.abs(wrap(t.body.getAngle()))<.25});
}stability.push(row);}
const contacts=[];
for(const r of recipes)for(const [a,b]of [[r.a,r.b],[r.b,r.a]]){
  const g=new Game();g.reset();const bottom=g.createTile(a,280,0);bottom.body.setPosition(Vec2(2.8,(STAGE_Y-g.bounds(bottom).maxY-1)/100));
  const upper=g.createTile(b,280,g.bounds(bottom).minY-130);let merged=false;
  for(let i=0;i<240&&g.mode==='playing';i++){g.step();if(g.events.some(e=>e.type==='merge'&&e.char===r.result)){merged=true;break;}}
  contacts.push({a,b,result:r.result,merged});
}
const stacks=[];
for(const count of [15,30])for(const chars of [['口'],['目','日','田','回'],['森','詩','想','晶']]){
  const g=new Game();
  // Four columns fit the four-character-wide floor. Pure physics, no merging.
  const tops=Array(4).fill(STAGE_Y);
  for(let i=0;i<count;i++){const col=i%4,t=g.createTile(chars[(i+Math.floor(i/4))%chars.length],(WORLD_WIDTH-STAGE_WIDTH)/2+GLYPH_SIZE*(col+.5),0);const box=g.bounds(t);t.body.setPosition(Vec2(((WORLD_WIDTH-STAGE_WIDTH)/2+GLYPH_SIZE*(col+.5))/100,(tops[col]-box.maxY-2)/100));tops[col]=g.bounds(t).minY;}
  const times=[];
  for(let i=0;i<900;i++){const start=performance.now();g.world.step(1/60,10,4);times.push(performance.now()-start);}
  const active=times.slice(30,180).sort((a,b)=>a-b),settled=times.slice(600).sort((a,b)=>a-b);
  stacks.push({count,characters:chars.join(''),activeP95ms:+active[Math.floor(active.length*.95)].toFixed(3),settledP95ms:+settled[Math.floor(settled.length*.95)].toFixed(3),asleep:g.tiles.filter(t=>!t.body.isAwake()).length,maxSpeedPx:Math.max(...g.tiles.map(t=>t.body.getLinearVelocity().length()*100)),fallen:g.tiles.filter(t=>t.body.getWorldCenter().y*100>STAGE_Y+16).length,finite:g.tiles.every(t=>Number.isFinite(t.body.getPosition().x)&&Number.isFinite(t.body.getPosition().y)&&Number.isFinite(t.body.getAngle()))});
}
const report={date:new Date().toISOString(),stability,contacts,stacks};fs.mkdirSync('docs',{recursive:true});fs.writeFileSync('docs/physics-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({uprightAtZero:stability.map(r=>({char:r.char,...r.trials[0] as object})),failedContacts:contacts.filter(r=>!r.merged),stacks},null,2));
