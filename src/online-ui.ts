import { beginSession, getScores, onlineEnabled, reportGame, submitScore, type OnlineScore } from './online';
import type { RecordEntry } from './storage';
import { MetricRankings } from './ranking-cache';
import {metricLabels,metricUnits,metricValue,rankingMetrics,type RankingMetric} from './ranking';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export class OnlineUI {
  run=0;moves=0;session:string|null=null;result:RecordEntry|null=null;pending=false;sending=false;rank=0;ranks:Partial<Record<RankingMetric,number>>={};error='';name='';
  constructor(public changed:()=>void){}
  private rankings=new MetricRankings(getScores,()=>this.changed());
  get metric(){return this.rankings.metric;}
  selectMetric(metric:RankingMetric){this.rankings.metric=metric;this.changed();void this.load();}
  reset(){this.run++;this.moves=0;this.session=null;this.result=null;this.rank=0;this.ranks={};this.error='';this.pending=false;this.sending=false;}
  start(){this.reset();const id=this.run;this.pending=onlineEnabled;
    void beginSession().then(session=>{if(id!==this.run)return;this.session=session;this.pending=false;this.changed();});}
  finish(result:RecordEntry){this.result=result;if(this.session)void reportGame(this.session,result.duration,this.moves);}
  async load(){if(onlineEnabled)await this.rankings.load();}
  async submit(){if(!this.session||!this.result||this.sending||this.rank)return;this.sending=true;this.error='';this.changed();try{const r=await submitScore(this.session,this.name,this.result,this.moves);this.rank=r.rank;this.ranks=r.ranks||{score:r.rank};}catch(e){this.error=(e as Error).message;}finally{this.sending=false;this.changed();}}
  resultHTML(){if(!onlineEnabled)return '<p>全国ランキングは接続準備中です。</p>';
    if(this.pending)return '<p>全国ランキングの接続を確認しています…</p>';
    if(!this.session)return '<p>今回は全国ランキングに接続できませんでした。端末の記録は保存されています。</p>';
    if(this.rank)return `<p class="result-rank">全国ランキングに登録しました！<br>${rankingMetrics.filter(m=>this.ranks[m]).map(m=>`${metricLabels[m]} 第${this.ranks[m]}位`).join('・')}</p>`;
    return `<div class="online-entry"><label for="ranking-name">全国ランキングに記録する</label><input id="ranking-name" maxlength="24" placeholder="名前（1〜12文字）" value="${esc(this.name)}" autocomplete="off" aria-label="ランキングに載せる名前"><p>名前・得点・高さ・字数・日時を90日間公開します。本名や連絡先は入力しないでください。</p><button class="secondary" data-action="online-submit" ${this.sending?'disabled':''}>${this.sending?'送信中…':'この名前で送信する'}</button>${this.error?`<p class="notice" role="status">${esc(this.error)}</p>`:''}</div>`;
  }
  rankingHTML(){if(!onlineEnabled)return '<div class="empty"><b>全国ランキングは接続準備中です</b></div>';
    const {value,loading,failed}=this.rankings.current,scores:OnlineScore[]=value?.scores||[],metric=this.metric;
    if(loading)return '<div class="empty" role="status">記録を読み込んでいます…</div>';
    if(failed)return '<div class="empty"><p>通信できませんでした。しばらく待ってからお試しください。</p><button class="secondary" data-action="online-refresh">もう一度読み込む</button></div>';
    if(!scores.length)return '<div class="empty"><b>最初の記録をつくろう。</b><p>プレイ終了後に名前を入力して参加できます。</p></div>';
    return `<div class="ranking-caption"><p>最近90日間 · 上位100件</p><button class="small-btn" data-action="online-refresh" aria-label="全国ランキングを更新">↻</button></div><table class="ranking"><thead><tr><th>順位</th><th>名前</th><th>${metricLabels[metric]}</th></tr></thead><tbody>${scores.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.name)}</td><td class="ranking-value">${metricValue(r,metric)}<small>${metricUnits[metric]}</small></td></tr>`).join('')}</tbody></table>`;
  }
}
