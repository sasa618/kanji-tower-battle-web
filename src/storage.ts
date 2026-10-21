import type { Stats,TowerSnapshot } from './physics';
import {compareMetric,rankingMetrics,type RankingMetric} from './ranking';
export type Entry = { drop:number; made:number };
export type RecordEntry = Stats & { id:string; date:string; made:string[]; duration:number; tower?:TowerSnapshot; shareURL?:string };
export type Saved = { version:1; collection:Record<string,Entry>; records:RecordEntry[]; bests:Partial<Record<RankingMetric,RecordEntry>>; muted:boolean; music:number; effects:number };
const KEY='kanji-tower-v1';
const defaults=():Saved=>({version:1,collection:{},records:[],bests:{},muted:false,music:.15,effects:.45});
const validRecord=(r:RecordEntry)=>r&&typeof r.id==='string'&&typeof r.date==='string'&&Number.isFinite(r.score)&&r.score>=0&&Number.isFinite(r.height)&&r.height>=0&&Number.isInteger(r.count)&&r.count>=0&&Array.isArray(r.made);
function keepBests(saved:Saved,entry:RecordEntry){for(const metric of rankingMetrics){const best=saved.bests[metric];if(!best||compareMetric(entry,best,metric)<0)saved.bests[metric]=entry;}}
export function load():Saved {
  try { const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(!raw||raw.version!==1)return defaults();
    const out=defaults();out.muted=raw.muted===true;
    for(const key of ['music','effects'] as const)if(Number.isFinite(raw[key]))out[key]=Math.max(0,Math.min(1,raw[key]));
    if(raw.collection && typeof raw.collection==='object')for(const [char,v] of Object.entries(raw.collection)){const e=v as Entry;if(e&&Number.isInteger(e.drop)&&e.drop>=0&&Number.isInteger(e.made)&&e.made>=0)out.collection[char]={drop:e.drop,made:e.made};}
    if(Array.isArray(raw.records))for(const entry of raw.records.filter(validRecord)){keepBests(out,entry);out.records.push(entry);}
    out.records.sort(compareRecords).splice(10);
    if(raw.bests&&typeof raw.bests==='object')for(const metric of rankingMetrics){const entry=raw.bests[metric];if(validRecord(entry))keepBests(out,entry);}
    return out;
  }catch{return defaults();}
}
export function save(s:Saved) {try{localStorage.setItem(KEY,JSON.stringify(s));return true;}catch{return false;}}
export function compareRecords(a:Stats,b:Stats){return compareMetric(a,b);}
export function recordResult(saved:Saved,entry:RecordEntry){keepBests(saved,entry);saved.records=[...saved.records,entry].sort(compareRecords).slice(0,10);return saved.records.findIndex(r=>r.id===entry.id)+1;}
