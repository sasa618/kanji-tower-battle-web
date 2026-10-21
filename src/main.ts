import './styles.css';
import './theme.css';
import { Game, glyphs, type TowerSnapshot } from './physics';
import { Renderer, drawGlyph } from './render';
import { kanji, byChar, recipes, color, recipeFor } from './data';
import { load, save, recordResult, type RecordEntry } from './storage';
import { Sound } from './audio';
import { OnlineUI } from './online-ui';
import { bindCanvasInput } from './input';
import { icon, actionIcon, swipeCue } from './icons';
import { helpHTML } from './help';
import { MoveHint } from './move-hint';
import { collectionHTML, collectionOrder, moveCollectionIndex } from './collection-ui';
import { isRankingMetric,metricLabels,metricUnits,metricValue,rankingMetrics } from './ranking';
import { newId } from './id';
import {drawResultImage,RESULT_IMAGE_WIDTH,RESULT_IMAGE_HEIGHT} from './result-image';
import { discoveryText, gameLink, resultText, tweetLink } from './sharing';
import {createResultShare,onlineEnabled,ownShareLink} from './online';
import {drawShareImage,SHARE_IMAGE_WIDTH,SHARE_IMAGE_HEIGHT} from './result-image';

// Switch back to true to restore live scores; recording and results stay active.
const showPlayStats=false;
const app=document.querySelector<HTMLDivElement>('#app')!;
const saved=load(),sound=new Sound();sound.muted=saved.muted;sound.music=saved.music;sound.effects=saved.effects;
const moveHint=new MoveHint();
const game=new Game();let renderer:Renderer|null=null;
const online=new OnlineUI(()=>{if(modal==='result'||modal==='ranking')renderModal();});
let screen:'home'|'game'|'lab'='home',modal='',returnMode=game.mode,collectionIndex=collectionOrder[0];
let lastTower:TowerSnapshot|null=null;
let lastResult:RecordEntry|null=null,lastFocus:HTMLElement|null=null,candidateSignature='',lastHud=0;
let shareBusy=false,shareMessage='',shareFallbackURL='';
const shareFeedback=()=>`<p class="share-status" role="status">${shareBusy?'共有画像を用意しています…':shareMessage}${shareFallbackURL?` <a class="action-button x-share" href="${shareFallbackURL.replaceAll('&','&amp;').replaceAll('"','&quot;')}" target="_blank" rel="noopener noreferrer">${actionIcon('share')}<span>Xの投稿画面を開く</span></a>`:''}</p>`;
const letter=(char:string,cls='')=>`<span class="kanji ${cls}" style="color:${color(char)}">${char}</span>`;
function persist(){if(!save(saved)&&!document.querySelector('.storage-warning')){const el=document.createElement('div');el.className='storage-warning';el.textContent='このブラウザでは記録を保存できません。今回のプレイは続けられます。';document.body.append(el);}}
function header(){return `<header class="header"><button class="brand" data-action="home" aria-label="タイトルに戻る"><span class="brand-mark"><img src="${import.meta.env.BASE_URL}icon.svg?v=wood-forest" alt="" width="44" height="44"></span><span class="brand-name"><span class="brand-prefix">合体！</span><span>漢字タワーバトル</span></span></button><nav class="nav" aria-label="メニュー"><button data-action="help" class="nav-help" aria-label="遊び方" title="遊び方">${icon('help')}</button><button data-action="collection">図鑑</button><button data-action="ranking">記録</button><button data-action="settings" class="icon-btn" aria-label="音と設定">${icon('settings')}</button></nav></header>`;}
function home(){return `<main class="home"><section class="hero-copy"><div class="title-tag">合体！</div><h1>漢字<span>タワーバトル</span></h1><button class="primary play-start" data-action="start">遊ぶ<span class="arrow">→</span></button><div class="home-actions"><button class="secondary" data-action="help">遊び方</button><button class="secondary soon" disabled>対戦 <span class="pill">準備中</span></button></div></section><section class="hero-art" aria-label="漢字の塔"><span class="art-glyph ki" style="color:${color('木')}">木</span><span class="art-glyph mori" style="color:${color('森')}">森</span><span class="art-glyph nichi" style="color:${color('日')}">日</span><span class="art-glyph tsuki" style="color:${color('月')}">月</span><div class="art-stage"></div></section></main><footer class="footer"><button data-action="about">このゲームについて</button></footer>`;}
function side(){return `<aside class="sidebar"><div class="side-top"><button class="small-btn" data-action="pause" aria-label="一時停止">${icon('pause')}</button><button class="small-btn" data-action="help" aria-label="遊び方">${icon('help')}</button></div><section class="side-section"><h3>合体</h3>${recipes.slice(0,6).map(r=>`<div class="recipe-row">${letter(r.a)} + ${letter(r.b)} → ${letter(r.result)}</div>`).join('')}</section><section class="side-section"><div class="chain">${['口','日','目','相','想'].map((s,i)=>`${i?'<i>→</i>':''}${letter(s)}`).join('')}</div></section></aside>`;}
function play(){return `<main class="play-layout"><section class="play-main" aria-label="ゲーム"><div class="scorebar"${showPlayStats?'':' hidden'}><div><div class="score-label">総画数</div><div class="score-main"><strong id="score">0</strong><small>画</small></div></div><div class="minor-stats"><div class="stat"><strong id="height">0.0</strong><small>高さ</small></div><div class="stat"><strong id="count">0</strong><small>文字</small></div></div></div><div class="board"><span class="board-status" id="status"></span><canvas id="game-canvas" aria-label="漢字を積むステージ。指やマウスで左右に動かし、離すと落下。盤面右上の回転ボタンで向きを変更。"></canvas><div class="board-controls"><div id="gesture-cue" class="gesture-cue" aria-hidden="true">${swipeCue}</div><div class="board-actions"><button class="rotate-candidate" data-action="rotate" aria-label="90度回転">${icon('rotate')}<span>回転</span></button><button class="mobile-pause" data-action="pause" aria-label="一時停止">${icon('pause')}</button></div></div></div><section class="candidate-tray" aria-label="次の漢字を選ぶ"><div class="choice-heading"><div class="choice-label">次の漢字を選ぶ<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></div></div><div class="choices" id="choices" aria-label="落とす字の候補"></div></section></section>${side()}</main>`;}

function render(){renderer=null;app.innerHTML=header()+(screen==='home'?home():screen==='game'?play():lab());
  if(screen==='game'){renderer=new Renderer(document.querySelector('#game-canvas')!,game);candidateSignature='';updateHud();wireCanvas();}
  if(screen==='lab')document.querySelectorAll<HTMLCanvasElement>('[data-glyph]').forEach(c=>{const ctx=c.getContext('2d')!;ctx.scale(2,2);drawGlyph(ctx,c.dataset.glyph!,50,50,0,.95,true);});
}
function lab(){return `<main class="lab"><div class="dialog-head"><h2>字形・当たり判定</h2><button data-action="home">×</button></div><p>フォントの輪郭をそのまま描画。赤線が物理演算の部品です。囲まれた穴は当たり判定のみ埋めています。</p><div class="lab-grid">${kanji.map(k=>`<div class="lab-glyph"><canvas width="200" height="200" data-glyph="${k.char}" aria-label="${k.char}の輪郭"></canvas><b>${k.char} · ${k.strokes}画</b>${glyphs[k.char].parts.length} 部品</div>`).join('')}</div></main>`;}
function updateHud(){if(screen!=='game')return;const s=game.stats();const score=document.querySelector<HTMLElement>('#score')!;score.textContent=String(s.score);score.dataset.long=String(s.score>=1000);document.querySelector('#height')!.textContent=s.height.toFixed(1);document.querySelector('#count')!.textContent=String(s.count);
  const ready=game.mode==='playing'&&game.ready;const cue=document.querySelector<HTMLElement>('#gesture-cue');if(cue)cue.hidden=!moveHint.visible(performance.now(),ready);document.querySelector('#status')!.textContent=game.mode==='over'?'':game.mode==='paused'?'一時停止':'';
  document.querySelectorAll<HTMLButtonElement>('.rotate-candidate').forEach(b=>b.disabled=!ready);
  const signature=game.candidates.join('')+game.selected+ready+game.tiles.length;
  if(signature!==candidateSignature){candidateSignature=signature;document.querySelector('#choices')!.innerHTML=game.candidates.map((char,i)=>{const match=game.tiles.some(t=>recipeFor(char,t.char));return `<button class="choice ${i===game.selected?'selected':''}" data-action="select" data-index="${i}" aria-pressed="${i===game.selected}" aria-label="${i+1}、${char}、${byChar.get(char)!.strokes}画" ${!ready?'disabled':''}><span class="key">${i+1}</span>${letter(char)}<span class="stroke">${byChar.get(char)!.strokes}画</span>${match?`<span class="match" aria-label="合体可能">${icon('merge')}</span>`:''}</button>`;}).join('');}
}
function noteInteraction(){if(game.mode!=='playing'||!game.ready)return;moveHint.interact(performance.now());const cue=document.querySelector<HTMLElement>('#gesture-cue');if(cue)cue.hidden=true;}
function wireCanvas(){bindCanvasInput(document.querySelector<HTMLCanvasElement>('#game-canvas')!,{ready:()=>game.ready&&game.mode==='playing',move:x=>game.moveTo(x),drop:()=>game.drop(),activate:()=>sound.activate(),interact:noteInteraction,dragging:active=>{moveHint.dragging=active;}});}
function events(){for(const e of game.events.splice(0)){
  sound.play(e.type);
  if(e.type==='drop'&&e.char){if(online.moves===0)online.start();online.moves++;saved.collection[e.char]??={drop:0,made:0};saved.collection[e.char].drop++;persist();}
  if(e.type==='merge'&&e.char){saved.collection[e.char]??={drop:0,made:0};saved.collection[e.char].made++;persist();}
  if(e.type==='over'){lastTower=game.peakTower;lastResult={...game.stats(),id:newId(),date:new Date().toISOString(),made:[...game.made],duration:game.elapsed,tower:lastTower||undefined};recordResult(saved,lastResult);online.finish(lastResult);persist();openModal('result');}
}}
function openModal(name:string){lastFocus=document.activeElement as HTMLElement;if(!modal){returnMode=game.mode;if(game.mode==='playing')game.mode='paused';}modal=name;app.inert=true;renderModal();if(name==='ranking')void online.load();updateHud();}
function closeModal(navigate=false){
  // A completed run remains on its results, including after visiting another dialog.
  if(!navigate&&screen==='game'&&game.mode==='over'&&lastResult){
    if(modal!=='result'){modal='result';renderModal();}
    return;
  }
  document.querySelector('.dialog-backdrop')?.remove();modal='';app.inert=false;
  if(game.mode==='paused')game.mode=returnMode;lastFocus?.focus();updateHud();
}
function renderModal(focusEntry=false,revealEntry=false){
  const oldGrid=document.querySelector<HTMLElement>('.collection-dialog .collection-grid'),scroll=oldGrid?.scrollTop||0;
  const focused=document.activeElement as HTMLElement|null;
  const keepMetric=modal==='ranking'&&focused?.dataset.action==='rank-metric'?focused.dataset.metric:undefined;
  document.querySelector('.dialog-backdrop')?.remove();const wrap=document.createElement('div');wrap.className='dialog-backdrop';
  const result=modal==='result';
  const heading=result?'':`<div class="dialog-head"><h2 id="modal-title">${{help:'遊び方',pause:'ひとやすみ',collection:'漢字図鑑',ranking:'全国ランキング',settings:'音と設定',about:'このゲームについて',restart:'最初から遊びますか？',leave:'タイトルへ戻りますか？'}[modal]}</h2><button data-action="close" aria-label="閉じる">×</button></div>`;
  wrap.innerHTML=`<section class="dialog ${modal==='collection'?'wide collection-dialog':modal==='help'?'wide help-dialog':result?'result-dialog':''}" role="dialog" aria-modal="true" ${result?'aria-label="プレイ結果"':'aria-labelledby="modal-title"'}>${heading}${modalContent()}</section>`;
  document.body.append(wrap);
  const grid=wrap.querySelector<HTMLElement>('.collection-grid'),entry=grid?.querySelector<HTMLButtonElement>('.active');
  if(grid){grid.scrollTop=scroll;if(revealEntry&&entry){const top=entry.offsetTop,bottom=top+entry.offsetHeight;if(top<grid.scrollTop)grid.scrollTop=top;else if(bottom>grid.scrollTop+grid.clientHeight)grid.scrollTop=bottom-grid.clientHeight;}}
  const target=focusEntry?entry:keepMetric?wrap.querySelector<HTMLButtonElement>(`[data-metric="${keepMetric}"]`):wrap.querySelector<HTMLButtonElement>('button');target?.focus({preventScroll:true});
}
function modalContent():string {
  if(modal==='pause')return `<p>ひと文字ずつ、ゆっくり考えて。<br>ゲームは一時停止しています。</p><button class="secondary" data-action="help" style="width:100%">遊び方</button><button class="primary" data-action="close">続きを遊ぶ →</button><button class="secondary" data-action="restart" style="width:100%;margin-top:15px">最初からやり直す</button>`;
  if(modal==='restart'||modal==='leave')return `<p>今のプレイは終了します。見つけた漢字の記録は残ります。</p><button class="primary" data-action="${modal==='restart'?'start':'home-confirm'}">${modal==='restart'?'最初から遊ぶ':'タイトルへ戻る'}</button><button class="secondary" data-action="close" style="width:100%;margin-top:15px">続きを遊ぶ</button>`;
  if(modal==='help')return helpHTML();
  if(modal==='settings')return `<div class="settings-row"><span>音</span><button class="secondary" data-action="mute">${saved.muted?'オフ（タップでオン）':'オン（タップでオフ）'}</button></div><label class="settings-row">BGM<input type="range" min="0" max="1" step=".05" value="${saved.music}" data-volume="music" aria-label="BGMの音量"></label><label class="settings-row">効果音<input type="range" min="0" max="1" step=".05" value="${saved.effects}" data-volume="effects" aria-label="効果音の音量"></label><div class="settings-row"><span>当たり判定を重ねて表示</span><button class="secondary" data-action="debug">${renderer?.debug?'表示中':'表示する'}</button></div><p>音の設定と図鑑・自己記録は、このブラウザに保存されます。</p>`;
  if(modal==='collection')return collectionHTML(saved,collectionIndex);
  if(modal==='ranking'){const metric=online.metric,best=saved.bests[metric];return `<div class="tabs ranking-tabs" role="group" aria-label="ランキングの種目">${rankingMetrics.map(m=>`<button data-action="rank-metric" data-metric="${m}" aria-pressed="${metric===m}" class="${metric===m?'active':''}">${metricLabels[m]}</button>`).join('')}</div><div class="personal-best"><span>自己ベスト</span><strong>${best?metricValue(best,metric):'—'}<small>${metricUnits[metric]}</small></strong>${best?`<button class="best-share action-button x-share" data-action="share-best" aria-label="この自己ベストをXでシェア">${actionIcon('share')}<span>X</span></button>`:''}</div>${shareFeedback()}${online.rankingHTML()}`;}
  if(modal==='result'&&lastResult)return `<div class="result"><div class="eyebrow">YOUR KANJI TOWER</div><div class="result-score">${lastResult.score}<small>画</small></div><div class="result-stats"><span>高さ ${lastResult.height.toFixed(1)}字分</span><span>${lastResult.count}文字</span></div><p class="result-rank">${rankingMetrics.filter(m=>saved.bests[m]?.id===lastResult!.id).length?`${rankingMetrics.filter(m=>saved.bests[m]?.id===lastResult!.id).map(m=>metricLabels[m]).join('・')} 自己ベスト！`:`自己ベスト ${saved.bests.score?.score||0}画`}</p><p>${lastResult.made.length?`作った漢字：${lastResult.made.join(' ')}`:'次は、合体にも挑戦してみよう。'}</p><button class="primary" data-action="start">もう一度遊ぶ <small>R</small></button><div class="result-buttons"><button class="secondary action-button x-share" data-action="share">${actionIcon('share')}<span>Xでシェア</span></button><button class="secondary action-button" data-action="image">${actionIcon('download')}<span>結果画像を保存</span></button></div>${shareFeedback()}${online.resultHTML()}</div>`;
  return `<p>合体！漢字タワーバトル<br>ゲームのコードはAI（ChatGPT）が制作しています。</p><p>合体の表と図鑑の説明は，Windows版でAI（Claude）が作成したデータを元にしています。合体の式はゲームのルールであり，字源の説明ではありません。</p><p>物理演算：Planck.js（MIT）<br>字形：Noto Serif JP Bold（SIL OFL）<br>UI：Dela Gothic One（SIL OFL）<br>タイトルの「合体！」：Mochiy Pop One（SIL OFL）<br>フォント解析：opentype.js（MIT）<br>輪郭分割：earcut（ISC）</p>${onlineEnabled?'<p>全国ランキングと画像付きのX共有はCloudflare Workers・D1で動いています。公開する項目と保存期間は結果画面の案内のとおりです。ゲーム終了時にプレイ時間と落下数だけを匿名で集計しています。</p>':'<p>このビルドは全国ランキングと画像付き共有に接続していません。ゲーム・図鑑・端末内の自己記録・結果画像の保存は使えます。</p>'}`;
}
function start(activateSound=true){closeModal(true);lastResult=null;lastTower=null;shareMessage='';shareFallbackURL='';game.reset();online.reset();moveHint.reset();screen='game';if(activateSound)sound.activate();render();}
function postToX(text:string){const playURL=gameLink(location.href,import.meta.env.VITE_PUBLIC_URL);window.open(tweetLink(text,playURL),'_blank','noopener,noreferrer');}
async function share(r:RecordEntry){
  if(shareBusy)return;
  shareMessage='';shareFallbackURL='';
  const text=resultText(r);
  if(ownShareLink(r.shareURL)){window.open(tweetLink(text,r.shareURL),'_blank','noopener,noreferrer');return;}
  if(!onlineEnabled){shareMessage='画像付きの共有リンクは公開準備中です。結果画像は保存できます。';renderModal();return;}
  if(!r.tower&&r.count>0){shareMessage='以前の記録には塔の画像が残っていません。新しいプレイから画像付きで共有できます。';renderModal();return;}
  // Reserve a tab during the tap, before the image upload (mobile popup rules).
  const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
  shareBusy=true;renderModal();
  try{
    await Promise.all([document.fonts.load('400 34px TowerDisplay'),document.fonts.load('400 48px TowerImpact'),document.fonts.load('700 28px Biz')]);
    const canvas=document.createElement('canvas');canvas.width=SHARE_IMAGE_WIDTH;canvas.height=SHARE_IMAGE_HEIGHT;
    drawShareImage(canvas.getContext('2d')!,r,r.tower||null);
    const {url}=await createResultShare(r,canvas.toDataURL('image/png').split(',')[1]);
    r.shareURL=url;
    for(const entry of [...saved.records,...Object.values(saved.bests)])if(entry.id===r.id)entry.shareURL=url;
    persist();const intent=tweetLink(text,url);
    if(popup&&!popup.closed)popup.location.replace(intent);else shareFallbackURL=intent;
    shareMessage='共有リンクを用意しました。';
  }catch(e){popup?.close();shareMessage=e instanceof Error?e.message:'共有画像を用意できませんでした。';}
  finally{shareBusy=false;if(modal==='result'||modal==='ranking')renderModal();}
}
function shareKanji(){const char=kanji[collectionIndex]?.char;if(char&&(saved.collection[char]?.made||0)>0)postToX(discoveryText(char));}
async function resultImage(){
  if(!lastResult)return;
  const result=lastResult,tower=lastTower;
  await Promise.all([document.fonts.load('400 40px TowerDisplay'),document.fonts.load('400 42px TowerImpact'),document.fonts.load('700 29px Biz')]);
  const c=document.createElement('canvas');c.width=RESULT_IMAGE_WIDTH;c.height=RESULT_IMAGE_HEIGHT;
  drawResultImage(c.getContext('2d')!,result,tower);
  c.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='合体！漢字タワーバトル.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);},'image/png');
}
document.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action;if(a&&['select','rotate','left','right','drop'].includes(a))noteInteraction();sound.activate();sound.play('button');
  switch(a){case 'start':start();break;case 'home':if(screen==='game'&&['playing','paused'].includes(game.mode))openModal('leave');else{closeModal(true);screen='home';game.mode='title';render();}break;case 'home-confirm':closeModal(true);screen='home';game.mode='title';render();break;case 'select':game.select(Number(b.dataset.index));break;case 'left':game.move(-8);break;case 'right':game.move(8);break;case 'rotate':game.rotate();break;case 'drop':game.drop();break;case 'pause':if(game.mode==='over')openModal('result');else openModal('pause');break;case 'restart':openModal('restart');break;case 'close':closeModal();break;case 'entry':collectionIndex=Number(b.dataset.index);renderModal(true);break;case 'rank-metric':if(isRankingMetric(b.dataset.metric))online.selectMetric(b.dataset.metric);break;case 'online-refresh':void online.load();break;case 'online-submit':void online.submit();break;case 'mute':saved.muted=!saved.muted;sound.muted=saved.muted;if(saved.muted)sound.silence();persist();renderModal();break;case 'debug':if(renderer)renderer.debug=!renderer.debug;renderModal();break;case 'share-kanji':shareKanji();break;case 'share-best':{const best=saved.bests[online.metric];if(best)share(best);break;}case 'share':if(lastResult)share(lastResult);break;case 'image':void resultImage();break;case 'lab':closeModal(true);screen='lab';game.mode='title';render();break;default:if(a)openModal(a);}
  updateHud();
});
document.addEventListener('input',e=>{const input=e.target as HTMLInputElement;if(input.id==='ranking-name'){online.name=input.value;return;}const key=input.dataset.volume as 'music'|'effects'|undefined;if(key){saved[key]=Number(input.value);sound[key]=saved[key];persist();}});
document.addEventListener('keydown',e=>{
  if(modal&&e.key==='Tab'){const focusable=[...document.querySelectorAll<HTMLElement>('.dialog button:not(:disabled),.dialog input,.dialog a,.dialog summary')];const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;}
  if((e.target as HTMLElement).matches('input,textarea'))return;
  if(e.key==='Escape'){if(modal)closeModal();else if(screen==='game'&&game.mode==='playing')openModal('pause');return;}
  if(modal==='collection'&&e.key.startsWith('Arrow')){e.preventDefault();const grid=document.querySelector<HTMLElement>('.collection-grid')!;const cols=getComputedStyle(grid).gridTemplateColumns.split(' ').length;collectionIndex=moveCollectionIndex(collectionIndex,{ArrowRight:1,ArrowLeft:-1,ArrowDown:cols,ArrowUp:-cols}[e.key]||0);renderModal(true,true);return;}
  if(e.key.toLowerCase()==='b'){e.preventDefault();modal==='collection'?closeModal():openModal('collection');return;}
  if(e.key.toLowerCase()==='l'){e.preventDefault();modal==='ranking'?closeModal():openModal('ranking');return;}
  if(e.key.toLowerCase()==='r'){e.preventDefault();start();return;}
  if(e.code==='Space'){e.preventDefault();sound.activate();if(modal==='pause')closeModal();else if(modal)return;else if(screen==='home')start();else if(game.mode==='playing')openModal('pause');return;}
  if(modal||screen!=='game')return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','1','2','3'].includes(e.key)){e.preventDefault();noteInteraction();sound.activate();if(e.key==='ArrowLeft')game.move(-8);if(e.key==='ArrowRight')game.move(8);if(e.key==='ArrowUp'&&!e.repeat)game.rotate();if(e.key==='ArrowDown'&&!e.repeat)game.drop();if(['1','2','3'].includes(e.key))game.select(Number(e.key)-1);updateHud();}
});
addEventListener('resize',()=>renderer?.resize());
document.addEventListener('visibilitychange',()=>{if(document.hidden){sound.silence();if(game.mode==='playing'&&!modal)openModal('pause');}});
let previous=performance.now(),accumulator=0;
function frame(now:number){const dt=Math.min(.1,(now-previous)/1000);previous=now;if(screen==='game'&&!document.hidden){accumulator=Math.min(.1,accumulator+dt);while(accumulator>=1/60){game.step();accumulator-=1/60;}events();renderer?.draw(dt);if(now-lastHud>100){updateHud();lastHud=now;}}else accumulator=0;sound.tick(screen==='game'&&game.mode==='playing'&&!document.hidden);requestAnimationFrame(frame);}
start(false);requestAnimationFrame(frame);
