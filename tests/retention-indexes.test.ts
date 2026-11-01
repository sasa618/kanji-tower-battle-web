import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';

test('retention cleanup searches timestamp indexes and preserves current records',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    for(const file of readdirSync('server/migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(`server/migrations/${file}`,'utf8'));
    db.exec("INSERT INTO sessions(id,client,created) VALUES('old','client',1),('current','client',100);");
    db.exec("INSERT INTO scores(id,session_id,name,score,height,count,duration,created) VALUES('old','old','test',1,1,1,1,1),('current','current','test',1,1,1,1,100);");
    for(const table of ['sessions','scores']){
      const plan=db.prepare(`EXPLAIN QUERY PLAN DELETE FROM ${table} WHERE created<?`).all(50);
      assert.ok(plan.some(row=>String(row.detail).includes(`USING INDEX ${table}_created`)),JSON.stringify(plan));
      assert.equal(db.prepare(`DELETE FROM ${table} WHERE created<?`).run(50).changes,1);
      assert.deepEqual(db.prepare(`SELECT id FROM ${table}`).all().map(row=>row.id),['current']);
    }
  }finally{db.close();}
});
