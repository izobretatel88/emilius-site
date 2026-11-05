// Verify real generated routes, assets and anchor targets in root and BASE_PATH builds.
import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
const root=resolve('dist');
const base=(process.env.BASE_PATH||'/').replace(/\/$/,'');
const files=[];
function walk(dir){for(const name of readdirSync(dir)){const path=join(dir,name);if(statSync(path).isDirectory())walk(path);else if(name.endsWith('.html'))files.push(path);}}
walk(root);
const html=new Map(files.map(path=>[path,readFileSync(path,'utf8')]));
const errors=[];
let checked=0;
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&quot;','"').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n)));
for(const [file,source] of html){
  const route=relative(root,file).replace(/index\.html$/,'');
  const current=new URL(`${base}/${route}`,'https://emilius.agency');
  for(const [,raw] of source.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)){
    if(!raw || /^(mailto:|tel:|javascript:|data:)/.test(raw))continue;
    const url=new URL(decode(raw),current);
    if(url.origin!==current.origin)continue;
    let pathname=decodeURIComponent(url.pathname);
    // Existing dev badge intentionally points to the main preview, built by another job.
    if(base==='/emilius-site/dev' && pathname==='/emilius-site/')continue;
    if(pathname===base)pathname+='/';
    if(base && !pathname.startsWith(base+'/')){errors.push(`${route}: link outside preview base: ${raw}`);continue;}
    pathname=pathname.slice(base.length);
    let target=resolve(root,'.'+pathname);
    if(!target.startsWith(root+'/') && target!==root){errors.push(`${route}: path escapes site: ${raw}`);continue;}
    if(existsSync(target) && statSync(target).isDirectory())target=join(target,'index.html');
    else if(!existsSync(target) && !pathname.endsWith('.html'))target=join(target,'index.html');
    checked++;
    if(!existsSync(target)){errors.push(`${route}: missing page: ${raw}`);continue;}
    if(url.hash && html.has(target)){
      const id=decodeURIComponent(url.hash.slice(1));
      const ids=[...html.get(target).matchAll(/\bid="([^"]+)"/g)].map(m=>decode(m[1]));
      // Base.astro assigns #content to the first main on load.
      if(!ids.includes(id) && !(id==='content' && html.get(target).includes('<main')))errors.push(`${route}: missing anchor: ${raw}`);
    }
  }
}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`Verified ${checked} internal links across ${files.length} HTML pages (base ${base||'/'}).`);
