import { beginSession, getScores, loadRankingSnapshot, onlineEnabled, reportGame, submitScore, type OnlineScore, type RankingSnapshot } from './online';
import type { RecordEntry } from './storage';
import { MetricRankings } from './ranking-cache';
import {metricLabels,metricUnits,metricValue,rankLabel,rankingMetrics,type RankingMetric} from './ranking';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const nameKey='kanji-tower-ranking-name',cacheKey='kanji-tower-ranking-cache';
function savedName(){try{return (localStorage.getItem(nameKey)||'').slice(0,24);}catch{return '';}}
// The last list each metric showed stays on the device, so an outage (or the Worker's daily limit) still leaves something to read.
type Kept={scores:OnlineScore[];at:number};
const validScore=(r:unknown):r is OnlineScore=>!!r&&typeof (r as OnlineScore).name==='string'&&Number.isFinite((r as OnlineScore).score)&&Number.isFinite((r as OnlineScore).height)&&Number.isFinite((r as OnlineScore).count);
function keptScores():Partial<Record<RankingMetric,Kept>>{
  try{const raw=JSON.parse(localStorage.getItem(cacheKey)||'{}'),out:Partial<Record<RankingMetric,Kept>>={};
    for(const metric of rankingMetrics){const k=raw?.[metric];if(k&&Number.isFinite(k.at)&&Array.isArray(k.scores))out[metric]={at:k.at,scores:k.scores.filter(validScore).slice(0,100)};}
    return out;}catch{return {};}
}
function keepScores(metric:RankingMetric,scores:OnlineScore[]){try{const all=keptScores();all[metric]={scores:scores.slice(0,100),at:Date.now()};localStorage.setItem(cacheKey,JSON.stringify(all));}catch{}}
type Services={enabled:boolean;beginSession:typeof beginSession;getScores:typeof getScores;reportGame:typeof reportGame;submitScore:typeof submitScore;loadSnapshot?:()=>Promise<RankingSnapshot|null>};
const services:Services={enabled:onlineEnabled,beginSession,getScores,reportGame,submitScore,loadSnapshot:loadRankingSnapshot};
export class OnlineUI {
  run=0;moves=0;session:string|null=null;result:RecordEntry|null=null;pending=false;sending=false;rank=0;ranks:Partial<Record<RankingMetric,number>>={};error='';name=savedName();
  private latestRanks:Partial<Record<RankingMetric,number>>={};
  private rankings:MetricRankings<{scores:OnlineScore[]}>;
  private snapshot:RankingSnapshot|null|undefined;
  lateSending=false;lateError='';
  constructor(public changed:()=>void,private api:Services=services,private submitted:(r:RecordEntry)=>void=()=>{}){this.rankings=new MetricRankings(async metric=>{const r=await api.getScores(metric);keepScores(metric,r.scores);return r;},()=>this.changed());}
  get metric(){return this.rankings.metric;}
  selectMetric(metric:RankingMetric){this.rankings.metric=metric;this.changed();void this.load();}
  reset(){this.run++;this.moves=0;this.session=null;this.result=null;this.rank=0;this.ranks={};this.error='';this.pending=false;this.sending=false;}
  start(){this.reset();const id=this.run;this.pending=this.api.enabled;
    void this.api.beginSession().then(session=>{if(id!==this.run)return;this.session=session;this.pending=false;if(session&&this.result)void this.api.reportGame(session,this.result.duration,this.moves);this.changed();});}
  finish(result:RecordEntry){this.result=result;if(this.session)void this.api.reportGame(this.session,result.duration,this.moves);}
  async load(force=false){
    if(!this.api.enabled)return;
    await this.rankings.load(force);
    // The published daily copy is read once, and only after the live list could not be fetched.
    if(this.rankings.current.failed&&this.snapshot===undefined&&this.api.loadSnapshot){this.snapshot=await this.api.loadSnapshot().catch(()=>null);this.changed();}
  }
  /** The fresher of the device's last list and the published daily copy, for display while the Worker is unreachable. */
  fallbackFor(metric:RankingMetric):Kept|undefined{
    const kept=keptScores()[metric],published=this.snapshot?.scores?.[metric];
    const candidates=[kept,published?{scores:published.filter(validScore).slice(0,100),at:this.snapshot!.at}:undefined].filter((k):k is Kept=>!!k&&k.scores.length>0);
    return candidates.sort((a,b)=>b.at-a.at)[0];
  }
  async submit(){
    if(!this.session||!this.result||this.sending||this.rank)return;
    const run=this.run,name=this.name;this.sending=true;this.error='';this.changed();
    try{
      const r=await this.api.submitScore(this.session,name,this.result,this.moves);
      this.latestRanks=r.ranks||{score:r.rank};
      try{localStorage.setItem(nameKey,name);}catch{}
      this.result.submitted=true;this.submitted(this.result);
      if(run===this.run){this.rank=r.rank;this.ranks=this.latestRanks;}
    }catch(e){if(run===this.run)this.error=(e as Error).message;}
    finally{if(run===this.run){this.sending=false;this.changed();}}
  }
  /** A personal best kept on the device, from a play that could not reach the ranking, is sent with a fresh session. */
  async submitLate(best:RecordEntry){
    if(this.lateSending||best.submitted)return;
    this.lateSending=true;this.lateError='';this.changed();
    try{
      const session=await this.api.beginSession();
      if(!session)throw Error('全国ランキングに接続できませんでした。しばらく待ってからお試しください。');
      const r=await this.api.submitScore(session,this.name,best,best.moves??best.count+best.made.length,true);
      this.latestRanks=r.ranks||{score:r.rank};
      try{localStorage.setItem(nameKey,this.name);}catch{}
      best.submitted=true;this.submitted(best);
    }catch(e){this.lateError=(e as Error).message;}
    finally{this.lateSending=false;this.changed();}
  }
  lateEntryHTML(best?:RecordEntry){
    if(!this.api.enabled||!best||best.submitted||best.count===0)return '';
    return `<div class="online-entry late-entry"><label for="ranking-name">この自己ベストを全国ランキングに記録する</label><input id="ranking-name" maxlength="24" placeholder="名前（1〜12文字）" value="${esc(this.name)}" autocomplete="nickname" aria-label="ランキングに載せる名前"><p>ランキングに接続できなかったときの記録も送れます。登録日は送信した日になります。本名や連絡先は入力しないでください。</p><button class="secondary" data-action="online-submit-best" ${this.lateSending?'disabled':''}>${this.lateSending?'送信中…':this.lateError?'もう一度送信する':'この名前で送信する'}</button>${this.lateError?`<p class="notice" role="status">${esc(this.lateError)}</p>`:''}</div>`;
  }
  resultHTML(){if(!this.api.enabled)return '<p>全国ランキングは接続準備中です。</p>';
    if(this.pending)return '<p>全国ランキングの接続を確認しています…</p>';
    if(!this.session)return '<p>今回は全国ランキングに接続できませんでした。端末の記録は保存されています。自己ベストなら、あとで「記録」の画面から送れます。</p>';
    if(this.rank)return `<p class="result-rank">全国ランキングに登録しました！<br>${rankingMetrics.filter(m=>this.ranks[m]).map(m=>`${metricLabels[m]} ${rankLabel(this.ranks[m]!)}`).join('・')}</p><button class="secondary" data-action="ranking">全国ランキングで比べる</button>`;
    return `<div class="online-entry"><label for="ranking-name">全国ランキングに記録する</label><input id="ranking-name" maxlength="24" placeholder="名前（1〜12文字）" value="${esc(this.name)}" autocomplete="nickname" aria-label="ランキングに載せる名前"><p>名前・得点・高さ・字数・日時を90日間公開します。本名や連絡先は入力しないでください。送信した名前は次回も使えます。</p><button class="secondary" data-action="online-submit" ${this.sending?'disabled':''}>${this.sending?'送信中…':this.error?'もう一度送信する':'この名前で送信する'}</button>${this.error?`<p class="notice" role="status">${esc(this.error)} 同じ記録をもう一度送信できます。</p>`:''}</div>`;
  }
  rankingHTML(){if(!this.api.enabled)return '<div class="empty"><b>全国ランキングは接続準備中です</b></div>';
    const {value,loading,failed}=this.rankings.current,scores:OnlineScore[]=value?.scores||[],metric=this.metric;
    const own=this.latestRanks[metric],ownHTML=own?`<p class="result-rank">あなたの直近の送信時：${metricLabels[metric]} ${rankLabel(own)}</p>`:'';
    if(loading)return ownHTML+'<div class="empty" role="status">記録を読み込んでいます…</div>';
    const table=(rows:OnlineScore[])=>`<table class="ranking"><thead><tr><th>順位</th><th>名前</th><th>${metricLabels[metric]}</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.name)}</td><td class="ranking-value">${metricValue(r,metric)}<small>${metricUnits[metric]}</small></td></tr>`).join('')}</tbody></table>`;
    const refresh='<button class="small-btn" data-action="online-refresh" aria-label="全国ランキングを更新">↻</button>';
    if(failed){
      const old=this.fallbackFor(metric);
      if(old)return `${ownHTML}<div class="ranking-caption"><p class="ranking-stale"><small>以前に取得した一覧です。最近90日間 · 上位100件</small></p>${refresh}</div>${table(old.scores)}`;
      return ownHTML+'<div class="empty"><p>通信できませんでした。しばらく待ってからお試しください。</p><button class="secondary" data-action="online-refresh">もう一度読み込む</button></div>';
    }
    if(!scores.length)return ownHTML+(own?'<div class="empty"><p>送信した記録は数分以内に一覧へ反映されます。</p><button class="secondary" data-action="online-refresh">もう一度読み込む</button></div>':'<div class="empty"><b>最初の記録をつくろう。</b><p>プレイ終了後に名前を入力して参加できます。</p></div>');
    return `${ownHTML}<div class="ranking-caption"><p>最近90日間 · 上位100件<br><small>一覧への反映には数分かかる場合があります。</small></p>${refresh}</div>${table(scores)}`;
  }
}
