import kanjiData from './kanji.json';
import recipeData from './recipes.json';
export type Kanji = { char: string; strokes: number; base?: boolean; hue: number; reading: string; meaning: string; words: string };
export type Recipe = { a: string; b: string; result: string; radical?: string; kind?: string };
export const kanji: Kanji[] = kanjiData;
export const recipes: Recipe[] = recipeData;
export const byChar = new Map(kanji.map((k, i) => [k.char, { ...k, no: i + 1 }]));
export const baseChars = kanji.filter(k => k.base).map(k => k.char);
const key = (a: string, b: string) => [a, b].sort().join('|');
const recipeMap = new Map(recipes.map(r => [key(r.a, r.b), r]));
export const recipeFor = (a: string, b: string) => recipeMap.get(key(a, b));
// Saturated warm colors, green, blue, navy and purple, ending in near black.
// Keep early tiers vivid; reserve navy, purple and near black for dense characters.
// Interpolate in linear RGB for any future stroke tiers between the palette anchors.
// Use the same sRGB value for DOM, canvas and exported images.
const minStrokes=Math.min(...kanji.map(k=>k.strokes));
const maxStrokes=Math.max(...kanji.map(k=>k.strokes));
const strokePalette=[
  '#ff9a00','#ff681a','#ff3048','#ff6500','#4ab800','#00b896',
  '#009bff','#244bff','#5318ef','#7300d6','#6500b0','#440070','#18141b',
].map(hex=>[1,3,5].map(i=>{
  const channel=parseInt(hex.slice(i,i+2),16)/255;
  return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;
}));
const renderColors=new Map<number,string>();
export const color=(char:string)=>renderColor(char);
export function renderColor(char:string){
  const strokes=byChar.get(char)!.strokes;
  const cached=renderColors.get(strokes);if(cached)return cached;
  const progress=Math.min(1,Math.max(0,(strokes-minStrokes)/Math.max(1,maxStrokes-minStrokes)));
  const position=progress*(strokePalette.length-1),index=Math.min(strokePalette.length-2,Math.floor(position));
  const blend=position-index;
  const values=strokePalette[index].map((channel,i)=>channel+(strokePalette[index+1][i]-channel)*blend);
  const result='#'+values.map(n=>Math.round(255*Math.max(0,Math.min(1,n<=.0031308?12.92*n:1.055*n**(1/2.4)-.055))).toString(16).padStart(2,'0')).join('');
  renderColors.set(strokes,result);return result;
}
export function shuffled<T>(items: T[], random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export type CandidateHistory = { shown:Map<string,number>; previous:string[] };
export const createCandidateHistory=():CandidateHistory=>({shown:new Map(),previous:[]});
/** Vary actionable choices between zero, one and two (25/50/25 percent).
 * Balance appearances within each pool; never force a candidate's own partner. */
export function chooseCandidates(tower:string[],random=Math.random,history=createCandidateHistory()):string[] {
  const chosen:string[]=[];
  const pick=(pool:string[])=>{
    const available=pool.filter(char=>!chosen.includes(char));
    const count=(char:string)=>history.shown.get(char)||0;
    const minimum=Math.min(...available.map(count));
    const leastShown=available.filter(char=>count(char)===minimum);
    const fresh=leastShown.filter(char=>!history.previous.includes(char));
    const options=fresh.length?fresh:leastShown;
    const char=options[Math.floor(random()*options.length)];
    chosen.push(char);history.shown.set(char,count(char)+1);
  };
  const partners=baseChars.filter(a=>tower.some(b=>recipeFor(a,b)));
  const others=baseChars.filter(char=>!partners.includes(char));
  const roll=random(),wanted=roll<.25?0:roll<.75?1:2;
  // Some towers have fewer partners, or too few non-partners for three choices.
  const matches=Math.min(partners.length,Math.max(3-others.length,wanted));
  for(let i=0;i<matches;i++)pick(partners);
  while(chosen.length<3)pick(others);
  history.previous=[...chosen];
  return shuffled(chosen,random);
}
