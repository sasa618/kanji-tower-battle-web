import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryText, gameLink, resultText, tweetLink, xLength, X_TEXT_LIMIT, X_URL_WEIGHT } from '../src/sharing';
import { RankingCache } from '../src/ranking-cache';
test('discovery posts include a playable public URL and Japanese text',()=>{
  const publicURL='https://sasa618.github.io/kanji-tower-battle-web/';
  const url=new URL(tweetLink(discoveryText('森'),gameLink(publicURL+'?old=1#dialog')));
  assert.equal(url.searchParams.get('url'),publicURL);
  assert.match(url.searchParams.get('text')!,/「森」を作った！/);
  assert.doesNotMatch(url.searchParams.get('text')!,/あなたは何を作れる/);
  assert.equal(gameLink('http://127.0.0.1:5173/'),null);
  assert.equal(gameLink('http://192.168.11.4:5174/'),null);
  assert.equal(gameLink('http://10.0.0.2:5174/'),null);
  assert.equal(gameLink('http://172.20.0.2:5174/'),null);
  assert.equal(gameLink('http://localhost:5173/',publicURL),publicURL);
});
test('x length weights CJK as two and ASCII or newlines as one',()=>{
  assert.equal(xLength('ab'),2);assert.equal(xLength('漢字'),4);assert.equal(xLength('a\n'),2);assert.equal(xLength('！'),2);
});
test('result text lists created characters and stays within the X limit beside a URL',()=>{
  assert.equal(resultText({score:94,height:3.7,count:12,made:['森','明','回']}),'合体！漢字タワーバトルで総画数94（高さ3.7字分・12字）！ 作った字：森 明 回\n#漢字タワーバトル');
  assert.equal(resultText({score:12,height:1,count:3,made:[]}),'合体！漢字タワーバトルで総画数12（高さ1.0字分・3字）！\n#漢字タワーバトル');
  const many={score:1500,height:40,count:150,made:Array.from({length:120},(_,i)=>'想晶森詩'[i%4])};
  const text=resultText(many);
  assert.ok(xLength(text)+X_URL_WEIGHT+1<=X_TEXT_LIMIT,`weighted length ${xLength(text)}`);
  assert.match(text,/作った字：想 晶 森 詩 .* ほか\d+字\n#漢字タワーバトル$/);
  const intent=new URL(tweetLink(text,'https://ranking.example/s/ab351954-867d-489e-88c3-4126e15e32d6'));
  assert.equal(intent.searchParams.get('text'),text);
});
test('ranking openings, concurrent requests, and empty results reuse one fetch for five minutes',async()=>{
  let calls=0,now=1000;const cache=new RankingCache(async()=>{calls++;return {scores:[]};},()=>now);
  await Promise.all([cache.get(),cache.get(),cache.get()]);
  now+=299999;await cache.get();assert.equal(calls,1);
  now++;await cache.get();assert.equal(calls,2);
});
test('ranking failures do not trigger automatic retry storms',async()=>{
  let calls=0,now=1000;const cache=new RankingCache(async()=>{calls++;throw Error('offline');},()=>now);
  await assert.rejects(cache.get());await cache.get();assert.equal(calls,1);
  now+=300000;await assert.rejects(cache.get());assert.equal(calls,2);
});
