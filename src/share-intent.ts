import {tweetLink} from './sharing';

// Image generation, fonts and upload all share one deadline. Text sharing always works independently.
export async function prepareShareIntent(text:string,playURL:string|null,createImageLink:()=>Promise<string>,timeout=15000){
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    const url=await Promise.race([createImageLink(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('share timeout')),timeout);})]);
    return {intent:tweetLink(text,url),image:true};
  }catch{return {intent:tweetLink(text,playURL),image:false};}
  finally{clearTimeout(timer);}
}

export function tryOpenShare(intent:string,open=(url:string)=>window.open(url,'_blank','noopener,noreferrer')){
  // A visible link remains available whether the browser returns null or throws.
  try{open(intent);}catch{}
}
