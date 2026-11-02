// Play sessions are signed tokens instead of database rows, so starting a game writes nothing to D1.
// Token: v1.<issued ms>.<client tag>.<nonce>.<signature>; the signature is an HMAC-SHA256 over the first four parts.
export type Session={id:string;client:string;created:number};
const encoder=new TextEncoder();
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
async function key(secret:string){return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);}
async function sign(secret:string,body:string){return hex(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(body)));}
/** A device identifier is never stored as sent; only its hash is used for the per-device limits. */
export async function clientTag(client:string){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(client))).slice(0,32);}
export async function issueSession(secret:string,client:string,now:number){
  const body=`v1.${now}.${await clientTag(client)}.${crypto.randomUUID()}`;
  return `${body}.${await sign(secret,body)}`;
}
/** Returns the session inside a token whose signature matches, or null for anything else. */
export async function verifySession(secret:string,token:unknown):Promise<Session|null>{
  if(typeof token!=='string'||token.length>200)return null;
  const parts=token.split('.');
  if(parts.length!==5||parts[0]!=='v1'||!/^\d{1,16}$/.test(parts[1])||!/^[0-9a-f]{32}$/.test(parts[2])||!/^[0-9a-f-]{36}$/.test(parts[3])||!/^[0-9a-f]{64}$/.test(parts[4]))return null;
  const expected=await sign(secret,parts.slice(0,4).join('.'));
  // Constant-time comparison; both strings are the same length by the checks above.
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^parts[4].charCodeAt(i);
  if(diff)return null;
  return {id:parts[3],client:parts[2],created:Number(parts[1])};
}
