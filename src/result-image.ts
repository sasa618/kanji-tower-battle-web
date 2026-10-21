import {GLYPH_SIZE,STAGE_Y,STAGE_WIDTH,STAGE_THICKNESS,WORLD_WIDTH,type TowerSnapshot} from './physics';
import {drawGlyph,drawStage} from './render';
import type {RecordEntry} from './storage';
export const RESULT_IMAGE_WIDTH=1080,RESULT_IMAGE_HEIGHT=1350;
export const SHARE_IMAGE_WIDTH=1200,SHARE_IMAGE_HEIGHT=630;
export function towerFrame(tower:TowerSnapshot|null,box:{x:number;y:number;width:number;height:number}){
  const left=Math.min((WORLD_WIDTH-STAGE_WIDTH)/2,tower?.bounds.minX??Infinity)-20;
  const right=Math.max((WORLD_WIDTH+STAGE_WIDTH)/2,tower?.bounds.maxX??-Infinity)+20;
  const top=Math.min(STAGE_Y-GLYPH_SIZE,tower?.bounds.minY??Infinity)-24;
  const bottom=Math.max(STAGE_Y+STAGE_THICKNESS,tower?.bounds.maxY??-Infinity)+16;
  const scale=Math.min(box.width/(right-left),box.height/(bottom-top),2.5);
  return {scale,x:box.x+box.width/2-(left+right)/2*scale,y:box.y+box.height-bottom*scale};
}

/** Wide card for X: the complete highest tower stays inside the image crop. */
export function drawShareImage(c:CanvasRenderingContext2D,result:RecordEntry,tower:TowerSnapshot|null){
  c.fillStyle='#fffefa';c.fillRect(0,0,1200,630);
  c.fillStyle='#fff';c.beginPath();c.roundRect(490,24,686,582,32);c.fill();
  c.fillStyle='#df3655';c.beginPath();c.roundRect(40,35,208,73,12);c.fill();
  c.textAlign='left';c.font='48px TowerImpact';c.fillStyle=c.strokeStyle='#fff';c.lineWidth=3;c.strokeText('合体！',54,89);c.fillText('合体！',54,89);
  c.fillStyle='#293757';c.font='34px TowerDisplay';c.fillText('漢字タワーバトル',40,161,420);
  c.fillStyle='#df3655';c.font='104px TowerDisplay';c.fillText(String(result.score),40,317,355);
  const width=Math.min(c.measureText(String(result.score)).width,355);c.font='26px Biz';c.fillText('画',52+width,317);
  c.fillStyle='#3451ff';c.font='700 28px Biz';c.fillText(`高さ ${result.height.toFixed(1)}字分`,42,384);
  c.fillStyle='#00a56c';c.fillText(`${result.count}文字`,42,426);
  c.font='700 22px Biz';c.fillStyle='#607394';c.fillText('#漢字タワーバトル',42,558);
  c.font='700 21px Biz';c.textAlign='center';c.fillStyle='#607394';c.fillText('最高到達時のタワー',833,70);
  const frame=towerFrame(tower,{x:518,y:92,width:630,height:478});
  c.save();c.translate(frame.x,frame.y);c.scale(frame.scale,frame.scale);drawStage(c);
  for(const tile of tower?.tiles||[])drawGlyph(c,tile.char,tile.x,tile.y,tile.angle);c.restore();
}
export function drawResultImage(ctx:CanvasRenderingContext2D,result:RecordEntry,tower:TowerSnapshot|null){
  const c=ctx;c.fillStyle='#fff';c.fillRect(0,0,1080,1350);
  c.strokeStyle='#e5eaf6';c.lineWidth=1;c.strokeRect(28,28,1024,1294);
  c.fillStyle='#df3655';c.fillRect(28,28,1024,7);
  const text=(value:string,y:number,size:number,color:string,family='TowerDisplay')=>{c.fillStyle=color;c.font=`400 ${size}px ${family}`;c.textAlign='center';c.fillText(value,540,y,960);};
  c.font='400 42px TowerImpact';const prefixWidth=c.measureText('合体！').width;
  c.font='400 40px TowerDisplay';const titleWidth=c.measureText('漢字タワーバトル').width,start=540-(prefixWidth+16+titleWidth)/2;
  c.textAlign='left';c.font='400 42px TowerImpact';c.fillStyle='#df3655';c.strokeStyle='#df3655';c.lineWidth=3.15;c.strokeText('合体！',start,108);c.fillText('合体！',start,108);
  c.font='400 40px TowerDisplay';c.fillStyle='#293757';c.fillText('漢字タワーバトル',start+prefixWidth+16,108);
  c.font='400 112px TowerDisplay';const score=String(result.score),scoreWidth=c.measureText(score).width;
  c.textAlign='left';c.fillStyle='#df3655';c.fillText(score,540-(scoreWidth+42)/2,244);
  c.font='26px Biz';c.fillText('画',540+(scoreWidth-42)/2+12,244);
  const heightText=`高さ ${result.height.toFixed(1)}字分`,countText=`${result.count}文字`;
  c.font='400 29px Biz';c.textAlign='left';
  const heightWidth=c.measureText(heightText).width,metricsLeft=540-(heightWidth+40+c.measureText(countText).width)/2;
  c.fillStyle='#3451ff';c.fillText(heightText,metricsLeft,302);
  c.fillStyle='#00a56c';c.fillText(countText,metricsLeft+heightWidth+40,302);
  c.save();c.beginPath();c.roundRect(58,340,964,790,28);c.clip();
  c.fillStyle='#fafafa';c.fillRect(58,340,964,790);
  text(tower?`最高到達時　${tower.stats.height.toFixed(1)}字分`:'今回のタワー',391,25,'#5d7596','Biz');
  const frame=towerFrame(tower,{x:96,y:424,width:888,height:670});
  c.translate(frame.x,frame.y);c.scale(frame.scale,frame.scale);
  drawStage(c);for(const tile of tower?.tiles||[])drawGlyph(c,tile.char,tile.x,tile.y,tile.angle);
  c.restore();
  const chars=result.made.slice(0,16);
  if(chars.length){text('つくった漢字',1178,22,'#70819c','Biz');const gap=Math.min(65,896/chars.length),start=540-(chars.length-1)*gap/2;chars.forEach((char,i)=>drawGlyph(c,char,start+i*gap,1225,0,.62));}
  text('#漢字タワーバトル',1294,24,'#536482','Biz');
}
