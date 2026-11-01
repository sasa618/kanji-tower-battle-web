import { beginSession, getScores, onlineEnabled, reportGame, submitScore, type OnlineScore } from './online';
import type { RecordEntry } from './storage';
import { MetricRankings } from './ranking-cache';
import {metricLabels,metricUnits,metricValue,rankLabel,rankingMetrics,type RankingMetric} from './ranking';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const nameKey='kanji-tower-ranking-name';
function savedName(){try{return (localStorage.getItem(nameKey)||'').slice(0,24);}catch{return '';}}
const services={enabled:onlineEnabled,beginSession,getScores,reportGame,submitScore};
export class OnlineUI {
  run=0;moves=0;session:string|null=null;result:RecordEntry|null=null;pending=false;sending=false;rank=0;ranks:Partial<Record<RankingMetric,number>>={};error='';name=savedName();
  private latestRanks:Partial<Record<RankingMetric,number>>={};
  private rankings:MetricRankings<{scores:OnlineScore[]}>;
  constructor(public changed:()=>void,private api=services){this.rankings=new MetricRankings(api.getScores,()=>this.changed());}
  get metric(){return this.rankings.metric;}
  selectMetric(metric:RankingMetric){this.rankings.metric=metric;this.changed();void this.load();}
  reset(){this.run++;this.moves=0;this.session=null;this.result=null;this.rank=0;this.ranks={};this.error='';this.pending=false;this.sending=false;}
  start(){this.reset();const id=this.run;this.pending=this.api.enabled;
    void this.api.beginSession().then(session=>{if(id!==this.run)return;this.session=session;this.pending=false;if(session&&this.result)void this.api.reportGame(session,this.result.duration,this.moves);this.changed();});}
  finish(result:RecordEntry){this.result=result;if(this.session)void this.api.reportGame(this.session,result.duration,this.moves);}
  async load(force=false){if(this.api.enabled)await this.rankings.load(force);}
  async submit(){
    if(!this.session||!this.result||this.sending||this.rank)return;
    const run=this.run,name=this.name;this.sending=true;this.error='';this.changed();
    try{
      const r=await this.api.submitScore(this.session,name,this.result,this.moves);
      this.latestRanks=r.ranks||{score:r.rank};
      try{localStorage.setItem(nameKey,name);}catch{}
      if(run===this.run){this.rank=r.rank;this.ranks=this.latestRanks;}
    }catch(e){if(run===this.run)this.error=(e as Error).message;}
    finally{if(run===this.run){this.sending=false;this.changed();}}
  }
  resultHTML(){if(!this.api.enabled)return '<p>全国ランキングは接続準備中です。</p>';
    if(this.pending)return '<p>全国ランキングの接続を確認しています…</p>';
    if(!this.session)return '<p>今回は全国ランキングに接続できませんでした。端末の記録は保存されています。</p>';
    if(this.rank)return `<p class="result-rank">全国ランキングに登録しました！<br>${rankingMetrics.filter(m=>this.ranks[m]).map(m=>`${metricLabels[m]} ${rankLabel(this.ranks[m]!)}`).join('・')}</p><button class="secondary" data-action="ranking">全国ランキングで比べる</button>`;
    return `<div class="online-entry"><label for="ranking-name">全国ランキングに記録する</label><input id="ranking-name" maxlength="24" placeholder="名前（1〜12文字）" value="${esc(this.name)}" autocomplete="nickname" aria-label="ランキングに載せる名前"><p>名前・得点・高さ・字数・日時を90日間公開します。本名や連絡先は入力しないでください。送信した名前は次回も使えます。</p><button class="secondary" data-action="online-submit" ${this.sending?'disabled':''}>${this.sending?'送信中…':this.error?'もう一度送信する':'この名前で送信する'}</button>${this.error?`<p class="notice" role="status">${esc(this.error)} 同じ記録をもう一度送信できます。</p>`:''}</div>`;
  }
  rankingHTML(){if(!this.api.enabled)return '<div class="empty"><b>全国ランキングは接続準備中です</b></div>';
    const {value,loading,failed}=this.rankings.current,scores:OnlineScore[]=value?.scores||[],metric=this.metric;
    const own=this.latestRanks[metric],ownHTML=own?`<p class="result-rank">あなたの直近の送信時：${metricLabels[metric]} ${rankLabel(own)}</p>`:'';
    if(loading)return ownHTML+'<div class="empty" role="status">記録を読み込んでいます…</div>';
    if(failed)return ownHTML+'<div class="empty"><p>通信できませんでした。しばらく待ってからお試しください。</p><button class="secondary" data-action="online-refresh">もう一度読み込む</button></div>';
    if(!scores.length)return ownHTML+(own?'<div class="empty"><p>送信した記録は数分以内に一覧へ反映されます。</p><button class="secondary" data-action="online-refresh">もう一度読み込む</button></div>':'<div class="empty"><b>最初の記録をつくろう。</b><p>プレイ終了後に名前を入力して参加できます。</p></div>');
    return `${ownHTML}<div class="ranking-caption"><p>最近90日間 · 上位100件<br><small>一覧への反映には数分かかる場合があります。</small></p><button class="small-btn" data-action="online-refresh" aria-label="全国ランキングを更新">↻</button></div><table class="ranking"><thead><tr><th>順位</th><th>名前</th><th>${metricLabels[metric]}</th></tr></thead><tbody>${scores.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.name)}</td><td class="ranking-value">${metricValue(r,metric)}<small>${metricUnits[metric]}</small></td></tr>`).join('')}</tbody></table>`;
  }
}
