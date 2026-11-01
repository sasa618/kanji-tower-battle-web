import type { D1Database } from '@cloudflare/workers-types';
import { validateSubmission } from './validation';
import {isRankingMetric,rankingMetrics,RANK_LIMIT,type RankingMetric} from '../src/ranking';
import {MAX_SHARE_BYTES,saveShare,serveShare,shareUsage} from './shares';
import {Snapshot} from './snapshot';
export interface Env {DB:D1Database;ALLOWED_ORIGINS:string;GAME_URL?:string;SHARE_STORAGE_LIMIT_BYTES?:string}
const DAY=86400000,RANKING_DAYS=90;
const snapshots=new WeakMap<D1Database,Map<RankingMetric,Snapshot<string>>>();
// The same order decides the published list, its ties, and the rank returned right after a submission.
const metricOrder:Record<RankingMetric,[string,string,string]>={score:['score','height','count'],height:['height','score','count'],count:['count','score','height']};
// Usage statistics are grouped by the Japanese calendar day (UTC+9).
export const jstDay=(ms:number)=>new Date(ms+9*3600000).toISOString().slice(0,10);
export const orderBy=(metric:RankingMetric)=>metricOrder[metric].map(c=>`${c} DESC`).join(',')+',created ASC';
export async function rankOf(db:D1Database,metric:RankingMetric,row:{score:number;height:number;count:number;created:number},since:number){
  const [a,b,c]=metricOrder[metric],v=(name:string)=>row[name as 'score'|'height'|'count'];
  // Counting stops at RANK_LIMIT rows, so a submission reads at most that many rows; RANK_LIMIT+1 means "below".
  const result=await db.prepare(`SELECT COUNT(*)+1 AS rank FROM (SELECT 1 FROM scores WHERE created>? AND (${a}>? OR (${a}=? AND ${b}>?) OR (${a}=? AND ${b}=? AND ${c}>?) OR (${a}=? AND ${b}=? AND ${c}=? AND created<?)) LIMIT ?)`)
    .bind(since,v(a),v(a),v(b),v(a),v(b),v(c),v(a),v(b),v(c),row.created,RANK_LIMIT).first<{rank:number}>();
  return result?.rank||1;
}
export default {
  async scheduled(_event:unknown,env:Env){
    const now=Date.now();
    // Indexed retention runs hourly, never on the path that saves a player's result.
    await env.DB.prepare('DELETE FROM sessions WHERE created<?').bind(now-DAY*2).run();
    await env.DB.prepare('DELETE FROM scores WHERE created<?').bind(now-DAY*RANKING_DAYS).run();
  },
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
      if(path==='/stats'&&request.method==='GET'){
        // Anonymous daily aggregates only: finished games, summed play seconds, drops. No names or scores.
        const days=await env.DB.prepare('SELECT day,games,seconds,drops FROM daily_stats WHERE day>=? ORDER BY day DESC').bind(jstDay(now-DAY*30)).all<{day:string;games:number;seconds:number;drops:number}>();
        const total=await env.DB.prepare('SELECT COUNT(*) AS days,COALESCE(SUM(games),0) AS games,COALESCE(SUM(seconds),0) AS seconds,COALESCE(SUM(drops),0) AS drops FROM daily_stats').first();
        headers['Cache-Control']='public, max-age=300';
        return json({days:days.results,total});
      }
      if(path==='/scores'&&request.method==='GET'){
        const metric=url.searchParams.get('metric')||'score';
        if(!isRankingMetric(metric))return json({error:'ランキングの種類を確認してください。'},400);
        let metrics=snapshots.get(env.DB);
        if(!metrics){metrics=new Map();snapshots.set(env.DB,metrics);}
        let snapshot=metrics.get(metric);
        if(!snapshot){snapshot=new Snapshot(async()=>{
          const cache=(globalThis.caches as (CacheStorage & {default?:Cache})|undefined)?.default;
          const key=new Request(new URL(`/__ranking-snapshot-v3/${metric}`,request.url));
          // A cache failure must never turn a working database into a failed ranking.
          try{const cached=await cache?.match(key);if(cached)return await cached.text();}catch{}
          const result=await env.DB.prepare(`SELECT name,score,height,count,created FROM scores WHERE created>? ORDER BY ${orderBy(metric)} LIMIT 100`).bind(Date.now()-DAY*RANKING_DAYS).all();
          const body=JSON.stringify({scores:result.results});
          try{await cache?.put(key,new Response(body,{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=60'}}));}catch{}
          return body;
        });metrics.set(metric,snapshot);}
        const body=await snapshot.get();
        // Browsers retain their own one-minute snapshot; intermediary caches are not required.
        headers['Cache-Control']='no-store';
        return new Response(body,{headers});
      }
      if(request.method!=='POST'||!origin)return json({error:'この操作は利用できません。'},405);
      // text/plain is accepted so that the game can post JSON without a CORS preflight; the Origin check above still applies.
      if(!/^(application\/json|text\/plain)\b/.test(request.headers.get('Content-Type')||''))return json({error:'JSON形式で送信してください。'},415);
      // Bound the stream as well as Content-Length; clients can omit the latter.
      const bodyLimit=path==='/shares'?MAX_SHARE_BYTES+1024:4096;
      if(Number(request.headers.get('Content-Length')||0)>bodyLimit)return json({error:'送信内容が大きすぎます。'},413);
      const reader=request.body?.getReader();let bytes=0;const chunks:Uint8Array[]=[];
      if(reader)while(true){const item=await reader.read();if(item.done)break;bytes+=item.value.length;if(bytes>bodyLimit){await reader.cancel();return json({error:'送信内容が大きすぎます。'},413);}chunks.push(item.value);}
      const merged=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.length;}
      let data:Record<string,unknown>;try{data=JSON.parse(new TextDecoder().decode(merged));}catch{return json({error:'送信内容を読み取れません。'},400);}
      if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'送信内容を確認してください。'},400);
      if(path==='/shares'){const result=await saveShare(data,env,url.origin);return json(result.body,result.status);}
      if(path==='/events'){
        const {session,duration,moves}=data as {session?:unknown;duration?:unknown;moves?:unknown};
        if(typeof session!=='string'||!/^[0-9a-f-]{36}$/.test(session)||typeof duration!=='number'||!Number.isFinite(duration)||duration<0||duration>86400||!Number.isInteger(moves)||Number(moves)<0||Number(moves)>10000)return json({error:'集計の内容を確認できません。'},400);
        // Each play session is counted once; the flag flips in the same statement that authorizes the count.
        const marked=await env.DB.prepare('UPDATE sessions SET reported=1 WHERE id=? AND reported=0 AND created>?').bind(session,now-DAY).run();
        if(!marked.meta.changes)return json({error:'この記録は集計済みです。'},409);
        await env.DB.prepare(`INSERT INTO daily_stats(day,games,seconds,drops) VALUES(?,1,?,?)
          ON CONFLICT(day) DO UPDATE SET games=games+1,seconds=seconds+excluded.seconds,drops=drops+excluded.drops`).bind(jstDay(now),duration,moves).run();
        return new Response(null,{status:204,headers});
      }
      if(path==='/sessions'){
        if(typeof data?.client!=='string'||!/^[0-9a-f-]{36}$/.test(data.client))return json({error:'端末情報を確認できません。'},400);
        const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.client));const tag=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
        const id=crypto.randomUUID();
        // One atomic statement prevents parallel requests bypassing the limit.
        const inserted=await env.DB.prepare(`INSERT INTO sessions(id,client,created)
          SELECT ?,?,? WHERE (SELECT COUNT(*) FROM sessions WHERE client=? AND created>?)<100
          AND NOT EXISTS(SELECT 1 FROM sessions WHERE client=? AND created>?)`).bind(id,tag,now,tag,now-DAY,tag,now-3000).run();
        if(!inserted.meta.changes)return json({error:'少し待ってからもう一度遊んでください。'},429);
        return json({session:id},201);
      }
      if(path==='/scores'){
        let score;try{score=validateSubmission(data);}catch(e){return json({error:(e as Error).message},400);}
        const session=await env.DB.prepare('SELECT created,client FROM sessions WHERE id=?').bind(score.session).first<{created:number;client:string}>();
        if(!session||now-session.created>DAY)return json({error:'プレイ情報の期限が切れました。もう一度遊んでください。'},400);
        // A late submission has a fresh session, so its duration cannot be compared with the session age; the per-device limits still apply.
        if(!score.late&&(score.duration>(now-session.created)/1000+5||now-session.created<300))return json({error:'プレイ時間を確認できません。'},400);
        const id=crypto.randomUUID();
        // UNIQUE(session_id) blocks double submission; the per-minute limit sits in the same statement so parallel requests cannot pass it.
        const inserted=await env.DB.prepare(`INSERT OR IGNORE INTO scores(id,session_id,name,score,height,count,duration,created)
          SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM scores JOIN sessions ON scores.session_id=sessions.id WHERE sessions.client=? AND scores.created>?)<6`)
          .bind(id,score.session,score.name,score.score,score.height,score.count,score.duration,now,session.client,now-60000).run();
        if(!inserted.meta.changes){
          const previous=await env.DB.prepare('SELECT name,score,height,count,duration,created FROM scores WHERE session_id=?').bind(score.session).first<typeof score & {created:number}>();
          if(previous&&(['name','score','height','count','duration'] as const).every(key=>previous[key]===score[key])){
            const ranks={} as Record<RankingMetric,number>;
            for(const metric of rankingMetrics)ranks[metric]=await rankOf(env.DB,metric,previous,since);
            return json({rank:ranks.score,ranks},200);
          }
          return json({error:previous?'このプレイの記録は別の内容で送信済みです。':'送信回数の上限です。1分ほど待ってください。'},previous?409:429);
        }
        const ranks={} as Record<RankingMetric,number>;
        for(const metric of rankingMetrics)ranks[metric]=await rankOf(env.DB,metric,{...score,created:now},since);
        return json({rank:ranks.score,ranks},201);
      }
      return json({error:'見つかりません。'},404);
    }catch{headers['Cache-Control']='no-store';headers['Retry-After']='15';return json({error:'全国ランキングは一時的に利用できません。端末の記録は残っています。'},503);}
  }
};
