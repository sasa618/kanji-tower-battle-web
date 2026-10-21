import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';
import earcut from 'earcut';
import polygonClipping from 'polygon-clipping';

const root = path.resolve(import.meta.dirname, '..');
const font = opentype.loadSync(path.join(root, 'assets/fonts/NotoSerifJP-Bold.ttf'));
const data = JSON.parse(fs.readFileSync(path.join(root, 'src/data/kanji.json'), 'utf8'));
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
const area = p => p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
const same = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]) < 1e-6;
function clean(p) {
  p = p.filter((v,i) => !same(v,p[(i+1)%p.length]));
  let changed=true;
  while(changed && p.length>3) { changed=false; for(let i=0;i<p.length;i++) {
    if(Math.abs(cross(p[(i+p.length-1)%p.length],p[i],p[(i+1)%p.length]))<1e-7){p.splice(i,1);changed=true;break;}
  }}
  return area(p)<0?p.reverse():p;
}
function inside(q,p) { let yes=false; for(let i=0,j=p.length-1;i<p.length;j=i++){
  if((p[i][1]>q[1])!==(p[j][1]>q[1]) && q[0]<(p[j][0]-p[i][0])*(q[1]-p[i][1])/(p[j][1]-p[i][1])+p[i][0])yes=!yes;
} return yes; }
function distance(p,a,b) { const dx=b[0]-a[0],dy=b[1]-a[1];const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy); }
const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
function simplifyLine(points,tolerance){
  if(points.length<=2)return points;
  let farthest=0,index=0;
  for(let i=1;i<points.length-1;i++){const d=distance(points[i],points[0],points.at(-1));if(d>farthest){farthest=d;index=i;}}
  if(farthest<=tolerance)return [points[0],points.at(-1)];
  return [...simplifyLine(points.slice(0,index+1),tolerance).slice(0,-1),...simplifyLine(points.slice(index),tolerance)];
}
function simplifyRing(p){
  let split=1;for(let i=2;i<p.length;i++)if(Math.hypot(p[i][0]-p[0][0],p[i][1]-p[0][1])>Math.hypot(p[split][0]-p[0][0],p[split][1]-p[0][1]))split=i;
  return clean([...simplifyLine(p.slice(0,split+1),.35).slice(0,-1),...simplifyLine([...p.slice(split),p[0]],.35).slice(0,-1)]);
}
function flatten(points,out,depth=0) {
  if(depth>15 || points.slice(1,-1).every(p=>distance(p,points[0],points.at(-1))<=0.18)){out.push(points.at(-1));return;}
  const levels=[points];while(levels.at(-1).length>1){const last=levels.at(-1);levels.push(last.slice(1).map((_,i)=>mid(last[i],last[i+1])));}
  flatten(levels.map(l=>l[0]),out,depth+1);flatten(levels.map(l=>l.at(-1)).reverse(),out,depth+1);
}
function join(a,b) {
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
    if(!same(a[i],b[(j+1)%b.length])||!same(a[(i+1)%a.length],b[j]))continue;
    const poly=[];for(let k=1;k<=a.length;k++)poly.push(a[(i+k)%a.length]);
    for(let k=2;k<b.length;k++)poly.push(b[(j+k)%b.length]);
    const p=clean(poly);if(p.length>=3 && p.length<=8 && area(p)>1e-7 && p.every((v,k)=>cross(v,p[(k+1)%p.length],p[(k+2)%p.length])>=-1e-7))return p;
  }return null;
}
const glyphs={};
for(const {char} of data){
  const glyph=font.charToGlyph(char);if(!glyph.index)throw Error(`Missing glyph: ${char}`);
  const p=glyph.getPath(0,0,80),bounds=p.getBoundingBox();const ox=(bounds.x1+bounds.x2)/2,oy=(bounds.y1+bounds.y2)/2;
  let contours=[],current=[],cursor=[0,0];
  for(const c of p.commands){
    const end=[c.x,c.y];
    if(c.type==='M'){if(current.length)contours.push(clean(current));current=[end];cursor=end;}
    else if(c.type==='L'){current.push(end);cursor=end;}
    else if(c.type==='Q'){flatten([cursor,[c.x1,c.y1],end],current);cursor=end;}
    else if(c.type==='C'){flatten([cursor,[c.x1,c.y1],[c.x2,c.y2],end],current);cursor=end;}
    else if(c.type==='Z'){if(current.length)contours.push(clean(current));current=[];}
  }if(current.length)contours.push(clean(current));
  contours=contours.filter(c=>c.length>=3).map(c=>c.map(([x,y])=>[x-ox,y-oy]));
  // User-authorized filled internal counters: keep only outermost contours.
  const outlines=contours.filter((c,i)=>!contours.some((b,j)=>i!==j && Math.abs(area(b))>Math.abs(area(c)) && c.every(v=>inside(v,b))));
  // Serif fonts may draw a closed counter using overlapping stroke contours.
  // Unite strokes first, then fill the enclosed counters in the physical shape.
  const united=polygonClipping.union(...outlines.map(p=>[p])).map(p=>simplifyRing(clean(p[0])));
  const outer=polygonClipping.union(...united.map(p=>[p])).map(p=>clean(p[0]));
  const parts=[];
  for(const outline of outer){const indices=earcut(outline.flat());let polys=[];
    for(let i=0;i<indices.length;i+=3){const triangle=clean(indices.slice(i,i+3).map(n=>outline[n]));if(triangle.length>=3&&area(triangle)>1e-7)polys.push(triangle);}
    let progress=true;while(progress){progress=false;loop:for(let i=0;i<polys.length;i++)for(let j=i+1;j<polys.length;j++){const merged=join(polys[i],polys[j]);if(merged){polys[i]=merged;polys.splice(j,1);progress=true;break loop;}}}
    parts.push(...polys);
  }
  const expected=outer.reduce((s,c)=>s+area(c),0),actual=parts.reduce((s,c)=>s+area(c),0);
  if(Math.abs(actual-expected)>0.01)throw Error(`Area mismatch: ${char}`);
  if(parts.some(p=>p.length>8 || p.length<3 || area(p)<1e-7))throw Error(`Invalid fixture: ${char}`);
  const commands=p.commands.map(c=>Object.fromEntries(Object.entries(c).map(([k,v])=>[k,typeof v==='number'?+(v-(k.startsWith('x')?ox:oy)).toFixed(4):v])));
  glyphs[char]={commands,parts:parts.map(p=>p.map(v=>v.map(n=>+n.toFixed(4)))),bounds:{minX:bounds.x1-ox,minY:bounds.y1-oy,maxX:bounds.x2-ox,maxY:bounds.y2-oy},area:actual,contours:outer.length};
}
fs.writeFileSync(path.join(root,'src/data/glyphs.json'),JSON.stringify(glyphs));
const report=Object.entries(glyphs).map(([char,g])=>({char,fixtures:g.parts.length,vertices:g.parts.reduce((n,p)=>n+p.length,0),area:+g.area.toFixed(2)}));
fs.mkdirSync(path.join(root,'docs'),{recursive:true});fs.writeFileSync(path.join(root,'docs/glyph-report.json'),JSON.stringify(report,null,2));
console.log(`Generated ${report.length} glyphs, max ${Math.max(...report.map(r=>r.fixtures))} fixtures. Exact font paths; 0.18px curve + 0.35px polygon tolerance; enclosed holes filled for physics.`);
