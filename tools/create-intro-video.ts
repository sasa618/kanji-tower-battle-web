/**
 * Promotional film, rendered from the shipped glyphs and real Planck simulation.
 * Only filming states and candidate choices are staged; gameplay sources are untouched.
 * Run from web: npx tsx tools/create-intro-video.ts [--preview]
 * Set KANJI_CANVAS_MODULE to an installed @napi-rs/canvas package.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {Vec2} from 'planck';
import {Game, STAGE_Y, STAGE_WIDTH, WORLD_WIDTH, GLYPH_SIZE} from '../src/physics';
import {drawGlyph, drawStage, glyphPath} from '../src/render';
import {byChar, recipeFor} from '../src/data';

const require=createRequire(import.meta.url);
const {createCanvas,Path2D,GlobalFonts}=require(process.env.KANJI_CANVAS_MODULE||'@napi-rs/canvas');
Object.assign(globalThis,{Path2D});
for(const [file,family] of [
  ['DelaGothicOne-Regular.ttf','Display'],
  ['MochiyPopOne-Regular.ttf','Impact'],
  ['BIZUDGothic-Bold.ttf','Body']
])if(!GlobalFonts.registerFromPath(path.resolve('assets/fonts',file),'Film'+family))
  throw new Error('Unable to load font: '+file);

const W=1080,H=1350,FPS=30,DURATION=24;
const output=path.resolve('../映像/合体紹介_2026-10-21');
const work=path.join(output,'制作データ');
fs.mkdirSync(work,{recursive:true});
const palette={ink:'#293757',red:'#df3655',paper:'#fffefa',muted:'#69758d',line:'#e8eaf1'};
type TileFrame={char:string;x:number;y:number;angle:number;id:number};
type Frame={tiles:TileFrame[];ready:boolean;candidates:string[];selected:number;x:number;y:number;angle:number;mode:string;events:{type:string;char?:string}[];top:number};
type Clip={frames:Frame[];mergeAt:number;result?:string};
const filmEvents:{time:number;type:string}[]=[];

function settle(g:Game,steps=180){for(let i=0;i<steps;i++)g.step();g.events=[];}
function place(g:Game,char:string,x:number,floor:number,angle=0){
  const tile=g.createTile(char,x,0,angle);
  tile.body.setPosition(Vec2(x/100,(floor-g.bounds(tile).maxY-.5)/100));
  tile.landed=true;return g.bounds(tile).minY;
}
function capture(g:Game):Frame{
  const tiles=g.tiles.map(tile=>{const p=tile.body.getPosition();return{char:tile.char,x:p.x*100,y:p.y*100,angle:tile.body.getAngle(),id:tile.id};});
  if(tiles.some(t=>![t.x,t.y,t.angle].every(Number.isFinite)))throw new Error('Non-finite simulation');
  return {tiles,ready:g.ready,candidates:[...g.candidates],selected:g.selected,x:g.x,y:g.spawnY(),angle:g.angle,mode:g.mode,events:g.events.splice(0).map(e=>({type:e.type,char:e.char})),top:g.top()};
}
function stepFrame(g:Game){g.step();g.step();return capture(g);}
function mergeClip(a:string,b:string,result:string):Clip{
  if(recipeFor(a,b)?.result!==result)throw new Error('Incorrect recipe');
  const g=new Game(()=>.35);g.reset();
  place(g,a,280,STAGE_Y);
  settle(g);
  if(g.mode!=='playing')throw new Error('Unstable initial letter: '+a);
  g.candidates=[b,'山','土'];g.selected=0;g.ready=true;g.x=280;g.angle=0;g.drop();
  const all:Frame[]=[];let merge=-1;
  for(let i=0;i<210;i++){
    const frame=stepFrame(g);
    if(merge<0&&frame.events.some(e=>e.type==='merge'&&e.char===result))merge=i;
    // Hold the post-merge scene; no next candidate is shown in these close-ups.
    all.push(frame);
  }
  if(merge<0)throw new Error('Recipe did not physically merge: '+a+b+result);
  const start=Math.max(0,merge-8);
  return {frames:all.slice(start),mergeAt:(merge-start)/FPS,result};
}
const woods=[mergeClip('木','木','林'),mergeClip('林','木','森')];
const chain=[
  mergeClip('口','一','日'),mergeClip('日','一','目'),
  mergeClip('目','木','相'),mergeClip('相','心','想')
];

function controlsClip():Clip{
  const g=new Game(()=>.35);g.reset();
  place(g,'土',184,STAGE_Y);place(g,'目',280,STAGE_Y);place(g,'山',376,STAGE_Y);
  settle(g);g.ready=true;g.candidates=['日','木','心'];g.selected=0;g.x=280;g.angle=0;
  const frames:Frame[]=[];let mergeAt=-1;
  for(let i=0;i<180;i++){
    const t=i/FPS;
    if(i===16)g.select(1);
    if(i===40)g.rotate();
    if(t>=1.8&&t<3.0)g.moveTo(280+68*Math.sin((t-1.8)/1.2*Math.PI*2));
    if(i===90){g.moveTo(280);g.drop();}
    const frame=stepFrame(g);
    if(mergeAt<0&&frame.events.some(e=>e.type==='merge'))mergeAt=t;
    frames.push(frame);
  }
  if(mergeAt<0)throw new Error('Tutorial did not show a merge');
  return {frames,mergeAt,result:'相'};
}
const tutorial=controlsClip();
function towerClip():Clip{
  const g=new Game(()=>.35);g.reset();
  const low=Math.min(place(g,'森',184,STAGE_Y),place(g,'岩',280,STAGE_Y),place(g,'好',376,STAGE_Y));
  const middle=Math.min(place(g,'村',232,low,-.04),place(g,'明',328,low,.03));
  const upper=place(g,'林',279,middle,-.04);place(g,'想',282,upper,.09);
  // Begin the shot as the staged tower settles under the real game physics.
  g.ready=false;
  const frames:Frame[]=[];
  for(let i=0;i<100;i++)frames.push(stepFrame(g));
  return {frames,mergeAt:-1};
}
const tower=towerClip();
const previewOnly=process.argv.includes('--preview');
const canvas=createCanvas(W,H),c=canvas.getContext('2d');
const smooth=(x:number)=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const sample=(clip:Clip,t:number)=>clip.frames[Math.max(0,Math.min(clip.frames.length-1,Math.floor(t*FPS)))];
function box(x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string,line=2){
  c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();
  if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}
}
function text(value:string,x:number,y:number,size:number,color=palette.ink,font='Display',align='center',maxWidth=960){
  c.fillStyle=color;c.textAlign=align;c.textBaseline='alphabetic';
  c.font=size+'px Film'+font;
  while(c.measureText(value).width>maxWidth&&size>12)c.font=(--size)+'px Film'+font;
  c.fillText(value,x,y);
}
function glyph(char:string,x:number,y:number,scale=1,angle=0){drawGlyph(c,char,x,y,angle,scale);}
function header(title:string,sub:string){
  text('合体！漢字タワーバトル',64,62,23,palette.muted,'Body','left');
  text('開発中',1016,62,22,palette.muted,'Body','right');
  text(title,540,176,75);
  if(sub)text(sub,540,235,30,palette.muted,'Body');
}
function board(frame:Frame,scale:number,floorY:number,showHeld=false,ruler=false){
  c.save();c.translate(540-280*scale,floorY-STAGE_Y*scale);c.scale(scale,scale);
  if(ruler){
    c.lineWidth=.8;c.strokeStyle='#e0e7f4';c.setLineDash([2,9]);
    for(let i=1;i<=7;i++){
      const y=STAGE_Y-i*GLYPH_SIZE;c.beginPath();c.moveTo(65,y);c.lineTo(495,y);c.stroke();
      c.fillStyle='#8d9ab5';c.font='13px FilmBody';c.textAlign='right';c.fillText(String(i),54,y+5);
    }c.setLineDash([]);
  }
  drawStage(c);
  if(showHeld&&frame.ready&&frame.mode==='playing'){
    for(const tile of frame.tiles)if(recipeFor(frame.candidates[frame.selected],tile.char)){
      c.save();c.translate(tile.x,tile.y);c.rotate(tile.angle);c.strokeStyle='#ffd35a';c.lineWidth=3;
      c.shadowColor='#ffbc32';c.shadowBlur=10;c.stroke(glyphPath(tile.char));c.restore();
    }
  }
  for(const tile of frame.tiles)drawGlyph(c,tile.char,tile.x,tile.y,tile.angle);
  if(showHeld&&frame.ready&&frame.mode==='playing'){
    c.strokeStyle='#a6b9ed';c.lineWidth=1;c.setLineDash([4,8]);
    c.beginPath();c.moveTo(frame.x,frame.y+GLYPH_SIZE*.55);c.lineTo(frame.x,STAGE_Y);c.stroke();c.setLineDash([]);
    drawGlyph(c,frame.candidates[frame.selected],frame.x,frame.y,frame.angle);
  }c.restore();
}
function equation(a:string,b:string,result:string,y:number,confirmed:boolean){
  const xs=[285,540,795];
  glyph(a,xs[0],y,.95);glyph(b,xs[1],y,.95);
  text('＋',412,y+12,37,palette.muted,'Body');text('→',667,y+12,42,palette.muted,'Body');
  c.save();c.globalAlpha=confirmed?1:.17;glyph(result,xs[2],y,1.25);c.restore();
  if(confirmed){c.strokeStyle=palette.red;c.lineWidth=5;c.beginPath();c.moveTo(748,y+68);c.lineTo(842,y+68);c.stroke();}
}
function heroBoard(frame:Frame,time:number){
  c.save();c.beginPath();c.rect(50,280,980,780);c.clip();
  board(frame,2.15+1.2*smooth(time/.8),990);
  c.restore();
}
function touch(x:number,y:number,alpha=1){
  c.save();c.globalAlpha=alpha;c.fillStyle='#df36551c';c.beginPath();c.arc(x,y,29,0,Math.PI*2);c.fill();
  c.strokeStyle=palette.red;c.lineWidth=3;c.beginPath();c.arc(x,y,17,0,Math.PI*2);c.stroke();c.restore();
}
function rotationIcon(x:number,y:number){
  c.save();c.translate(x,y);c.strokeStyle=palette.red;c.lineWidth=4;c.lineCap='round';
  c.beginPath();c.arc(0,0,14,-Math.PI*.85,Math.PI*.6);c.stroke();
  c.beginPath();c.moveTo(-12,14);c.lineTo(-5,17);c.lineTo(-4,9);c.stroke();c.restore();
}
function tutorialView(t:number){
  const f=sample(tutorial,t);header('選んで、回して、離す。','触れると、新しい漢字になる。');
  box(72,280,936,766,24,'#fff','#f0dce1',2);
  c.save();c.beginPath();c.roundRect(74,282,932,762,22);c.clip();board(f,1.05,1025,true,true);c.restore();
  const available=f.ready&&f.mode==='playing';
  c.save();c.globalAlpha=available?1:.4;
  box(788,303,180,64,14,'#fff','#ecd6dc');
  rotationIcon(826,335);text('回転',899,346,28);
  c.restore();
  text('次の漢字を選ぶ',540,1096,28,palette.ink,'Body');
  const starts=[108,408,708];
  f.candidates.forEach((char,i)=>{
    c.save();c.globalAlpha=available?1:.4;
    box(starts[i],1122,264,145,18,i===f.selected?'#fff5f6':'#fff',i===f.selected?palette.red:'#e3e8f3',i===f.selected?4:2);
    glyph(char,starts[i]+132,1180,.8);text(byChar.get(char)!.strokes+'画',starts[i]+132,1244,22,palette.muted,'Body');
    c.restore();
  });
  const label=t<.9?'① 選ぶ':t<1.8?'② 回す':t<3.05?'③ 動かして離す':t<tutorial.mergeAt?'落下中…':'合体！';
  box(104,308,340,58,14,'#fff5f6');text(label,274,348,27,palette.red,'Body');
  if(t>.3&&t<.9)touch(540,1190,Math.sin((t-.3)/.6*Math.PI));
  if(t>1.05&&t<1.7)touch(873,337,Math.sin((t-1.05)/.65*Math.PI));
  if(t>1.8&&t<3.0)touch(540+(f.x-280)*1.05,1025+(f.y-STAGE_Y)*1.05+58,.9);
}
function render(t:number){
  c.setTransform(1,0,0,1,0,0);c.fillStyle=palette.paper;c.fillRect(0,0,W,H);
  c.fillStyle=palette.red;c.fillRect(0,0,W,8);
  if(t<2.35){
    const f=sample(woods[0],t);header('漢字を、合体。','');heroBoard(f,t);
    equation('木','木','林',1160,t>=woods[0].mergeAt);
  }else if(t<4.7){
    const lt=t-2.35,f=sample(woods[1],lt);header('さらに、合体。','同じ字でも、合体した字でも。');heroBoard(f,lt);
    equation('林','木','森',1160,lt>=woods[1].mergeAt);
  }else if(t<10.5){
    tutorialView(t-4.7);
  }else if(t<17.3){
    const index=Math.min(3,Math.floor((t-10.5)/1.7)),lt=(t-10.5)-index*1.7;
    const f=sample(chain[index],lt);
    header('合体は、まだ続く。','一画を足して。組み合わせて。');heroBoard(f,lt);
    const chars=['口','日','目','相','想'];
    chars.forEach((char,i)=>{
      const active=i===index+(lt>=chain[index].mergeAt?1:0);
      c.save();c.globalAlpha=i<=index+(lt>=chain[index].mergeAt?1:0)?1:.2;
      glyph(char,190+i*175,1166,active?1.15:.8);c.restore();
      if(i<4)text('→',277+i*175,1178,30,'#94a0b5','Body');
      if(active){c.fillStyle=palette.red;c.fillRect(148+i*175,1235,84,5);}
    });
  }else if(t<20.3){
    const f=sample(tower,t-17.3);header('崩さず、どこまで？','合体のたびに、積み方が変わる。');
    c.save();c.beginPath();c.rect(50,285,980,875);c.clip();board(f,2.25,1100);c.restore();
    text('合体を重ねて、自分だけの塔へ。',540,1238,37,palette.ink,'Body');
  }else{
    const lt=t-20.3;
    const a=smooth(lt/.35);c.save();c.globalAlpha=a;
    c.save();c.translate(540,240);c.rotate(-.035);
    box(-265,-104,530,182,25,palette.red);
    text('合体！',0,29,128,'#fff','Impact');c.restore();
    text('漢字タワーバトル',540,474,76);
    const f=sample(tower,Math.min(1.8,lt*.5));
    c.save();c.beginPath();c.rect(80,535,920,535);c.clip();board(f,1.29,1040);c.restore();
    text('次は、どの漢字をつくる？',540,1150,44);
    box(435,1201,210,61,30,'#fff',palette.red,2);
    text('開発中',540,1242,28,palette.red,'Body');
    text('#漢字タワーバトル',540,1310,25,palette.muted,'Body');c.restore();
  }
  c.fillStyle='#eee9e9';c.fillRect(0,H-5,W,5);c.fillStyle=palette.red;c.fillRect(0,H-5,W*t/DURATION,5);
}

const sceneEvents=[
  {start:0,duration:2.35,clip:woods[0]},
  {start:2.35,duration:2.35,clip:woods[1]},
  {start:4.7,duration:5.8,clip:tutorial},
  ...chain.map((clip,i)=>({start:10.5+i*1.7,duration:1.7,clip})),
  {start:17.3,duration:3,clip:tower}
];
for(const scene of sceneEvents)scene.clip.frames.forEach((frame,i)=>{
  if(i/FPS>=scene.duration)return;
  for(const event of frame.events)if(['drop','land','merge','over'].includes(event.type))
    filmEvents.push({time:scene.start+i/FPS,type:event.type});
});
filmEvents.push({time:20.3,type:'title'});
const previewTimes=[0,.8,3.2,5.2,6.05,7.2,9.7,11.3,13.0,16.4,18.3,22.2];
const sheet=createCanvas(1080,1131),sc=sheet.getContext('2d');sc.fillStyle='#e8eaf1';sc.fillRect(0,0,1080,1131);
previewTimes.forEach((t,i)=>{
  render(t);const col=i%4,row=Math.floor(i/4);
  sc.drawImage(canvas,col*270,row*377,270,337.5);
  sc.fillStyle=palette.ink;sc.font='20px FilmBody';sc.textAlign='left';sc.fillText(t.toFixed(1)+' 秒',col*270+12,row*377+366);
  if([0,.8,9.7,16.4,18.3,22.2].includes(t))fs.writeFileSync(path.join(work,'確認_'+t.toFixed(1)+'.png'),canvas.toBuffer('image/png'));
});
fs.writeFileSync(path.join(work,'絵コンテ.png'),sheet.toBuffer('image/png'));
render(.9);fs.writeFileSync(path.join(output,'サムネイル.png'),canvas.toBuffer('image/png'));
const evidence={
  width:W,height:H,fps:FPS,duration:DURATION,
  merges:sceneEvents.filter(s=>s.clip.mergeAt>=0).map(s=>({at:+(s.start+s.clip.mergeAt).toFixed(3),result:s.clip.result})),
  notes:'Real physics and glyphs. Initial placements and candidates staged for filming; cropped cuts omit uneventful falling time. Captions and touch cues are editorial overlays.',
  events:filmEvents
};
fs.writeFileSync(path.join(work,'撮影記録.json'),JSON.stringify(evidence,null,2));
console.log(JSON.stringify({phase:'preview',output,merges:evidence.merges}));
if(!previewOnly){
  const silent=path.join(work,'映像のみ.mp4');
  const ff=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','rawvideo','-pixel_format','rgba','-video_size',W+'x'+H,'-framerate',String(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',silent],{windowsHide:true,stdio:['pipe','ignore','pipe']});
  let errorText='';ff.stderr.on('data',d=>errorText+=String(d));
  const done=new Promise<void>((resolve,reject)=>{ff.on('error',reject);ff.on('close',code=>code===0?resolve():reject(new Error(errorText||'ffmpeg exit '+code)));});
  ff.stdin.on('error',()=>{});
  for(let i=0;i<DURATION*FPS;i++){
    render(i/FPS);
    if(!ff.stdin.write(canvas.data()))await once(ff.stdin,'drain');
    if(i%120===0)console.log(JSON.stringify({phase:'render',seconds:i/FPS,total:DURATION}));
  }
  ff.stdin.end();await done;
  const rate=48000,count=DURATION*rate,left=new Float32Array(count),right=new Float32Array(count);
  function note(time:number,freq:number,duration:number,volume:number,kind='sine',pan=0){
    const start=Math.round(time*rate),n=Math.min(Math.round(duration*rate),count-start);
    for(let i=0;i<n;i++){
      const t=i/rate,attack=Math.min(1,t/.012),release=Math.exp(-6*t/duration);
      const phase=2*Math.PI*freq*t;
      const wave=kind==='triangle'?2/Math.PI*Math.asin(Math.sin(phase)):Math.sin(phase)+.12*Math.sin(phase*2);
      const sample=wave*volume*attack*release;
      left[start+i]+=sample*(1-pan*.25);right[start+i]+=sample*(1+pan*.25);
      const echo=start+i+4800;if(echo<count){left[echo]+=sample*.09;right[echo]+=sample*.12;}
    }
  }
  // Quiet original backing motif, based on the game's existing note palette.
  const motif=[261.63,329.63,392,329.63,293.66,349.23,440,349.23,261.63,329.63,523.25,392,293.66,349.23,392,293.66];
  for(let i=0;i<40;i++)note(i*.6,motif[i%motif.length],.7,.027,'sine',i%2?.35:-.35);
  for(const e of filmEvents){
    if(e.type==='merge')[523.25,659.25,783.99,1046.5].forEach((f,i)=>note(e.time+i*.075,f,.35,.14,'sine',(i-1.5)/3));
    else if(e.type==='drop')note(e.time,392,.15,.065);
    else if(e.type==='land')note(e.time,196,.12,.045,'triangle');
    else if(e.type==='over')[440,349,261].forEach((f,i)=>note(e.time+i*.15,f,.5,.05,'triangle'));
    else if(e.type==='title')[261.63,329.63,392,523.25].forEach((f,i)=>note(e.time+i*.08,f,1.2,.075));
  }
  const pcm=Buffer.alloc(44+count*4);
  pcm.write('RIFF',0);pcm.writeUInt32LE(36+count*4,4);pcm.write('WAVE',8);pcm.write('fmt ',12);
  pcm.writeUInt32LE(16,16);pcm.writeUInt16LE(1,20);pcm.writeUInt16LE(2,22);pcm.writeUInt32LE(rate,24);pcm.writeUInt32LE(rate*4,28);pcm.writeUInt16LE(4,32);pcm.writeUInt16LE(16,34);
  pcm.write('data',36);pcm.writeUInt32LE(count*4,40);
  for(let i=0;i<count;i++){
    const fade=Math.min(1,(count-i)/(rate*.8));
    pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,left[i]*fade))*32767),44+i*4);
    pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,right[i]*fade))*32767),46+i*4);
  }
  const wav=path.join(work,'合体音とBGM.wav');fs.writeFileSync(wav,pcm);
  const final=path.join(output,'kanji-tower-intro.mp4');
  const mux=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',silent,'-i',wav,'-map','0:v:0','-map','1:a:0','-c:v','copy','-af','loudnorm=I=-17:TP=-1.5:LRA=9','-c:a','aac','-b:a','160k','-ar','48000','-movflags','+faststart','-t',String(DURATION),final],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let muxError='';mux.stderr.on('data',d=>muxError+=String(d));
  await new Promise<void>((resolve,reject)=>{mux.on('error',reject);mux.on('close',code=>code===0?resolve():reject(new Error(muxError)));});
  console.log(JSON.stringify({phase:'complete',file:final,bytes:fs.statSync(final).size}));
}
