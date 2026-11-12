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
viewer.getBoundingClientRect=()=>({left:20,right:980,top:20,bottom:780});
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
const originalWindow=globalThis.window;
// Ширина экрана для окна просмотра: на узком (до 700 px) проект открывается мобильным снимком, если он есть
let narrowScreen=false;
globalThis.window={matchMedia:query=>({matches:narrowScreen&&query==='(max-width: 700px)'})};
const originalTimeout=globalThis.setTimeout;
const originalClearTimeout=globalThis.clearTimeout;
const timers=new Map();let timerId=0;
globalThis.setTimeout=(fn)=>{timers.set(++timerId,fn);return timerId;};
globalThis.clearTimeout=id=>timers.delete(id);
globalThis.document={
 get activeElement(){return focused;},
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
 viewer.scrollTop=500;
 elements['.viewer-zoom'].children[1].emit('click');
 assert.equal(viewer.scrollTop,0,'Changing scale must show the top of the screen');
 assert.equal(elements['.viewer-image'].dataset.scale,'actual');
 elements['.viewer-devices'].children[0].emit('click');
 assert.equal(elements['.viewer-image'].dataset.scale,'actual','Re-selecting device must not reset zoom');
 viewer.scrollTop=900;
 elements['[data-next-screen]'].emit('click');
 assert.equal(viewer.scrollTop,0,'Next screen must not inherit the previous screen scroll');
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
 const lateLoad=elements.img.onload;
 elements.img.onerror();
 assert(elements.img.hidden && !elements['.viewer-error'].hidden);
 lateLoad();
 assert(!elements['.viewer-error'].hidden,'Late load after failure must not dismiss the error');
 elements['[data-retry-viewer]'].focus();
 elements['[data-retry-viewer]'].emit('click');
 assert.equal(focused,elements['.viewer-image'],'Retry must move focus out of the hidden error');
 assert(!elements.img.hidden && elements['.viewer-error'].hidden);
 elements.img.onload();
 assert.match(elements['.viewer-status'].textContent,/Телефон · Каталог/);
 assert.equal(timers.size,0,'Load must cancel the timeout');
 elements['.viewer-devices'].children[0].emit('click');
 const loadAfterTimeout=elements.img.onload;
 [...timers.values()][0]();
 assert(elements.img.hidden && !elements['.viewer-error'].hidden,'Hung load must time out');
 loadAfterTimeout();
 assert(!elements['.viewer-error'].hidden,'Late load must not override timeout');
 elements['[data-retry-viewer]'].emit('click');
 elements['[data-close-viewer]'].emit('click');
 assert(!viewer.open && focused===links[2]);
 assert.equal(elements.img.onload,null);
 assert.equal(timers.size,0,'Close must cancel loading timers');
 links.at(-1).emit('click',click);
 assert(elements['.viewer-devices'].hidden,'Single device must not present a fake choice');
 assert(elements['.viewer-screens'].hidden,'Single screen must not present a fake choice');
 assert.match(elements['.viewer-inquiry'].textContent,/похожий сайт$/);
 viewer.close();
 for(const link of links){
   link.emit('click',click);
   const item=projects[link.dataset.projectPreview];
   assert.equal(elements['#viewer-title'].textContent,item.name);
   assert.equal(elements['.viewer-image'].dataset.device,'desktop');
   elements.img.onload();
   for(const button of elements['.viewer-devices'].children){
     if(button.hidden)continue;
     button.emit('click');
     assert.equal(elements['.viewer-image'].dataset.device,button.dataset.device);
     const screen=item.screens.find(screen=>screen.device===button.dataset.device);
     assert.equal(elements.img.src,screen.src);
     assert.match(elements['.viewer-image'].getAttribute('aria-label'),new RegExp(item.name));
     if(elements.img.onload)elements.img.onload();
   }
   viewer.close();
   assert(focused===link);
 }
 narrowScreen=true;
 for(const link of links){
   link.emit('click',click);
   const item=projects[link.dataset.projectPreview];
   const expected=item.screens.some(screen=>screen.device==='phone')?'phone':'desktop';
   assert.equal(elements['.viewer-image'].dataset.device,expected,`${item.name}: narrow screen must open ${expected}`);
   if(elements.img.onload)elements.img.onload();
   viewer.close();
 }
 narrowScreen=false;
 links[0].emit('click',click);
 const inside={button:0,clientX:30,clientY:30};
 const outside={button:0,clientX:5,clientY:5};
 viewer.emit('pointerdown',inside);viewer.emit('click',inside);
 assert(viewer.open,'Click inside dialog must not dismiss it');
 viewer.emit('pointerdown',inside);viewer.emit('click',outside);
 assert(viewer.open,'Drag from image to backdrop must not dismiss it');
 viewer.emit('pointerdown',outside);viewer.emit('click',inside);
 assert(viewer.open,'Drag from backdrop into dialog must not dismiss it');
 viewer.emit('pointerdown',outside);viewer.emit('pointercancel');viewer.emit('click',outside);
 assert(viewer.open,'Cancelled backdrop gesture must not dismiss it');
 viewer.emit('pointerdown',outside);viewer.emit('click',outside);
 assert(!viewer.open && focused===links[0],'Backdrop click must close and return focus');
 assert.equal(timers.size,0);
 console.log('Viewer controller passed: modifier click, paging, scale, devices, stale load, error/retry, timeout/recovery, close/focus, single-option controls and phone shot on narrow screens. No browser or network used.');
} finally {globalThis.window=originalWindow;globalThis.document=originalDocument;globalThis.setTimeout=originalTimeout;globalThis.clearTimeout=originalClearTimeout;}
