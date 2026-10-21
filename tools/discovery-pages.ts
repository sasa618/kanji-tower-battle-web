import {discoveryCards,discoveryImagePath,discoveryShareURL} from '../src/discovery-sharing';
import {normalizePublicURL} from './public-meta';
import {gameLink} from '../src/sharing';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** Static Pages cards: no upload, API request or database row is needed to share a letter. */
export function discoveryPages(publicURL?:string){
  if(!publicURL)return [];
  const base=normalizePublicURL(publicURL);if(!base||!gameLink(base))return [];
  const game=new URL(base);game.pathname=game.pathname.replace(/index\.html$/,'');
  if(!game.pathname.endsWith('/'))game.pathname+='/';
  return discoveryCards.map(card=>{
    const page=discoveryShareURL(card.char,game.href)!;
    const image=new URL(discoveryImagePath(card.slug),game).href;
    const title=`「${card.char}」を作った！ 合体！漢字タワーバトル`;
    const description='漢字を積んで、くっつけて、新しい字を発見。タップして新しいゲームを始めよう。';
    const alt=`完成した漢字「${card.char}」（${card.strokes}画）と、その合体の組み合わせ`;
    const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<link rel="canonical" href="${esc(page)}"><meta name="description" content="${esc(description)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}"><meta name="twitter:image:alt" content="${esc(alt)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="合体！漢字タワーバトル"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(page)}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(alt)}">
<style>body{margin:0;background:#fffefa;color:#293757;font-family:system-ui,sans-serif}main{max-width:760px;margin:auto;padding:24px 16px;text-align:center}a{color:inherit;text-decoration:none}img{width:100%;height:auto;border-radius:16px}p{font-size:18px;font-weight:700}</style></head>
<body><main><a id="play" href="${esc(game.href)}"><img src="${esc(image)}" width="1200" height="630" alt="${esc(alt)}"><p>合体！漢字タワーバトルを遊ぶ →</p></a></main><script>location.replace(document.getElementById('play').href)</script></body></html>`;
    return {fileName:`discovered/${card.slug}/index.html`,html};
  });
}
