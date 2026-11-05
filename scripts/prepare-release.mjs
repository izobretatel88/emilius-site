// Reproducible production build; no network writes or hosting changes.
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';

// Клиентские материалы не входят ни в публичный Git, ни в полную выкладку сайта.
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0');
assert(!tracked.some(p=>['work/','public/extra/','docs/insales-service/data/private/'].some(prefix=>p.startsWith(prefix))),'Private client files are tracked by Git');
const env={...process.env,SITE_URL:'https://emilius.agency',BASE_PATH:'/',YM_ID:process.env.YM_ID||'68742100'};
delete env.PREVIEW;
execFileSync('npm',['run','build'],{env,stdio:'inherit'});
assert(!existsSync('dist/extra'),'dist/extra must not be included in the release');
// The postponed OS concept remains available in preview, outside the release.
rmSync('dist/os',{recursive:true,force:true});
execFileSync(process.execPath,['scripts/check-site-links.mjs'],{env,stdio:'inherit'});
const html=[];
function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const p=join(dir,entry.name);if(entry.isDirectory())walk(p);else if(entry.name.endsWith('.html'))html.push(p);}}
walk('dist');
for(const p of html){
 const s=readFileSync(p,'utf8');
 // 404 закрыта от индекса намеренно (итерация 86); на остальных страницах noindex — признак сборки превью
 if(!p.endsWith('/404.html'))assert(!/<meta\b[^>]*name="robots"[^>]*noindex/i.test(s),`${p}: noindex`);
 assert(!s.includes('/emilius-site/dev/'),`${p}: dev URL`);
 if(!p.endsWith('/404.html'))assert(/rel="canonical" href="https:\/\/emilius\.agency\//.test(s),`${p}: canonical`);
 assert(s.includes('Итерация 5 из 15 до великолепного состояния'),`${p}: public iteration`);
}
for(const p of ['dist/os','dist/review','dist/blog/edinye-ostatki-wb-ozon-insales/index.html'])assert(!existsSync(p),`${p}: preview-only route`);
for(const p of ['dist/.htaccess','dist/api/lead.php','dist/404.html','dist/sitemap-index.xml'])assert(existsSync(p),`${p}: missing`);
assert(readFileSync('dist/robots.txt','utf8').includes('Allow: /'),'robots is closed');
assert(readFileSync('dist/index.html','utf8').includes('68742100'),'Metrika ID missing');
for (const check of ['scripts/check-project-gallery.mjs', 'scripts/check-project-viewer.mjs']) {
 execFileSync(process.execPath,[check],{env,stdio:'inherit'});
}
console.log(`Release ready: ${html.length} HTML pages; preview-only routes excluded; canonical, indexing, iteration and deployment files verified.`);
