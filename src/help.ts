import {glyphs,GLYPH_SIZE} from './physics';
import {renderColor} from './data';

// These instructional scenes use the game's actual glyph contours and stage.
const glyph=(char:string,x:number,y:number,size=1,angle=0)=>{
  const fields={M:['x','y'],L:['x','y'],Q:['x1','y1','x','y'],C:['x1','y1','x2','y2','x','y'],Z:[]} as const;
  const d=glyphs[char].commands.map(c=>c.type+(fields[c.type as keyof typeof fields] as readonly string[]).map(key=>c[key]).join(' ')).join(' ');
  return `<path d="${d}" transform="translate(${x} ${y}) rotate(${angle}) scale(${size*80/GLYPH_SIZE})" fill="${renderColor(char)}"/>`;
};
const stroke=(d:string,color='#526078',width=3)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const hand=(x:number,y:number)=>`<g transform="translate(${x} ${y})"><path d="M0 27V4a4 4 0 0 1 8 0v14l6-4 14 6v20H8Z" fill="#fff" stroke="#465a86" stroke-width="2.5"/></g>`;
function scene(kind:'choose'|'move'|'rotate'|'merge'){
  let picture='';
  if(kind==='choose')picture=`${glyph('木',162,49,.65)}${['日','木','月'].map((c,i)=>`<rect x="${43+i*81}" y="113" width="72" height="67" rx="10" fill="${i===1?'#fff0f5':'#fff'}" stroke="${i===1?'#f15d7b':'#dae3f3'}" stroke-width="${i===1?3:1}"/>${glyph(c,79+i*81,144,.51)}`).join('')}${hand(174,155)}`;
  if(kind==='move')picture=`${glyph('木',162,54,.7)}${stroke('M64 54H110M72 46L64 54L72 62M213 54H260M252 46L260 54L252 62')}${stroke('M162 91V153M154 145L162 153L170 145','#df3655')}${hand(223,103)}${stroke('M234 91v-14m-7 6 7-7 7 7','#526078',2)}`;
  if(kind==='rotate')picture=`${glyph('力',108,132,.76)}${glyph('力',221,132,.76,90)}${stroke('M155 127a14 14 0 1 1 13 16m-8-5 8 5-6 8')}<rect x="218" y="14" width="94" height="43" rx="11" fill="#fff" stroke="#ecd6dc"/>${stroke('M242 30a8 8 0 1 0 1 10M242 25v6h-6','#df3655',2.2)}<text x="277" y="41" text-anchor="middle" font-size="17" font-family="Biz" fill="#45516a" font-weight="700">回転</text>${hand(286,43)}`;
  if(kind==='merge')picture=`<ellipse cx="91" cy="147" rx="49" ry="35" fill="#ffedb4"/>${glyph('木',91,145,.7)}${glyph('木',91,54,.7)}${stroke('M91 89v18m-6-6 6 6 6-6','#e7a324')}${stroke('M145 121h36m-8-8 8 8-8 8','#586fe1')}${glyph('林',241,139,.95)}`;
  const floor=kind==='choose'?'':`<rect x="43" y="186" width="240" height="9" rx="2" fill="#293757"/><path d="M43 187h240" stroke="#526078" stroke-width="2"/>`;
  return `<svg class="help-scene" viewBox="0 0 326 216" role="img" aria-label="${{choose:'下の3つの候補から木を選ぶ',move:'木を左右に動かし，指を離して下へ落とす',rotate:'回転ボタンで力の向きを90度変える',merge:'金色に光る木へ木を落とすと林になる'}[kind]}"><rect width="326" height="216" rx="14" fill="#f7faff"/><path d="M22 100H304M22 157H304" stroke="#e1e7f4" stroke-dasharray="2 7"/>${floor}${picture}</svg>`;
}
export function helpHTML(){
  const steps=[
    ['choose','漢字を選ぶ','画面下の3つから、次に落とす漢字をタップします。落とす前なら選び直せます。'],
    ['move','動かして、離す','盤面に指を置き、左右に動かして位置を決めます。指を離すと、その場所から落ちます。'],
    ['rotate','向きを変える','盤面の右上にある「回転」で90度ずつ回せます。台や積んだ字に乗りやすい向きを探しましょう。'],
    ['merge','光る漢字にくっつける','選んだ字と合体できる字は金色に光ります。触れると合体。たとえば「木＋木＝林」、さらに「林＋木＝森」です。'],
  ] as const;
  return `<p class="help-intro">漢字を積み、合体させて記録を伸ばすゲームです。</p><div class="help-cards">${steps.map(([kind,title,description],i)=>`<section class="help-card">${scene(kind)}<h3><span>${i+1}</span>${title}</h3><p>${description}</p></section>`).join('')}</div><section class="help-goal"><h3>台から落ちると終了</h3><p>漢字が台の下へ落ちるとゲームオーバーです。積んだ「総画数・高さ・字数」が記録になります。</p></section><details class="key-guide"><summary>PCの操作</summary><p>マウスもドラッグして離すと落下します。<br>←→ 移動／↑ 回転／↓ 落下／1〜3 選択<br>Space 一時停止／R 最初から／B 図鑑／L 記録</p></details>`;
}
