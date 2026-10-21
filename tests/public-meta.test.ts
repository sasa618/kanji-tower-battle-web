import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyPublicURL,normalizePublicURL} from '../tools/public-meta';
test('public URL is normalized to https with a trailing slash and rejects local or invalid values',()=>{
  assert.equal(normalizePublicURL('https://example.github.io/game?x=1#y'),'https://example.github.io/game/');
  assert.equal(normalizePublicURL('https://example.github.io/game/'),'https://example.github.io/game/');
  assert.equal(normalizePublicURL('http://192.168.1.2:5174/'),'');
  assert.equal(normalizePublicURL(undefined),'');
  assert.equal(normalizePublicURL('not a url'),'');
});
test('index.html carries absolute card URLs only when a public URL is configured',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const built=applyPublicURL(html,'https://example.github.io/game');
  assert.ok(built.includes('property="og:url" content="https://example.github.io/game/"'));
  assert.ok(built.includes('property="og:image" content="https://example.github.io/game/social-card.png"'));
  assert.ok(built.includes('name="twitter:image" content="https://example.github.io/game/social-card.png"'));
  assert.doesNotMatch(built,/__PUBLIC_URL__/);
  const local=applyPublicURL(html,undefined);
  assert.doesNotMatch(local,/__PUBLIC_URL__|og:url|og:image|twitter:image"/);
  assert.match(local,/twitter:card/);assert.match(local,/og:title/);assert.match(local,/twitter:image:alt/);
});
