import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {Game,GLYPH_SIZE,STAGE_Y,STAGE_WIDTH,WORLD_WIDTH} from '../src/physics';
import {LandingPreview} from '../src/landing-preview';
const rows=[];
for(const count of [15,30,100]){
  const game=new Game();game.reset();game.candidates=['想'];
  for(let i=0;i<count;i++){const tile=game.createTile(['森','詩','想','晶'][i%4],(WORLD_WIDTH-STAGE_WIDTH)/2+GLYPH_SIZE*(i%4+.5),STAGE_Y-GLYPH_SIZE*(Math.floor(i/4)+.5),i%2*.06);tile.landed=true;tile.body.setAwake(false);}
  const preview=new LandingPreview(),times=[];
  for(let i=0;i<500;i++){game.x=45+(i%94)*5;const start=performance.now();preview.y(game);times.push(performance.now()-start);}
  times.sort((a,b)=>a-b);rows.push({count,p95ms:+times[Math.floor(times.length*.95)].toFixed(3),maxMs:+times.at(-1)!.toFixed(3)});
}
fs.writeFileSync('docs/landing-performance.json',JSON.stringify({date:new Date().toISOString(),scope:'PC, CPU only, detailed glyphs and moving aim; not smartphone frame time',rows},null,2));console.log(rows);
