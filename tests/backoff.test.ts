import test from 'node:test';
import assert from 'node:assert/strict';
import {Backoff,isOutageStatus} from '../src/backoff';

test('failures double the pause from 15 seconds to at most 10 minutes, and any answer resets it',()=>{
  let now=0;const backoff=new Backoff(15000,600000,()=>now);
  assert.equal(backoff.wait(),0);
  backoff.fail();assert.equal(backoff.wait(),15000);
  now+=15000;assert.equal(backoff.wait(),0);
  backoff.fail();assert.equal(backoff.wait(),30000);
  now+=30000;backoff.fail();assert.equal(backoff.wait(),60000);
  for(let i=0;i<10;i++){now+=backoff.wait();backoff.fail();}
  assert.equal(backoff.wait(),600000);
  backoff.succeed();assert.equal(backoff.wait(),0);
  backoff.fail();assert.equal(backoff.wait(),15000);
});
test('a Retry-After hint lengthens the pause but never beyond the maximum',()=>{
  let now=0;const backoff=new Backoff(15000,600000,()=>now);
  backoff.fail(45);assert.equal(backoff.wait(),45000);
  now+=45000;backoff.fail(5);assert.equal(backoff.wait(),30000,'a short hint never cuts the exponential pause');
  now+=30000;backoff.fail(99999);assert.equal(backoff.wait(),600000);
  backoff.fail(NaN);assert.ok(backoff.wait()<=600000);
});
test('only the Worker side and overload statuses count as an outage',()=>{
  for(const status of [429,502,503,504])assert.ok(isOutageStatus(status));
  for(const status of [200,201,400,403,404,409,413,415])assert.ok(!isOutageStatus(status));
});
