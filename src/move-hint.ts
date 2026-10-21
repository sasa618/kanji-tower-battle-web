export const HINT_IDLE_MS=5000;

/** First-use guidance returns only after an idle period between gestures. */
export class MoveHint {
  dragging=false;
  private used=false;
  private lastActivity=0;
  private wasReady=false;
  reset(){this.dragging=false;this.used=false;this.lastActivity=0;this.wasReady=false;}
  interact(now:number){this.used=true;this.lastActivity=now;}
  visible(now:number,ready:boolean){
    if(ready&&!this.wasReady&&this.used)this.lastActivity=now;
    this.wasReady=ready;
    return ready&&!this.dragging&&(!this.used||now-this.lastActivity>=HINT_IDLE_MS);
  }
}
