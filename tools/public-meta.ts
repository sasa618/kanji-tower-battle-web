// Build-time helper: absolute OGP and X card URLs come from VITE_PUBLIC_URL, never from a hard-coded candidate.
export function normalizePublicURL(value:string|undefined):string{
  if(!value)return '';
  let url:URL;try{url=new URL(value);}catch{return '';}
  if(url.protocol!=='https:')return '';
  url.search='';url.hash='';if(!url.pathname.endsWith('/'))url.pathname+='/';
  return url.href;
}
export function applyPublicURL(html:string,value:string|undefined):string{
  const url=normalizePublicURL(value);
  if(url)return html.replaceAll('__PUBLIC_URL__',url);
  // Without a public URL the absolute-URL card tags are dropped, so no candidate address ships in the build.
  return html.replace(/^[ \t]*<meta\b[^\n]*(__PUBLIC_URL__|og:image:)[^\n]*\n/gm,'');
}
