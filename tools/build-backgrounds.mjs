/** Set KANJI_CANVAS_MODULE to a local @napi-rs/canvas installation. */
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.KANJI_CANVAS_MODULE||'@napi-rs/canvas');
const root=new URL('../',import.meta.url);
const glyphs=JSON.parse(fs.readFileSync(new URL('src/data/glyphs.json',root),'utf8'));
const coordinates={M:['x','y'],L:['x','y'],Q:['x1','y1','x','y'],C:['x1','y1','x2','y2','x','y'],Z:[]};
function glyph(char,transform,ink){
  const commands=glyphs[char].commands.map(c=>c.type+coordinates[c.type].map(key=>c[key]).join(' ')).join(' ');
  return `<path data-kanji="${char}" d="${commands}" transform="${transform}" fill="url(#${ink}-ink)"/>`;
}
// Retain the original coral / violet / teal composition, with the ink fading
// inward so the kanji sit softly on the same white surface as the line motifs.
const inks=[['coral','#df3655',false],['violet','#6351ca',true],['teal','#087f83',false]];
const gradients=inks.map(([name,color,reverse])=>`
  <linearGradient id="${name}-ink" x1="${reverse?1:0}" x2="${reverse?0:1}" y2=".25">
    <stop offset="0" stop-color="${color}" stop-opacity=".105"/>
    <stop offset=".55" stop-color="${color}" stop-opacity=".075"/>
    <stop offset="1" stop-color="${color}" stop-opacity=".035"/>
  </linearGradient>`).join('');
const page=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="720" viewBox="0 0 640 720" fill="none">
  <defs>${gradients}
    <pattern id="dots" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="16" cy="16" r=".85" fill="#b7c2d5" opacity=".24"/></pattern>
  </defs>
  <path fill="url(#dots)" d="M0 0h640v720H0z"/>
  <g stroke="#6351ca" opacity=".12"><circle cx="615" cy="234" r="64" stroke-width="9"/><circle cx="615" cy="234" r="81" stroke-width="1.3"/></g>
  <circle cx="-22" cy="390" r="71" fill="#087f83" opacity=".025"/>
  <g stroke="#087f83" opacity=".12"><circle cx="-22" cy="390" r="86" stroke-width="10"/><circle cx="-22" cy="390" r="105" stroke-width="1.3"/></g>
  <g stroke="#df3655" opacity=".12"><circle cx="654" cy="704" r="84" stroke-width="12"/><circle cx="654" cy="704" r="106" stroke-width="1.3"/></g>
  <circle cx="388" cy="344" r="21" stroke="#df3655" stroke-width="2.5" opacity=".13"/>
  <rect x="349" y="594" width="50" height="50" rx="13" transform="rotate(14 374 619)" stroke="#087f83" stroke-width="1.5" opacity=".12"/>
  <path d="M398 92v12m-6-6h12" stroke="#6351ca" stroke-width="1.5" stroke-linecap="round" opacity=".16"/>
  <circle cx="280" cy="326" r="6" stroke="#ca951f" stroke-width="1.7" opacity=".18"/>
  ${glyph('木','translate(102 141) rotate(-8) scale(.96)','coral')}
  ${glyph('森','translate(497 503) rotate(7) scale(1.03)','teal')}
  ${glyph('日','translate(260 643) rotate(-7) scale(.78)','violet')}
</svg>\n`;
// Three large cropped circles lead the eye from upper right to middle left to
// lower right. Keep them clear of the kanji, using proportion-preserving edge
// viewports so phone layouts never stretch the circles or cover the tower.
const board=`<svg xmlns="http://www.w3.org/2000/svg" width="560" height="700" fill="none">
  <defs>${gradients}</defs>
  <svg x="0" y="15%" width="20%" height="23%" viewBox="0 0 112 160" preserveAspectRatio="xMinYMid meet">
    ${glyph('木','translate(46 80) rotate(-7) scale(.94)','coral')}
  </svg>
  <svg x="80%" y="8%" width="20%" height="24%" viewBox="0 0 112 168" preserveAspectRatio="xMaxYMid meet">
    <g stroke="#6351ca" opacity=".12"><circle cx="140" cy="84" r="64" stroke-width="9"/><circle cx="140" cy="84" r="82" stroke-width="1.3"/></g>
  </svg>
  <svg x="0" y="34%" width="23%" height="28%" viewBox="0 0 130 210" preserveAspectRatio="xMinYMid meet">
    <circle cx="-12" cy="105" r="63" fill="#087f83" opacity=".025"/>
    <g stroke="#087f83" opacity=".12"><circle cx="-12" cy="105" r="78" stroke-width="10"/><circle cx="-12" cy="105" r="97" stroke-width="1.3"/></g>
  </svg>
  <svg x="80%" y="44%" width="20%" height="24%" viewBox="0 0 112 168" preserveAspectRatio="xMaxYMid meet">
    ${glyph('林','translate(64 84) rotate(7) scale(.96)','violet')}
  </svg>
  <svg x="0" y="67%" width="22%" height="23%" viewBox="0 0 123 161" preserveAspectRatio="xMinYMid meet">
    ${glyph('森','translate(54 80) rotate(-6) scale(1.02)','teal')}
  </svg>
  <svg x="78%" y="82%" width="22%" height="18%" viewBox="0 0 123 126" preserveAspectRatio="xMaxYMax meet">
    <g stroke="#df3655" opacity=".12"><circle cx="144" cy="115" r="76" stroke-width="12"/><circle cx="144" cy="115" r="96" stroke-width="1.3"/></g>
  </svg>
  <svg x="88%" y="35%" width="8%" height="8%" viewBox="0 0 45 56">
    <path d="M22 22v12m-6-6h12" stroke="#6351ca" stroke-width="1.5" stroke-linecap="round" opacity=".17"/>
  </svg>
  <circle cx="93%" cy="73%" r="8" stroke="#ca951f" stroke-width="2" opacity=".18"/>
  <circle cx="8%" cy="9%" r="6" stroke="#df3655" stroke-width="1.5" opacity=".14"/>
  <circle cx="5%" cy="94%" r="4" stroke="#ca951f" stroke-width="1.5" opacity=".19"/>
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
