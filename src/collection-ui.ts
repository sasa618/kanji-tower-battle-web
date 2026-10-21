import {kanji,recipes,color} from './data';
import type {Saved} from './storage';
import {actionIcon} from './icons';
const glyph=(char:string)=>`<span class="kanji" style="color:${color(char)}">${char}</span>`;
// Keep the data indexes stable for selections; only the visible order/number changes.
export const collectionOrder=kanji.map((_,index)=>index).sort((a,b)=>kanji[a].strokes-kanji[b].strokes||a-b);
const collectionNumbers=new Map(collectionOrder.map((index,position)=>[index,position+1]));
export function moveCollectionIndex(index:number,offset:number){
  const position=collectionOrder.indexOf(index),length=collectionOrder.length;
  return collectionOrder[((position+offset)%length+length)%length];
}
export function collectionHTML(saved:Saved,index:number){
  const found=(char:string)=>!!saved.collection[char]&&(saved.collection[char].drop>0||saved.collection[char].made>0);
  const k=kanji[index],isFound=found(k.char),rs=recipes.filter(r=>r.result===k.char),made=saved.collection[k.char]?.made||0;
  return `<p class="collection-progress">${kanji.filter(k=>found(k.char)).length}<span> / ${kanji.length}</span></p>
    <div class="collection-grid" role="group" aria-label="漢字一覧（画数順）">${collectionOrder.map((i,position)=>{const k=kanji[i],number=position+1;return `<button class="collection-cell ${index===i?'active':''}" data-action="entry" data-index="${i}" aria-pressed="${index===i}" aria-label="No.${number} ${found(k.char)?k.char:'未発見'}"><small>${String(number).padStart(2,'0')}</small>${found(k.char)?glyph(k.char):'<span class="unknown">？</span>'}</button>`;}).join('')}</div>
    <section class="detail" aria-label="選んだ漢字の説明" aria-live="polite">${isFound?`
      <div class="detail-heading">${glyph(k.char)}<div><h3>${k.char}<span class="tag">${k.strokes}画 · No.${collectionNumbers.get(index)}</span></h3><p class="detail-reading">${k.reading}</p></div></div>
      <p>${k.meaning}</p><p class="detail-words">${k.words}</p>
      <p class="detail-recipes">${rs.length?rs.map(r=>`${r.a} ＋ ${r.b} → ${r.result}${r.radical?`（${r.radical}）`:''}`).join(' ／ '):'基本の字'}</p>
      <div class="detail-actions">${rs.length?`<span class="made-count">合体 ${made}回</span>${made?`<button class="secondary discovery-share action-button x-share" data-action="share-kanji">${actionIcon('share')}<span>Xでシェア</span></button>`:'<span class="share-hint">作るとシェアできます</span>'}`:''}</div>
      `:`<div class="detail-unfound"><span class="kanji unknown">？</span><h3>まだ見つかっていない漢字</h3></div>`}</section>`;
}
