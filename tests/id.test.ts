import test from 'node:test';
import assert from 'node:assert/strict';
import {newId} from '../src/id';
test('LAN HTTP preview generates valid unique IDs without randomUUID',()=>{
  const source={getRandomValues:crypto.getRandomValues.bind(crypto)};
  const ids=Array.from({length:100},()=>newId(source));
  assert.equal(new Set(ids).size,100);
  for(const id of ids)assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});
