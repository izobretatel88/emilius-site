// Изолированная проверка контроллера: объекты в памяти, без браузера и сети.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setupProjectViewer} from '../src/lib/project-viewer.ts';

class Element {
  attrs = new Map(); listeners = new Map(); dataset = {}; children = [];
  hidden = false; disabled = false; textContent = ''; scrollTop = 0; scrollLeft = 0;
  style = {setProperty: (name, value) => {this.attrs.set(`style:${name}`,value);}};
  addEventListener(name, fn) {const list=this.listeners.get(name)||[];list.push(fn);this.listeners.set(name,list);}
  emit(name, event={}) {for(const fn of this.listeners.get(name)||[])fn({target:this,...event});}
  setAttribute(name,value) {this.attrs.set(name,value);}
  getAttribute(name) {return this.attrs.get(name);}
  append(child) {this.children.push(child);}
  replaceChildren() {this.children=[];}
  querySelectorAll() {return this.children;}
  focus() {focused=this;}
}
let focused;
const viewer = new Element(); viewer.open=false;
viewer.showModal=()=>{viewer.open=true;};
viewer.close=()=>{viewer.open=false;viewer.emit('close');};
const names=['img','.viewer-image','#viewer-title','.viewer-status','.viewer-error','.viewer-inquiry','.viewer-screens','.viewer-devices','.viewer-zoom','.viewer-paging','[data-prev-screen]','[data-next-screen]','[data-retry-viewer]','[data-close-viewer]'];
const elements=Object.fromEntries(names.map(name=>[name,new Element()]));
elements.img.complete=false;elements.img.naturalWidth=0;
elements['.viewer-image'].id='viewer-canvas';
for(const value of ['desktop','phone']){const b=new Element();b.dataset.device=value;elements['.viewer-devices'].append(b);}
for(const value of ['fit','actual']){const b=new Element();b.dataset.scale=value;elements['.viewer-zoom'].append(b);}
viewer.querySelector=name=>elements[name];
const html=readFileSync('dist/projects/index.html','utf8');
const projects=JSON.parse(html.match(/<script\b[^>]*id="project-media"[^>]*>([\s\S]*?)<\/script>/)[1]);
// Дополнительный экран — только тестовая фикстура, не публикация выдуманного снимка.
projects.duman.screens.push({...projects.duman.screens[0],label:'Тестовый экран',src:'/test-only.webp'});
const links=Object.keys(projects).map(id=>{const l=new Element();l.dataset.projectPreview=id;return l;});
const originalDocument=globalThis.document;
globalThis.document={
 querySelector:name=>name==='.project-viewer'?viewer:{textContent:JSON.stringify(projects)},
 querySelectorAll:()=>links,
 createElement:()=>new Element(),
};
try {
 setupProjectViewer();
 let prevented=false;
 const click={button:0,preventDefault:()=>{prevented=true;}};
 links[2].emit('click',{...click,ctrlKey:true});
 assert(!prevented && !viewer.open,'Ctrl-click must keep native navigation');
 links[2].emit('click',click);
 assert(viewer.open && prevented);
 assert.equal(elements['#viewer-title'].textContent,'Duman');
 assert.match(elements['.viewer-inquiry'].href,/project=duman#feedback$/);
 assert.equal(elements['.viewer-screens'].children.length,2);
 assert(!elements['.viewer-screens'].hidden && !elements['.viewer-paging'].hidden);
 assert.equal(elements['.viewer-image'].getAttribute('aria-busy'),'true');
 elements.img.onload();
 assert.equal(elements['.viewer-image'].getAttribute('aria-busy'),'false');
 assert.match(elements['.viewer-status'].textContent,/1 из 2/);
 elements['.viewer-zoom'].children[1].emit('click');
 assert.equal(elements['.viewer-image'].dataset.scale,'actual');
 elements['[data-next-screen]'].emit('click');
 assert.match(elements.img.src,/test-only/);
 assert(elements['[data-next-screen]'].disabled);
 const staleLoad=elements.img.onload;
 elements['.viewer-devices'].children[1].emit('click');
 assert.equal(elements['.viewer-image'].dataset.device,'phone');
 assert.equal(elements['.viewer-image'].dataset.scale,'fit');
 assert(elements['.viewer-screens'].hidden && elements['.viewer-zoom'].hidden);
 assert.match(elements.img.src,/mobile\/duman/);
 staleLoad();
 assert.match(elements['.viewer-status'].textContent,/загружаем/,'Old load must not finish the next screen');
 elements.img.onerror();
 assert(elements.img.hidden && !elements['.viewer-error'].hidden);
 elements['[data-retry-viewer]'].emit('click');
 assert(!elements.img.hidden && elements['.viewer-error'].hidden);
 elements.img.onload();
 assert.match(elements['.viewer-status'].textContent,/Телефон · Каталог/);
 elements['[data-close-viewer]'].emit('click');
 assert(!viewer.open && focused===links[2]);
 assert.equal(elements.img.onload,null);
 links.at(-1).emit('click',click);
 assert(elements['.viewer-devices'].hidden,'Single device must not present a fake choice');
 assert(elements['.viewer-screens'].hidden,'Single screen must not present a fake choice');
 assert.match(elements['.viewer-inquiry'].textContent,/похожий сайт$/);
 viewer.close();
 console.log('Viewer controller passed: modifier click, multi-screen paging, scale, devices, stale load, error/retry, close/focus and single-option controls. No browser or network used.');
} finally {globalThis.document=originalDocument;}
