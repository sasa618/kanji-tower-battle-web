export const rankingMetrics=['score','height','count'] as const;
export type RankingMetric=typeof rankingMetrics[number];
export type RankingStats={score:number;height:number;count:number};
export const metricLabels={score:'総画数',height:'高さ',count:'字数'};
export const metricUnits={score:'画',height:'字分',count:'字'};
export function isRankingMetric(value:unknown):value is RankingMetric{return rankingMetrics.some(metric=>metric===value);}
export function metricValue(stats:RankingStats,metric:RankingMetric){return metric==='height'?stats.height.toFixed(1):String(stats[metric]);}
export function compareMetric(a:RankingStats,b:RankingStats,metric:RankingMetric='score'){
  return b[metric]-a[metric]||b.score-a.score||b.height-a.height||b.count-a.count;
}
