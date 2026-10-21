import test from 'node:test';
import assert from 'node:assert/strict';
import {kanji,color,renderColor} from '../src/data';

const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const luminance=(hex:string)=>rgb(hex).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);

test('equal stroke counts have identical colors across DOM and exported glyphs',()=>{
  const groups=new Map<number,string>();
  for(const k of kanji){
    const value=color(k.char);assert.match(value,/^#[0-9a-f]{6}$/);
    assert.equal(value,renderColor(k.char));
    if(groups.has(k.strokes))assert.equal(value,groups.get(k.strokes),k.char);
    groups.set(k.strokes,value);
  }
});

test('vivid colors keep stage contrast and the dense character tiers are darker',()=>{
  const groups=new Map(kanji.map(k=>[k.strokes,color(k.char)]));
  const tiers=[...groups].sort(([a],[b])=>a-b);
  for(const [strokes,value] of tiers){
    const light=luminance(value);
    // Gameplay glyphs use the requested bright fills; this is not a UI-text contrast target.
    assert.ok(1.05/(light+.05)>=2,`${strokes} strokes need contrast on white`);
  }
  // Early hues stay vivid rather than dulling red/orange just to order every luminance.
  const darkCount=Math.ceil(tiers.length/3),bright=tiers.slice(0,-darkCount),dark=tiers.slice(-darkCount);
  let previous=Math.min(...bright.map(([,value])=>luminance(value)));
  for(const [strokes,value] of dark){
    const light=luminance(value);assert.ok(light<previous,`${strokes} strokes need a darker shade`);previous=light;
  }
});

test('the highest stroke tier is near black with very little tint',()=>{
  const max=Math.max(...kanji.map(k=>k.strokes));
  for(const k of kanji.filter(k=>k.strokes===max)){
    const channels=rgb(color(k.char)).map(v=>Math.round(v*255));
    assert.ok(Math.max(...channels)<=40,k.char);
    assert.ok(Math.max(...channels)-Math.min(...channels)<=8,k.char);
  }
});
