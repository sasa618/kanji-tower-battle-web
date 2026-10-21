import { defineConfig, loadEnv, type Plugin } from 'vite';
import { applyMeasurement, applyPublicURL } from './tools/public-meta';
export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd(),'VITE_');
  // index.html carries absolute card URLs and measurement tags only for configured public values.
  const publicMeta:Plugin={name:'kanji-tower-public-meta',transformIndexHtml:{order:'pre',handler:html=>applyMeasurement(applyPublicURL(html,env.VITE_PUBLIC_URL),{beaconToken:env.VITE_CF_BEACON_TOKEN,googleVerification:env.VITE_GOOGLE_SITE_VERIFICATION})}};
  return {base:'./',plugins:[publicMeta],build:{rollupOptions:{output:{manualChunks(id){if(id.includes('node_modules/planck'))return 'physics';if(id.endsWith('src/data/glyphs.json'))return 'glyphs';}}}}};
});
