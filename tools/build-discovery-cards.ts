/** Set KANJI_CANVAS_MODULE to a local @napi-rs/canvas installation, as for preview-exports.ts. */
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {discoveryCards,discoveryImagePath} from '../src/discovery-sharing';
import {drawDiscoveryImage,SHARE_IMAGE_WIDTH,SHARE_IMAGE_HEIGHT} from '../src/result-image';
const require=createRequire(import.meta.url);
const {createCanvas,Path2D,GlobalFonts}=require(process.env.KANJI_CANVAS_MODULE||'@napi-rs/canvas');
globalThis.Path2D=Path2D;
GlobalFonts.registerFromPath('assets/fonts/KanjiTowerDisplay-Heavy.ttf','TowerDisplay');
GlobalFonts.registerFromPath('assets/fonts/NotoSerifJP-Bold.ttf','Biz');
GlobalFonts.registerFromPath('assets/fonts/KanjiTowerImpact.ttf','TowerImpact');
fs.mkdirSync('public/kanji-cards',{recursive:true});
let bytes=0;
for(const card of discoveryCards){
  const canvas=createCanvas(SHARE_IMAGE_WIDTH,SHARE_IMAGE_HEIGHT);
  drawDiscoveryImage(canvas.getContext('2d'),card.char);
  const png=canvas.toBuffer('image/png');bytes+=png.length;
  fs.writeFileSync(`public/${discoveryImagePath(card.slug)}`,png);
}
console.log(`Generated ${discoveryCards.length} discovery cards (${Math.round(bytes/1024)} KB).`);
