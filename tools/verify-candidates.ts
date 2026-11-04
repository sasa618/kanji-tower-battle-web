import fs from 'node:fs';
import {baseChars,chooseCandidates,createCandidateHistory,recipeFor} from '../src/data';
const runs=10000;
const cases=[[],['仁'],['木','日','月'],['木','日','寸'],['女','子','好','村','岩']].map(tower=>{
  let seed=20261018;const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/2**32;};
  const history=createCandidateHistory(),matches=[0,0,0,0];
  for(let i=0;i<runs;i++)matches[chooseCandidates(tower,random,history).filter(a=>tower.some(b=>recipeFor(a,b))).length]++;
  return {tower,runs,matches,appearances:Object.fromEntries(baseChars.map(char=>[char,history.shown.get(char)||0]))};
});
fs.writeFileSync('docs/candidate-report.json',JSON.stringify({date:new Date().toISOString(),note:'Base character appearances are balanced globally. Merge partners have a 1.5 weight only among equally due characters; no fixed matching/non-matching quotas.',cases},null,2));
console.log(cases.map(({tower,matches})=>({tower,matches})));
