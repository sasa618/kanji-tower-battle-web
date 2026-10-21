import type { D1Database } from '@cloudflare/workers-types';
import { validateSubmission } from './validation';
import {isRankingMetric,rankingMetrics,type RankingMetric} from '../src/ranking';
import {MAX_SHARE_BYTES,saveShare,serveShare,shareUsage} from './shares';
export interface Env {DB:D1Database;ALLOWED_ORIGINS:string;GAME_URL?:string;SHARE_STORAGE_LIMIT_BYTES?:string}
const DAY=86400000,RANKING_DAYS=90;
// The same order decides the published list, its ties, and the rank returned right after a submission.
const metricOrder:Record<RankingMetric,[string,string,string]>={score:['score','height','count'],height:['height','score','count'],count:['count','score','height']};
export const orderBy=(metric:RankingMetric)=>metricOrder[metric].map(c=>`${c} DESC`).join(',')+',created ASC';
export async function rankOf(db:D1Database,metric:RankingMetric,row:{score:number;height:number;count:number;created:number},since:number){
  const [a,b,c]=metricOrder[metric],v=(name:string)=>row[name as 'score'|'height'|'count'];
  const result=await db.prepare(`SELECT COUNT(*)+1 AS rank FROM scores WHERE created>? AND (${a}>? OR (${a}=? AND ${b}>?) OR (${a}=? AND ${b}=? AND ${c}>?) OR (${a}=? AND ${b}=? AND ${c}=? AND created<?))`)
    .bind(since,v(a),v(a),v(b),v(a),v(b),v(c),v(a),v(b),v(c),row.created).first<{rank:number}>();
  return result?.rank||1;
}
export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const origin=request.headers.get('Origin')||'',allowed=env.ALLOWED_ORIGINS.split(',').map(s=>s.trim()).filter(Boolean);
    const headers:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    if(allowed.includes(origin)){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='GET,POST,OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type';headers['Access-Control-Max-Age']='86400';}
    const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(origin&&!allowed.includes(origin))return json({error:'この公開先からは接続できません。'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    const url=new URL(request.url),path=url.pathname,now=Date.now(),since=now-DAY*RANKING_DAYS;
    try{
      if(path.startsWith('/s/')&&['GET','HEAD'].includes(request.method))return await serveShare(request,env);
      if(path==='/health'&&request.method==='GET')return json({ok:true,shares:await shareUsage(env)});
      if(path==='/scores'&&request.method==='GET'){
        const metric=url.searchParams.get('metric')||'score';
        if(!isRankingMetric(metric))return json({error:'ランキングの種類を確認してください。'},400);
        // One snapshot per metric and edge location; CORS is applied per response. The cache is a no-op on workers.dev.
        const cache=(globalThis.caches as (CacheStorage & {default?:Cache})|undefined)?.default;
        const key=new Request(new URL(`/__ranking-snapshot-v2/${metric}`,request.url));
        const cached=await cache?.match(key);
        headers['Cache-Control']='public, max-age=300';
        if(cached)return new Response(cached.body,{headers});
        const result=await env.DB.prepare(`SELECT name,score,height,count,created FROM scores WHERE created>? ORDER BY ${orderBy(metric)} LIMIT 100`).bind(since).all();
        const body=JSON.stringify({scores:result.results});
        if(cache)await cache.put(key,new Response(body,{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=60'}}));
        return new Response(body,{headers});
      }
      if(request.method!=='POST'||!origin)return json({error:'この操作は利用できません。'},405);
      if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON形式で送信してください。'},415);
      // Bound the stream as well as Content-Length; clients can omit the latter.
      const bodyLimit=path==='/shares'?MAX_SHARE_BYTES+1024:4096;
      if(Number(request.headers.get('Content-Length')||0)>bodyLimit)return json({error:'送信内容が大きすぎます。'},413);
      const reader=request.body?.getReader();let bytes=0;const chunks:Uint8Array[]=[];
      if(reader)while(true){const item=await reader.read();if(item.done)break;bytes+=item.value.length;if(bytes>bodyLimit){await reader.cancel();return json({error:'送信内容が大きすぎます。'},413);}chunks.push(item.value);}
      const merged=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.length;}
      let data:Record<string,unknown>;try{data=JSON.parse(new TextDecoder().decode(merged));}catch{return json({error:'送信内容を読み取れません。'},400);}
      if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'送信内容を確認してください。'},400);
      if(path==='/shares'){const result=await saveShare(data,env,url.origin);return json(result.body,result.status);}
      if(path==='/sessions'){
        if(typeof data?.client!=='string'||!/^[0-9a-f-]{36}$/.test(data.client))return json({error:'端末情報を確認できません。'},400);
        const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.client));const tag=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
        const id=crypto.randomUUID();
        // One atomic statement prevents parallel requests bypassing the limit.
        const inserted=await env.DB.prepare(`INSERT INTO sessions(id,client,created)
          SELECT ?,?,? WHERE (SELECT COUNT(*) FROM sessions WHERE client=? AND created>?)<100
          AND NOT EXISTS(SELECT 1 FROM sessions WHERE client=? AND created>?)`).bind(id,tag,now,tag,now-DAY,tag,now-3000).run();
        if(!inserted.meta.changes)return json({error:'少し待ってからもう一度遊んでください。'},429);
        await env.DB.prepare('DELETE FROM sessions WHERE created<?').bind(now-DAY*2).run();
        return json({session:id},201);
      }
      if(path==='/scores'){
        let score;try{score=validateSubmission(data);}catch(e){return json({error:(e as Error).message},400);}
        const session=await env.DB.prepare('SELECT created,client FROM sessions WHERE id=?').bind(score.session).first<{created:number;client:string}>();
        if(!session||now-session.created>DAY)return json({error:'プレイ情報の期限が切れました。もう一度遊んでください。'},400);
        if(score.duration>(now-session.created)/1000+5||now-session.created<300)return json({error:'プレイ時間を確認できません。'},400);
        const id=crypto.randomUUID();
        // UNIQUE(session_id) blocks double submission; the per-minute limit sits in the same statement so parallel requests cannot pass it.
        const inserted=await env.DB.prepare(`INSERT OR IGNORE INTO scores(id,session_id,name,score,height,count,duration,created)
          SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM scores JOIN sessions ON scores.session_id=sessions.id WHERE sessions.client=? AND scores.created>?)<6`)
          .bind(id,score.session,score.name,score.score,score.height,score.count,score.duration,now,session.client,now-60000).run();
        if(!inserted.meta.changes){
          const previous=await env.DB.prepare('SELECT id FROM scores WHERE session_id=?').bind(score.session).first();
          return json({error:previous?'この記録は送信済みです。':'送信回数の上限です。1分ほど待ってください。'},previous?409:429);
        }
        const ranks={} as Record<RankingMetric,number>;
        for(const metric of rankingMetrics)ranks[metric]=await rankOf(env.DB,metric,{...score,created:now},since);
        await env.DB.prepare('DELETE FROM scores WHERE created<?').bind(since).run();
        return json({rank:ranks.score,ranks},201);
      }
      return json({error:'見つかりません。'},404);
    }catch{headers['Cache-Control']='no-store';return json({error:'全国ランキングは一時的に利用できません。端末の記録は残っています。'},503);}
  }
};
