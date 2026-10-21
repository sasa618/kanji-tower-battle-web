import fs from 'node:fs';
import {baseChars,chooseCandidates,createCandidateHistory,recipeFor} from '../src/data';
const runs=20000;
const cases=[[],['女'],['女','子','好','村','岩']].map(tower=>{
  let seed=20261018;const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/2**32;};
  const history=createCandidateHistory(),matches=[0,0,0,0];
  for(let i=0;i<runs;i++)matches[chooseCandidates(tower,random,history).filter(a=>tower.some(b=>recipeFor(a,b))).length]++;
  return {tower,runs,matches,appearances:Object.fromEntries(baseChars.map(char=>[char,history.shown.get(char)||0]))};
});
fs.writeFileSync('docs/candidate-report.json',JSON.stringify({date:new Date().toISOString(),note:'0/1/2 match targets at 25/50/25 percent when the tower has sufficient matching and non-matching base characters. Appearances are balanced within each pool.',cases},null,2));
console.log(cases.map(({tower,matches})=>({tower,matches})));
