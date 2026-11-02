import test from 'node:test';
import assert from 'node:assert/strict';
import {kanji,collectionKanji} from '../src/data';
import {load} from '../src/storage';
import {collectionHTML,collectionOrder,moveCollectionIndex} from '../src/collection-ui';

test('dictionary lists every character in ascending stroke order with sequential display numbers',()=>{
  const saved=load();
  for(const k of kanji)saved.collection[k.char]={drop:1,made:0};
  const html=collectionHTML(saved,collectionOrder[0]);
  const cells=[...html.matchAll(/data-action="entry" data-index="(\d+)"[^>]*aria-label="No\.([外RL]?)(\d+) ([^"]+)"/g)];
  // The bonus block is not collectable; 常用, 常用外, rare and legend characters each form a stroke-ordered section.
  assert.equal(cells.length,collectionKanji.length);
  assert.equal(new Set(cells.map(cell=>cell[1])).size,collectionKanji.length);
  let previous=0,prefix='',position=0;
  for(const cell of cells){
    const k=kanji[Number(cell[1])];
    if(cell[2]!==prefix){prefix=cell[2];previous=0;position=0;}
    assert.ok(k.strokes>=previous,k.char);previous=k.strokes;
    assert.equal(Number(cell[3]),++position);assert.equal(cell[4],k.char);
    assert.equal(k.rarity||'',{'':'','外':'',R:'rare',L:'legend'}[prefix]);
  }
  assert.equal(cells[0][4],'一');
});

test('selection, discoveries and detail numbers still refer to the same character after sorting',()=>{
  const saved=load(),index=kanji.findIndex(k=>k.char==='林');
  saved.collection['林']={drop:0,made:7};
  const html=collectionHTML(saved,index),number=collectionOrder.indexOf(index)+1;
  assert.match(html,new RegExp(`data-index="${index}" aria-pressed="true" aria-label="No\\.${number} 林"`));
  assert.ok(html.includes(`8画 · No.${number}`));assert.ok(html.includes('合体 7回'));
  assert.match(html,/class="secondary discovery-share action-button x-share"/);
  assert.ok(html.includes('未発見'));assert.equal(saved.collection['林'].made,7);
});

test('arrow movement follows visible dictionary positions and wraps at the edges',()=>{
  for(let i=0;i<collectionOrder.length;i++)for(const offset of [-6,-5,-1,1,5,6]){
    const next=moveCollectionIndex(collectionOrder[i],offset);
    assert.equal(next,collectionOrder[(i+offset+collectionOrder.length)%collectionOrder.length]);
  }
});
