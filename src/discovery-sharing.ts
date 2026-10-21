import {byChar,recipes} from './data';
import {gameLink} from './sharing';

export const discoveryCards=[...new Set(recipes.map(r=>r.result))].map(char=>({
  char,slug:char.codePointAt(0)!.toString(16),strokes:byChar.get(char)!.strokes,
})).sort((a,b)=>a.strokes-b.strokes||a.slug.localeCompare(b.slug));
export const discoveryCard=(char:string)=>discoveryCards.find(card=>card.char===char);
export const discoveryImagePath=(slug:string)=>`kanji-cards/${slug}.png`;

export function discoveryShareURL(char:string,current:string,configured?:string):string|null{
  const card=discoveryCard(char);
  let base:string|null;try{base=gameLink(current,configured);}catch{return null;}
  if(!card||!base)return null;
  const game=new URL(base);game.pathname=game.pathname.replace(/index\.html$/,'');
  if(!game.pathname.endsWith('/'))game.pathname+='/';
  return new URL(`discovered/${card.slug}/`,game).href;
}
