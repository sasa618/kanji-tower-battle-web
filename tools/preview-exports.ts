/** Render standalone image exports and instruction artwork, not web screenshots.
 * Set KANJI_CANVAS_MODULE to a local @napi-rs/canvas installation for this check. */
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {Vec2} from 'planck';
import {Game,STAGE_Y} from '../src/physics';
import {drawResultImage,RESULT_IMAGE_WIDTH,RESULT_IMAGE_HEIGHT,drawShareImage,SHARE_IMAGE_WIDTH,SHARE_IMAGE_HEIGHT} from '../src/result-image';
import {helpHTML} from '../src/help';
import {kanji} from '../src/data';
import {drawGlyph} from '../src/render';
const require=createRequire(import.meta.url);
const {createCanvas,Path2D,GlobalFonts,loadImage}=require(process.env.KANJI_CANVAS_MODULE||'@napi-rs/canvas');
globalThis.Path2D=Path2D;
GlobalFonts.registerFromPath('assets/fonts/KanjiTowerDisplay-Heavy.ttf','TowerDisplay');
GlobalFonts.registerFromPath('assets/fonts/NotoSerifJP-Bold.ttf','Biz');
GlobalFonts.registerFromPath('assets/fonts/KanjiTowerImpact.ttf','TowerImpact');
const game=new Game();game.reset();
function place(char:string,x:number,floor:number,angle=0){const tile=game.createTile(char,x,0,angle);tile.body.setPosition(Vec2(x/100,(floor-game.bounds(tile).maxY)/100));tile.landed=true;return game.bounds(tile).minY;}
const low=Math.min(place('森',184,STAGE_Y),place('岩',280,STAGE_Y),place('好',376,STAGE_Y));
const middle=Math.min(place('村',232,low,-.04),place('明',328,low,.03));
const upper=place('林',279,middle,-.04);place('想',282,upper,.09);game.step();
const result={...game.stats(),id:'example',date:'2026-10-18T00:00:00Z',made:['森','岩','好','村','明','林','想'],duration:30};
const canvas=createCanvas(RESULT_IMAGE_WIDTH,RESULT_IMAGE_HEIGHT);drawResultImage(canvas.getContext('2d'),result,game.peakTower);
fs.writeFileSync('docs/result-image-example.png',canvas.toBuffer('image/png'));
const font=createCanvas(760,250),ctx=font.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,760,250);ctx.fillStyle=ctx.strokeStyle='#df3655';ctx.lineWidth=8.25;ctx.font='110px TowerImpact';ctx.strokeText('合体！',40,155);ctx.fillText('合体！',40,155);ctx.fillStyle='#526484';ctx.font='22px Biz';ctx.fillText('タイトル「合体！」専用の書体',40,215);fs.writeFileSync('docs/title-accent-specimen.png',font.toBuffer('image/png'));
const scenes=helpHTML().match(/<svg class="help-scene"[\s\S]*?<\/svg>/g)!;
const sheet=createCanvas(692,472),sc=sheet.getContext('2d');sc.fillStyle='white';sc.fillRect(0,0,692,472);
for(let i=0;i<scenes.length;i++){
  const svg=scenes[i].replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="326" height="216" ');
  const picture=await loadImage(Buffer.from(svg));sc.drawImage(picture,12+(i%2)*342,12+Math.floor(i/2)*232);
}
fs.writeFileSync('docs/help-scenes-preview.png',sheet.toBuffer('image/png'));
console.log('Saved result image, title specimen and four instruction scenes in docs/.');

const card=createCanvas(SHARE_IMAGE_WIDTH,SHARE_IMAGE_HEIGHT);drawShareImage(card.getContext('2d'),result,game.peakTower);fs.writeFileSync('docs/share-card-example.png',card.toBuffer('image/png'));
const icon=await loadImage(fs.readFileSync('public/icon.svg'));const iconCanvas=createCanvas(256,256);iconCanvas.getContext('2d').drawImage(icon,0,0,256,256);fs.writeFileSync('docs/falling-wood-icon.png',iconCanvas.toBuffer('image/png'));

// Inspect the actual rendered stroke tiers on white, separately from the web UI.
const tiers=[...new Map(kanji.map(k=>[k.strokes,k.char])).entries()].sort(([a],[b])=>a-b);
const palette=createCanvas(1050,360),pc=palette.getContext('2d');pc.fillStyle='#fff';pc.fillRect(0,0,1050,360);
pc.fillStyle='#293757';pc.font='24px Biz';pc.fillText('画数が増えるほど、黒に近い色に',24,40);
tiers.forEach(([strokes,char],i)=>{
  const x=75+(i%7)*150,y=110+Math.floor(i/7)*145;
  drawGlyph(pc,char,x,y,0,.75);pc.fillStyle='#526078';pc.font='20px Biz';pc.textAlign='center';pc.fillText(`${strokes}画`,x,y+64);
});
fs.writeFileSync('docs/stroke-colors-preview.png',palette.toBuffer('image/png'));
