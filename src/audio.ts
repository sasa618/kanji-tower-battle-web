export class Sound {
  context:AudioContext|null=null;muted=false;music=.15;effects=.45;nextNote=0;step=0;
  activate(){this.context??=new AudioContext();void this.context.resume();}
  tone(freq:number,duration:number,volume:number,type:OscillatorType='sine',delay=0){if(!this.context||this.muted)return;const c=this.context,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume*.12,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(c.destination);o.start(t);o.stop(t+duration);}
  play(type:string){if(type==='merge'){[523.25,659.25,783.99,1046.5].forEach((n,i)=>this.tone(n,.35,this.effects,'sine',i*.075));}else if(type==='over'){[440,349,261].forEach((n,i)=>this.tone(n,.5,this.effects,'triangle',i*.15));}else if(type==='land')this.tone(196,.12,this.effects*.5,'triangle');else if(type==='drop')this.tone(392,.15,this.effects,'sine');else this.tone(660,.06,this.effects*.4);}
  tick(playing:boolean){const c=this.context;if(!c||this.muted||!playing)return;if(c.currentTime>=this.nextNote){const notes=[261.63,329.63,392,329.63,293.66,349.23,440,349.23,261.63,329.63,523.25,392,293.66,349.23,392,293.66];this.tone(notes[this.step++%notes.length],.8,this.music,'sine');this.nextNote=c.currentTime+.6;}}
  silence(){if(this.context)void this.context.suspend();}
}
