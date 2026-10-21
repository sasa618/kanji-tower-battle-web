import { defineConfig, loadEnv, type Plugin } from 'vite';
import { applyPublicURL } from './tools/public-meta';
export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd(),'VITE_');
  // index.html carries absolute card URLs only for a configured public HTTPS URL.
  const publicMeta:Plugin={name:'kanji-tower-public-meta',transformIndexHtml:{order:'pre',handler:html=>applyPublicURL(html,env.VITE_PUBLIC_URL)}};
  return {base:'./',plugins:[publicMeta],build:{rollupOptions:{output:{manualChunks(id){if(id.includes('node_modules/planck'))return 'physics';if(id.endsWith('src/data/glyphs.json'))return 'glyphs';}}}}};
});
