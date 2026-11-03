import {byChar,rarityLabels,rarityOf} from './data';
export function gameLink(current:string,configured?:string):string|null {
  const url=new URL(configured||current);
  const local=/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)||['localhost','[::1]'].includes(url.hostname)||url.hostname.endsWith('.local');
  if(!['https:','http:'].includes(url.protocol)||local)return null;
  url.search='';url.hash='';return url.href;
}
export function tweetLink(text:string,playURL:string|null):string {
  const url=new URL('https://twitter.com/intent/tweet');
  url.searchParams.set('text',text);
  if(playURL)url.searchParams.set('url',playURL);
  return url.href;
}
// Rare and legend characters announce their tier before the character.
export const discoveryText=(char:string)=>{const rarity=rarityOf(char);return `合体！漢字タワーバトルで${rarity?`【${rarityLabels[rarity]}】`:''}「${char}」を作った！\n#漢字タワーバトル`;};
// X counts most CJK characters as two and every URL as 23. Trim the created-character list before anything else,
// dropping the characters with the fewest strokes first.
export const X_TEXT_LIMIT=280,X_URL_WEIGHT=23;
export function xLength(text:string){let n=0;for(const ch of text)n+=ch.codePointAt(0)!<=0x10ff?1:2;return n;}
export type ResultSummary={score:number;height:number;count:number;made:string[]};
export function resultText(r:ResultSummary,limit=X_TEXT_LIMIT-X_URL_WEIGHT-1){
  const all=[...r.made].sort((a,b)=>(byChar.get(b)?.strokes||0)-(byChar.get(a)?.strokes||0));
  const text=(made:string[])=>`合体！漢字タワーバトルで総画数${r.score}（高さ${r.height.toFixed(1)}字分・${r.count}字）！${made.length?' 作った字：'+made.join(' ')+(made.length<all.length?` ほか${all.length-made.length}字`:''):''}\n#漢字タワーバトル`;
  for(let n=all.length;n>0;n--){const candidate=text(all.slice(0,n));if(xLength(candidate)<=limit)return candidate;}
  return text([]);
}
