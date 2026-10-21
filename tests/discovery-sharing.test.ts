import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {recipes} from '../src/data';
import {discoveryCards,discoveryImagePath,discoveryShareURL} from '../src/discovery-sharing';
import {discoveryPages} from '../tools/discovery-pages';
import {discoveryText,tweetLink} from '../src/sharing';
const GAME='https://sasa618.github.io/kanji-tower-battle-web/';

test('each completed character gets its own image card and a share link under the public subpath',()=>{
  assert.equal(discoveryCards.length,new Set(recipes.map(r=>r.result)).size);
  assert.equal(new Set(discoveryCards.map(c=>c.slug)).size,discoveryCards.length);
  for(const card of discoveryCards){
    const url=discoveryShareURL(card.char,GAME+'?old=1#result');
    assert.equal(url,`${GAME}discovered/${card.slug}/`);
    const intent=new URL(tweetLink(discoveryText(card.char),url));
    assert.equal(intent.searchParams.get('url'),url);
    assert.ok(intent.searchParams.get('text')!.includes(`「${card.char}」を作った！`));
  }
  assert.equal(discoveryShareURL('森',GAME+'index.html'),GAME+'discovered/68ee/');
  assert.equal(discoveryShareURL('森','http://127.0.0.1:5173/',GAME),GAME+'discovered/68ee/');
  assert.equal(discoveryShareURL('森','http://192.168.100.34:5174/'),null);
  assert.equal(discoveryShareURL('<script>',GAME),null);
  assert.equal(discoveryShareURL('森',GAME,'not a URL'),null);
});

test('static discovery pages expose the matching PNG to crawlers and send players to a fresh game',()=>{
  const pages=discoveryPages(GAME+'?previous=1#result');
  assert.equal(pages.length,discoveryCards.length);
  for(const card of discoveryCards){
    const page=pages.find(p=>p.fileName===`discovered/${card.slug}/index.html`)!;
    assert.ok(page.html.includes(`「${card.char}」を作った！`));
    assert.ok(page.html.includes(`<meta name="twitter:image" content="${GAME}${discoveryImagePath(card.slug)}">`));
    assert.match(page.html,/twitter:card" content="summary_large_image/);
    assert.ok(page.html.includes(`<meta property="og:url" content="${GAME}discovered/${card.slug}/">`));
    assert.ok(page.html.includes(`<a id="play" href="${GAME}">`));
    assert.match(page.html,/location.replace\(document.getElementById\('play'\).href\)/);
    assert.doesNotMatch(page.html,/previous=1|#result|fetch\(/);
  }
  assert.deepEqual(discoveryPages(),[]);
  assert.deepEqual(discoveryPages('http://localhost:5173/'),[]);
  assert.deepEqual(discoveryPages('not a URL'),[]);
});

test('every shareable character has a published PNG with the X card dimensions',()=>{
  for(const card of discoveryCards){
    const png=fs.readFileSync(`public/${discoveryImagePath(card.slug)}`);
    assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
    assert.ok(png.length<260000,`${card.char}: image should stay lightweight`);
  }
});
