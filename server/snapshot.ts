// Shared by requests handled by this Worker instance, including concurrent misses.
// Edge caching can add another layer; correctness does not depend on its availability.
export class Snapshot<T> {
  private value:T|undefined;
  private expires=0;
  private retryAt=0;
  private error:unknown;
  private pending:Promise<T>|null=null;
  constructor(private read:()=>Promise<T>,private now=()=>Date.now(),private ttl=60000){}
  get():Promise<T>{
    if(this.pending)return this.pending;
    if(this.value!==undefined&&this.now()<this.expires)return Promise.resolve(this.value);
    if(this.now()<this.retryAt)return Promise.reject(this.error);
    this.pending=this.read().then(value=>{this.value=value;this.expires=this.now()+this.ttl;return value;},error=>{
      this.error=error;this.retryAt=this.now()+15000;throw error;
    }).finally(()=>{this.pending=null;});
    return this.pending;
  }
}
