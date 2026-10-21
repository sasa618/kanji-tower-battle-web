import type { RecordEntry } from './storage';
import { newId } from './id';
import type { RankingMetric } from './ranking';
export type OnlineScore={name:string;score:number;height:number;count:number;created:number};
export type SubmitResult={rank:number;ranks?:Partial<Record<RankingMetric,number>>};
const API=(import.meta.env?.VITE_RANKING_API as string|undefined)?.replace(/\/$/,'')||'';
export const onlineEnabled=!!API,apiOrigin=API;
export function clientId(){try{let id=localStorage.getItem('kanji-tower-client');if(!id){id=newId();localStorage.setItem('kanji-tower-client',id);}return id;}catch{return newId();}}
async function call<T>(path:string,body?:unknown,timeout=6000):Promise<T>{
  if(!API)throw Error('全国ランキングは接続準備中です。');
  let response:Response;
  try{response=await fetch(API+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout)});}
  catch(e){throw Error(e instanceof Error&&e.name==='TimeoutError'?'通信に時間がかかりすぎました。電波の良い場所でもう一度お試しください。':'通信できませんでした。');}
  let result:{error?:string}&T;try{result=await response.json();}catch{throw Error(response.ok?'応答を読み取れませんでした。':'通信できませんでした。');}
  if(!response.ok)throw Error(result.error||'通信できませんでした。');return result;
}
export async function beginSession(){try{return (await call<{session:string}>('/sessions',{client:clientId()})).session;}catch{return null;}}
export const getScores=(metric:RankingMetric='score')=>call<{scores:OnlineScore[]}>(`/scores?metric=${metric}`);
export const submitScore=(session:string,name:string,result:RecordEntry,moves:number)=>call<SubmitResult>('/scores',{session,name,score:result.score,height:result.height,count:result.count,duration:result.duration,moves});
// Uploads carry about 200KB, so a slow mobile connection gets more time than a ranking read.
export const createResultShare=(result:RecordEntry,image:string)=>call<{url:string}>('/shares',{client:clientId(),record:result.id,score:result.score,height:result.height,count:result.count,image},20000);
// Links issued by another server (for example a LAN preview) are not reused against the public API.
export const ownShareLink=(url:string|undefined):url is string=>!!url&&!!API&&url.startsWith(API+'/s/');
