export type Submission={session:string;name:string;score:number;height:number;count:number;duration:number;moves:number};
export function validateSubmission(input:unknown):Submission {
  if(!input||typeof input!=='object')throw Error('記録の形式を確認してください。');
  const v=input as Submission;
  if(typeof v.session!=='string'||!/^[0-9a-f-]{36}$/.test(v.session))throw Error('プレイ情報がありません。もう一度遊んでください。');
  if(typeof v.name!=='string')throw Error('名前を入力してください。');
  const name=v.name.normalize('NFKC').trim();
  if([...name].length<1||[...name].length>12||!/^\p{L}[\p{L}\p{N} _ー・-]*$/u.test(name)||/(死ね|殺す|くたばれ|fuck|shit)/i.test(name))throw Error('名前は文字で始まる1〜12文字で入力してください。');
  if(!Number.isInteger(v.score)||v.score<0||v.score>2080||!Number.isInteger(v.count)||v.count<0||v.count>160||!Number.isInteger(v.moves)||v.moves<1||v.moves>10000)throw Error('記録が範囲外です。');
  if(!Number.isFinite(v.height)||v.height<0||v.height>v.count*1.5+.5||!Number.isFinite(v.duration)||v.duration<.3||v.duration>86400)throw Error('高さまたはプレイ時間を確認できません。');
  if(v.score<v.count||v.score>v.count*13||v.count>v.moves||v.score>v.moves*8||v.duration<Math.max(.3,(v.moves-1)*.25))throw Error('得点とプレイ内容が一致しません。');
  if(v.count===0&&(v.score!==0||v.height!==0))throw Error('空の塔の記録が一致しません。');
  return {...v,name};
}
