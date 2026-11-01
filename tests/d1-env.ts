import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import type { Env } from '../server/worker';
export const GAME='https://sasa618.github.io/kanji-tower-battle-web/',ORIGIN='https://sasa618.github.io';
// Tests apply the real migration files in order, exactly as wrangler does for a new or existing database.
export function env(extra:Partial<Env>={}):Env{
  const sqlite=new DatabaseSync(':memory:');
  for(const file of fs.readdirSync('server/migrations').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(`server/migrations/${file}`,'utf8'));
  // Like D1, hand BLOB columns back as plain number arrays rather than typed arrays.
  const row=(r:unknown)=>r&&Object.fromEntries(Object.entries(r as Record<string,unknown>).map(([k,v])=>[k,v instanceof Uint8Array?Array.from(v):v]));
  const db={prepare(sql:string){let values:unknown[]=[];const self={bind(...args:unknown[]){values=args.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);return self;},async first(){return row(sqlite.prepare(sql).get(...values as never[]))||null;},async all(){return {results:sqlite.prepare(sql).all(...values as never[]).map(row)};},async run(){const info=sqlite.prepare(sql).run(...values as never[]);return {meta:{changes:Number(info.changes)}};}};return self;}};
  return {DB:db as unknown as Env['DB'],ALLOWED_ORIGINS:ORIGIN,GAME_URL:GAME,...extra};
}
