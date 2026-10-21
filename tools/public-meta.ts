// Build-time helpers: absolute OGP and X card URLs come from VITE_PUBLIC_URL, never from a hard-coded candidate,
// and optional measurement tags are added only when their public tokens are configured.
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
export type Measurement={beaconToken?:string;googleVerification?:string};
export function applyMeasurement(html:string,{beaconToken,googleVerification}:Measurement):string{
  const tags:string[]=[];
  // Google Search Console ownership tag (URL-prefix property for the public game URL).
  if(googleVerification&&/^[A-Za-z0-9_-]{8,128}$/.test(googleVerification))tags.push(`  <meta name="google-site-verification" content="${googleVerification}" />`);
  // Cloudflare Web Analytics beacon: cookie-free page views and visits, works on GitHub Pages.
  if(beaconToken&&/^[0-9a-f]{32}$/.test(beaconToken))tags.push(`  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${beaconToken}"}'></script>`);
  return tags.length?html.replace(/^([ \t]*)<\/head>/m,`${tags.join('\n')}\n$1</head>`):html;
}
