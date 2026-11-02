import {kanji,recipes,color,byChar,rarityLabels,WILD,type Rarity} from './data';
import {isJoyo} from './data/joyo';
import type {Saved} from './storage';
import {actionIcon} from './icons';
import {titles,titleMet,titleProgress} from './titles';
type Tier='normal'|Rarity;
type SectionKey='joyo'|'nonJoyo'|Rarity;
const tierOf=(index:number):Tier=>kanji[index].rarity||'normal';
const sectionOf=(index:number):SectionKey=>kanji[index].rarity||(isJoyo(kanji[index].char)?'joyo':'nonJoyo');
const wildChip=(cls='')=>`<span class="kanji wild-chip ${cls}" role="img" aria-label="ボーナスはてな">？</span>`;
export const glyph=(char:string)=>{
  const k=byChar.get(char)!;
  if(k.wild)return wildChip();
  return `<span class="kanji${k.rarity?` metal metal-${k.rarity}`:''}" style="color:${color(char)}">${char}</span>`;
};
// Four sections: ordinary characters split into 常用 and 常用外, then rare and legend ones. Each section is sorted by stroke count.
// Keep the data indexes stable for selections; only the visible order/number changes.
export const collectionSections=(['joyo','nonJoyo','rare','legend'] as SectionKey[]).map(key=>({
  key,tier:(key==='joyo'||key==='nonJoyo'?'normal':key) as Tier,
  title:{joyo:'常用漢字',nonJoyo:'常用外漢字',rare:'レア漢字',legend:'レジェンド漢字'}[key],prefix:{joyo:'',nonJoyo:'外',rare:'R',legend:'L'}[key],
  indexes:kanji.map((_,index)=>index).filter(index=>!kanji[index].wild&&sectionOf(index)===key).sort((a,b)=>kanji[a].strokes-kanji[b].strokes||a-b),
}));
export const collectionOrder=collectionSections.flatMap(section=>section.indexes);
const collectionNumbers=new Map(collectionSections.flatMap(section=>section.indexes.map((index,position)=>[index,section.prefix+String(position+1).padStart(2,'0')] as const)));
export function moveCollectionIndex(index:number,offset:number){
  const position=collectionOrder.indexOf(index),length=collectionOrder.length;
  return collectionOrder[((position+offset)%length+length)%length];
}
const part=(char:string)=>char===WILD?wildChip('small'):char;
/** Every title as a badge: held ones lit, the rest grey with how far along they are. */
export function titleBadgesHTML(saved:Saved){
  return `<div class="title-row" aria-label="称号">${titles.map(t=>{
    const held=!!saved.titles[t.id]||titleMet(saved,t);
    return `<span class="title-badge rank-${t.rank}${held?' held':''}" title="${t.condition}">${t.name}${held?'':`<small>${titleProgress(saved,t)}/${t.chars.length}</small>`}</span>`;
  }).join('')}</div>`;
}
export function collectionHTML(saved:Saved,index:number){
  const found=(char:string)=>!!saved.collection[char]&&(saved.collection[char].drop>0||saved.collection[char].made>0);
  const k=kanji[index],isFound=found(k.char),rs=recipes.filter(r=>r.result===k.char),made=saved.collection[k.char]?.made||0;
  const cell=(i:number)=>{const k=kanji[i],tier=tierOf(i),number=collectionNumbers.get(i)!;return `<button class="collection-cell tier-${tier} ${index===i?'active':''}" data-action="entry" data-index="${i}" aria-pressed="${index===i}" aria-label="No.${number} ${found(k.char)?k.char:'未発見'}"><small>${number}</small>${tier==='normal'?'':`<span class="cell-tag">${tier==='rare'?'RARE':'LEGEND'}</span>`}${found(k.char)?glyph(k.char):'<span class="unknown">？</span>'}</button>`;};
  return `<div class="collection-top"><p class="collection-progress">${collectionSections.map(s=>`<span class="progress-tier tier-${s.tier}">${s.title} ${s.indexes.filter(i=>found(kanji[i].char)).length}<span> / ${s.indexes.length}</span></span>`).join('')}</p>${titleBadgesHTML(saved)}</div>
    <div class="collection-scroll">${collectionSections.map(s=>`<h4 class="collection-section tier-${s.tier}">${s.title}</h4><div class="collection-grid" role="group" aria-label="${s.title}（画数順）">${s.indexes.map(cell).join('')}</div>`).join('')}</div>
    <section class="detail" aria-label="選んだ漢字の説明" aria-live="polite">${isFound?`
      <div class="detail-heading">${glyph(k.char)}<div><h3>${k.char}<span class="tag">${k.strokes}画 · No.${collectionNumbers.get(index)}</span>${k.rarity?`<span class="rarity-tag tier-${k.rarity}">${rarityLabels[k.rarity]}</span>`:''}</h3><p class="detail-reading">${k.reading}</p></div></div>
      <p>${k.meaning}</p><p class="detail-words">${k.words}</p>
      <p class="detail-recipes">${rs.length?rs.map(r=>`${part(r.a)} ＋ ${part(r.b)} → ${r.result}${r.radical?`（${r.radical}）`:''}`).join(' ／ '):'基本の字'}</p>
      <div class="detail-actions">${rs.length?`<span class="made-count">合体 ${made}回</span>${made?`<button class="secondary discovery-share action-button x-share" data-action="share-kanji">${actionIcon('share')}<span>Xでシェア</span></button>`:'<span class="share-hint">作るとシェアできます</span>'}`:''}</div>
      `:`<div class="detail-unfound"><span class="kanji unknown">？</span><h3>まだ見つかっていない漢字</h3></div>`}</section>`;
}
