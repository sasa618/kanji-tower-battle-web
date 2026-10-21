import {rankingMetrics,type RankingMetric} from './ranking';
// Explicit openings only. A failed request also observes the cooldown.
export class RankingCache<T> {
  value:T|undefined;
  expires=0;
  pending:Promise<T>|null=null;
  constructor(private fetchValue:()=>Promise<T>,private now=()=>Date.now(),private ttl=300000){}
  get():Promise<T|undefined>{
    if(this.pending)return this.pending;
    if(this.now()<this.expires)return Promise.resolve(this.value);
    this.expires=this.now()+this.ttl;
    this.pending=this.fetchValue().then(value=>{this.value=value;return value;}).finally(()=>{this.pending=null;});
    return this.pending;
  }
}

export class MetricRankings<T> {
  metric:RankingMetric='score';
  private states:Record<RankingMetric,{cache:RankingCache<T>;loading:boolean;failed:boolean}>;
  constructor(fetchValue:(metric:RankingMetric)=>Promise<T>,private changed:()=>void,private now=()=>Date.now()){
    this.states=Object.fromEntries(rankingMetrics.map(metric=>[metric,{cache:new RankingCache(()=>fetchValue(metric),now),loading:false,failed:false}])) as typeof this.states;
  }
  get current(){const s=this.states[this.metric];return {value:s.cache.value,loading:s.loading,failed:s.failed};}
  async load(){const state=this.states[this.metric];if(state.loading||this.now()<state.cache.expires)return;
    state.loading=true;state.failed=false;this.changed();
    try{await state.cache.get();}catch{state.failed=true;}finally{state.loading=false;this.changed();}
  }
}
