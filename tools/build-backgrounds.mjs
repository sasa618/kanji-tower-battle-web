/** Set KANJI_CANVAS_MODULE to a local @napi-rs/canvas installation. */
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {Path2D,createCanvas,loadImage}=require(process.env.KANJI_CANVAS_MODULE||'@napi-rs/canvas');
const root=new URL('../',import.meta.url);
const glyphs=JSON.parse(fs.readFileSync(new URL('src/data/glyphs.json',root),'utf8'));
const coordinates={M:['x','y'],L:['x','y'],Q:['x1','y1','x','y'],C:['x1','y1','x2','y2','x','y'],Z:[]};
const letters=[['木',48,40],['林',192,120],['森',48,200],['日',192,280],['月',48,360],['明',192,440]];
const paths=letters.map(([char,x,y])=>{
  const commands=glyphs[char].commands.map(c=>c.type+coordinates[c.type].map(key=>c[key]).join(' ')).join(' ');
  // Merge overlapping font strokes before outlining, so intersections don't
  // leave distracting construction lines inside each decorative character.
  const outline=new Path2D(commands).simplify().toSVGString();
  return `<path data-kanji="${char}" d="${outline}" transform="translate(${x} ${y}) scale(.58)"/>`;
}).join('\n');
// One upright, evenly spaced print replaces independently colored decorations.
const motif=`<pattern id="kanji-print" width="288" height="480" patternUnits="userSpaceOnUse">
  <g fill="none" stroke="#b4a4a4" stroke-width="1.8" stroke-linejoin="round">${paths}</g>
</pattern>`;
const page=`<svg xmlns="http://www.w3.org/2000/svg" width="288" height="480" viewBox="0 0 288 480" fill="none">
  <defs>${motif}</defs>
  <path fill="url(#kanji-print)" opacity=".4" d="M0 0h288v480H0z"/>
</svg>\n`;
// No viewBox: the print keeps its proportions instead of stretching to fit a
// phone's aspect ratio. Percentage masks clear the centre, top controls and base.
const board=`<svg xmlns="http://www.w3.org/2000/svg" width="560" height="700" fill="none">
  <defs>${motif}
    <linearGradient id="edges">
      <stop stop-color="white"/>
      <stop offset=".12" stop-color="white" stop-opacity=".65"/>
      <stop offset=".3" stop-color="white" stop-opacity="0"/>
      <stop offset=".7" stop-color="white" stop-opacity="0"/>
      <stop offset=".88" stop-color="white" stop-opacity=".65"/>
      <stop offset="1" stop-color="white"/>
    </linearGradient>
    <linearGradient id="ends" x2="0" y2="1">
      <stop stop-color="white" stop-opacity="0"/>
      <stop offset=".18" stop-color="white"/>
      <stop offset=".88" stop-color="white"/>
      <stop offset="1" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    <mask id="edge-print"><rect fill="url(#edges)" width="100%" height="100%"/></mask>
    <mask id="end-print"><rect fill="url(#ends)" width="100%" height="100%"/></mask>
  </defs>
  <g mask="url(#edge-print)"><rect mask="url(#end-print)" fill="url(#kanji-print)" opacity=".38" width="100%" height="100%"/></g>
</svg>\n`;
fs.writeFileSync(new URL('public/ui-background.svg',root),page);
fs.writeFileSync(new URL('public/board-background.svg',root),board);

// Standalone asset previews; these do not render or inspect the game's UI.
const paper=createCanvas(640,720),p=paper.getContext('2d');
p.fillStyle='#fffefa';p.fillRect(0,0,640,720);
p.fillStyle=p.createPattern(await loadImage(Buffer.from(page)),'repeat');p.fillRect(0,0,640,720);
fs.writeFileSync(new URL('docs/background-preview.png',root),paper.toBuffer('image/png'));
for(const [w,h,name] of [[560,700,'board-background-preview'],[360,500,'board-background-mobile-preview']]){
  const art=board.replace('width="560" height="700"',`width="${w}" height="${h}"`);
  const canvas=createCanvas(w,h),ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(await loadImage(Buffer.from(art)),0,0);
  fs.writeFileSync(new URL(`docs/${name}.png`,root),canvas.toBuffer('image/png'));
}
console.log(`Background SVGs: ${Buffer.byteLength(page)} + ${Buffer.byteLength(board)} bytes`);
