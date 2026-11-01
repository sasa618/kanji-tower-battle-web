import {rankingMetrics,type RankingMetric} from './ranking';
// Explicit openings only. Manual refresh is throttled; failed reads retry sooner.
export class RankingCache<T> {
  value:T|undefined;
  expires=0;
  pending:Promise<T>|null=null;
  refreshAfter=0;
  constructor(private fetchValue:()=>Promise<T>,private now=()=>Date.now(),private ttl=60000){}
  get(force=false):Promise<T|undefined>{
    if(this.pending)return this.pending;
    if((!force&&this.now()<this.expires)||(force&&this.now()<this.refreshAfter))return Promise.resolve(this.value);
    this.refreshAfter=this.now()+5000;
    this.expires=this.now()+this.ttl;
    this.pending=this.fetchValue().then(value=>{this.value=value;return value;},error=>{this.expires=this.now()+15000;throw error;}).finally(()=>{this.pending=null;});
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
  async load(force=false){const state=this.states[this.metric];if(state.loading||(!force&&this.now()<state.cache.expires)||(force&&this.now()<state.cache.refreshAfter))return;
    state.loading=true;state.failed=false;this.changed();
    try{await state.cache.get(force);}catch{state.failed=true;}finally{state.loading=false;this.changed();}
  }
}
