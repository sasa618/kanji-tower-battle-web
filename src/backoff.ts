// Shared outage gate for the ranking API. After the Worker or the network fails, every caller waits
// before contacting it again, so an outage does not multiply requests against the free-tier daily count.
export class Backoff {
  private retryAt=0;
  private delay:number;
  constructor(private initial=15000,private max=600000,private now=()=>Date.now()){this.delay=initial;}
  /** Milliseconds to wait before the next attempt; 0 when requests may go out. */
  wait(){return Math.max(0,this.retryAt-this.now());}
  /** Server-side or network failure. `retryAfter` is the Retry-After header in seconds, when present. */
  fail(retryAfter?:number){
    const hinted=retryAfter&&Number.isFinite(retryAfter)?retryAfter*1000:0;
    this.retryAt=this.now()+Math.min(this.max,Math.max(this.delay,hinted));
    this.delay=Math.min(this.max,this.delay*2);
  }
  /** Any answer from the server, including a client error, proves it is reachable again. */
  succeed(){this.retryAt=0;this.delay=this.initial;}
}
// Cloudflare's own limit answers (429 without CORS headers) surface as network errors; these are the Worker's.
export const isOutageStatus=(status:number)=>status===429||status===502||status===503||status===504;
