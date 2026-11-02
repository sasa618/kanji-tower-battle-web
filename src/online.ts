import type { RecordEntry } from './storage';
import { newId } from './id';
import type { RankingMetric } from './ranking';
import { Backoff, isOutageStatus } from './backoff';
export type OnlineScore={name:string;score:number;height:number;count:number;created:number};
export type SubmitResult={rank:number;ranks?:Partial<Record<RankingMetric,number>>};
const API=(import.meta.env?.VITE_RANKING_API as string|undefined)?.replace(/\/$/,'')||'';
export const onlineEnabled=!!API,apiOrigin=API;
export function clientId(){try{let id=localStorage.getItem('kanji-tower-client');if(!id){id=newId();localStorage.setItem('kanji-tower-client',id);}return id;}catch{return newId();}}
// One gate for every request: after an outage the whole client pauses, from 15 seconds up to 10 minutes.
export const outage=new Backoff();
// Why the last request failed. Cloudflare answers its daily limit with a 429 that carries no CORS headers, so the
// browser reports it as a network error; one that happens while the device is online is treated as the limit.
export type OutageKind='limit'|'network'|'';
let outageKind:OutageKind='';
// Cleared by the next answer from the Worker, so the pause stays visible for longer than one backoff window.
export const lastOutage=()=>outageKind;
export const LIMIT_MESSAGE='全国ランキングはアクセス数の制限により一時停止中です。';
const networkKind=(e:unknown):OutageKind=>e instanceof Error&&e.name==='TimeoutError'?'network':navigator.onLine===false?'network':'limit';
const waitMessage=()=>outageKind==='limit'?LIMIT_MESSAGE:`通信できませんでした。${Math.ceil(outage.wait()/1000)}秒ほど待ってからお試しください。`;
// JSON travels as text/plain, a CORS-safelisted type, so browsers send no preflight request.
const post=(body:unknown)=>({method:'POST',body:JSON.stringify(body)});
async function call<T>(path:string,body?:unknown,timeout=6000):Promise<T>{
  if(!API)throw Error('全国ランキングは接続準備中です。');
  if(outage.wait()>0)throw Error(waitMessage());
  let response:Response;
  try{response=await fetch(API+path,{...(body?post(body):{method:'GET'}),signal:AbortSignal.timeout(timeout)});}
  catch(e){outageKind=networkKind(e);outage.fail();throw Error(outageKind==='limit'?LIMIT_MESSAGE:e instanceof Error&&e.name==='TimeoutError'?'通信に時間がかかりすぎました。電波の良い場所でもう一度お試しください。':'通信できませんでした。');}
  // 429 is the Worker's own limit; 503 is what it answers when D1 has reached its daily allowance.
  if(isOutageStatus(response.status)){outageKind=response.status===429||response.status===503?'limit':'network';outage.fail(Number(response.headers.get('Retry-After'))||undefined);}else{outageKind='';outage.succeed();}
  let result:{error?:string}&T;try{result=await response.json();}catch{throw Error(response.ok?'応答を読み取れませんでした。':'通信できませんでした。');}
  if(!response.ok)throw Error(result.error||'通信できませんでした。');return result;
}
export async function beginSession(){try{return (await call<{session:string}>('/sessions',{client:clientId()})).session;}catch{return null;}}
export const getScores=(metric:RankingMetric='score')=>call<{scores:OnlineScore[]}>(`/scores?metric=${metric}`);
// late: a result kept on the device from a play that had no session (the ranking was unavailable at the time).
export const submitScore=(session:string,name:string,result:RecordEntry,moves:number,late=false)=>call<SubmitResult>('/scores',{session,name,score:result.score,height:result.height,count:result.count,duration:result.duration,moves,...(late?{late:true}:{})});
// One anonymous usage report per play: session, play seconds and drops. No name, score or device ID.
export async function reportGame(session:string,duration:number,moves:number){
  if(!API||outage.wait()>0)return;
  try{const response=await fetch(API+'/events',{...post({session,duration:Math.round(duration*10)/10,moves}),keepalive:true});if(isOutageStatus(response.status)){outageKind=response.status===429||response.status===503?'limit':'network';outage.fail();}}
  catch(e){outageKind=networkKind(e);outage.fail();/* statistics never affect play */}
}
export type RankingSnapshot={at:number;scores:Record<RankingMetric,OnlineScore[]>};
// A daily copy published with the game itself (tools/fetch-ranking-snapshot.mjs), readable while the Worker is over its free-tier limit.
export async function loadRankingSnapshot():Promise<RankingSnapshot|null>{
  try{
    const response=await fetch(`${import.meta.env?.BASE_URL||'./'}ranking-snapshot.json`,{cache:'no-cache'});
    if(!response.ok)return null;
    const data=await response.json();return Number.isFinite(data?.at)&&data?.scores?data:null;
  }catch{return null;}
}
// Uploads carry about 200KB, so a slow mobile connection gets more time than a ranking read.
export const createResultShare=(result:RecordEntry,image:string)=>call<{url:string}>('/shares',{client:clientId(),record:result.id,score:result.score,height:result.height,count:result.count,image},20000);
// Links issued by another server (for example a LAN preview) are not reused against the public API.
export const ownShareLink=(url:string|undefined):url is string=>!!url&&!!API&&url.startsWith(API+'/s/');
