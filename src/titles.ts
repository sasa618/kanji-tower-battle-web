import {kanji,collectionKanji} from './data';
import {isJoyo} from './data/joyo';
import type {Saved} from './storage';
// Titles are earned by completing parts of the dictionary. Each is kept with the date it was first met,
// so a player who already had everything receives it, with the ceremony, on the next visit.
export type TitleId='joyo'|'nonJoyo'|'classic'|'master'|'trueMaster';
export type Title={id:TitleId;name:string;rank:number;condition:string;chars:string[]};
// The 107 characters of the version published before the 215-character expansion (2026-11-01).
const CLASSIC='木日月人口水火林森明朋昌休回困沓炎徊沐唱東晶焚囚一土田子女力心目言寸立山石好男岩相信畑加思音意村寺時詩侍想二三本大天仁王且付仙吐因団如位体肘里妬泣冒品待架胃討崩淡棚棟暗億談憶臆奻姦全助呈旺咽姻査埋恩理黒童栓詮墨憧瞳';
const ordinary=collectionKanji.filter(k=>!k.rarity).map(k=>k.char);
export const titles:Title[]=[
  {id:'joyo',name:'常用漢字マスター',rank:1,condition:'常用漢字をすべて見つける',chars:ordinary.filter(isJoyo)},
  {id:'nonJoyo',name:'常用外漢字マスター',rank:1,condition:'常用外漢字をすべて見つける',chars:ordinary.filter(c=>!isJoyo(c))},
  {id:'classic',name:'旧・漢字タワーバトルマスター',rank:2,condition:'最初の107字をすべて見つける',chars:[...CLASSIC].filter(c=>kanji.some(k=>k.char===c))},
  {id:'master',name:'漢字タワーバトルマスター',rank:3,condition:'レア・レジェンド以外の漢字をすべて見つける',chars:ordinary},
  {id:'trueMaster',name:'真・漢字タワーバトルマスター',rank:4,condition:'すべての漢字を見つける',chars:collectionKanji.map(k=>k.char)},
];
export const titleById=new Map(titles.map(t=>[t.id,t]));
export const found=(saved:Saved,char:string)=>{const e=saved.collection[char];return !!e&&(e.drop>0||e.made>0);};
export const titleProgress=(saved:Saved,title:Title)=>title.chars.filter(c=>found(saved,c)).length;
export const titleMet=(saved:Saved,title:Title)=>title.chars.length>0&&title.chars.every(c=>found(saved,c));
/** Records every title whose condition is met and not yet held; returns the newly earned ones, in rank order. */
export function awardTitles(saved:Saved,now=new Date()):Title[]{
  const earned:Title[]=[];
  for(const title of titles){
    if(saved.titles[title.id]||!titleMet(saved,title))continue;
    saved.titles[title.id]=now.toISOString();earned.push(title);
  }
  return earned;
}
/** The held title to show first: the highest rank, then the most recently earned. */
export function bestTitle(saved:Saved):Title|undefined{
  return titles.filter(t=>saved.titles[t.id]).sort((a,b)=>b.rank-a.rank||saved.titles[b.id].localeCompare(saved.titles[a.id]))[0];
}
