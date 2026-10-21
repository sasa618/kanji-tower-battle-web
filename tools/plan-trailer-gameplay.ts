import fs from 'node:fs';
import path from 'node:path';
import {Game,GLYPH_SIZE,STAGE_Y} from '../src/physics';
import {byChar,recipeFor} from '../src/data';
const output=path.resolve('../映像/合体紹介_2026-10-21_改訂版/制作データ');
fs.mkdirSync(output,{recursive:true});
type Move={char:string;index:number;x:number;rotations:number;steps:number};
function rng(seed:number){let s=seed>>>0;return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function play(seed:number,moves:Move[]){
  const g=new Game(rng(seed));g.reset();
  for(const move of moves){
    if(g.candidates[move.index]!==move.char)throw new Error('Replay mismatch');
    g.select(move.index);for(let r=0;r<move.rotations;r++)g.rotate();g.moveTo(move.x);g.drop();
    for(let i=0;i<move.steps;i++)g.step();
  }g.events=[];return g;
}
function simulate(g:Game,char:string,index:number,x:number,rotations:number){
  g.select(index);for(let r=0;r<rotations;r++)g.rotate();g.moveTo(x);
  if(!g.drop())throw new Error('Not ready');
  let steps=0;
  while(steps<360&&g.mode==='playing'&&(!g.ready||steps<150)){g.step();steps++;}
  return {char,index,x,rotations,steps};
}
const flat:Record<string,number>={'田':9,'目':9,'日':9,'口':8,'月':6,'土':5,'山':6,'立':5,'言':6,'木':4,'石':5,'一':4,'寸':3,'子':3,'女':2,'人':1,'心':1,'水':2,'火':2,'力':2};
const seeds=process.argv.includes('--quick')?[91,411,20261021]:[91,411,20261021,36,128,752,2233,542,887];
let best:any=null;
for(const seed of seeds){
  let moves:Move[]=[];let bestSeed:any=null;
  for(let turn=0;turn<30;turn++){
    const g=play(seed,moves),base=g.stats();
    // Search legal placements on the uppermost bodies and on open foundation.
    const upper=[...g.tiles].sort((a,b)=>g.bounds(a).minY-g.bounds(b).minY).slice(0,3);
    let positions=[280];
    if(turn<4)positions.push(190,370);
    for(const tile of upper){const bounds=g.bounds(tile);positions.push((bounds.minX+bounds.maxX)/2,tile.body.getWorldCenter().x*100);}
    positions=[...new Set(positions.map(x=>Math.round(Math.max(160,Math.min(400,x))/8)*8))];
    const options:{char:string;index:number;x:number;rotations:number;pre:number}[]=[];
    g.candidates.forEach((char,index)=>positions.forEach(x=>{
      for(const rotations of [0,1]){
        const top=upper.find(t=>Math.abs(t.body.getPosition().x*100-x)<40);
        const merge=top&&recipeFor(char,top.char);
        options.push({char,index,x,rotations,pre:(flat[char]||0)-(rotations===1?2:0)+(merge?-.8:0)});
      }
    }));
    options.sort((a,b)=>b.pre-a.pre);
    let chosen:any=null;
    for(const option of options.slice(0,18)){
      const trial=play(seed,moves);
      const move=simulate(trial,option.char,option.index,option.x,option.rotations);
      if(trial.mode!=='playing'||!trial.ready)continue;
      const stats=trial.stats();
      const maxSpeed=Math.max(0,...trial.tiles.map(t=>t.body.getLinearVelocity().length()));
      const spread=Math.max(...trial.tiles.map(t=>trial.bounds(t).maxX))-Math.min(...trial.tiles.map(t=>trial.bounds(t).minX));
      const bestTop=[...trial.tiles].sort((a,b)=>trial.bounds(a).minY-trial.bounds(b).minY)[0];
      const topTilt=bestTop?Math.abs(Math.sin(bestTop.body.getAngle()*2)):0;
      const value=stats.height*9+stats.score*.22+stats.count*.5-maxSpeed*5-topTilt*3-Math.max(0,spread-360)*.04;
      if(!chosen||value>chosen.value)chosen={move,stats,value,maxSpeed};
    }
    if(!chosen)break;
    moves.push(chosen.move);
    bestSeed={seed,moves:[...moves],stats:chosen.stats,score:chosen.stats.height*10+chosen.stats.score*.15};
    if(chosen.stats.height>=12&&chosen.stats.score>=90)break;
    if(turn%5===4)console.log(JSON.stringify({seed,turn:turn+1,stats:chosen.stats}));
  }
  if(bestSeed&&(!best||bestSeed.score>best.score)){best=bestSeed;fs.writeFileSync(path.join(output,'プレイ手順.json'),JSON.stringify(best,null,2));}
  console.log(JSON.stringify({seed,finished:bestSeed?.stats,moves:bestSeed?.moves.length}));
  if(best?.stats.height>=12&&best?.stats.score>=90)break;
}
if(!best)throw new Error('No stable gameplay found');
console.log(JSON.stringify({best,file:path.join(output,'プレイ手順.json')}));
