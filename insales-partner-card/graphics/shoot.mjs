// Снимает первые экраны магазинов-кейсов через Chrome DevTools Protocol, без сторонних пакетов.
// Перед снимком прячет всплывающие окна (промокоды, cookies, выбор адреса, чаты).
// node partner-insales/graphics/shoot.mjs  → shots/<id>-desk.png (1440×900 @2x), shots/<id>-mob.png (390×844 @3x)
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'shots');
mkdirSync(out, { recursive: true });

const SITES = [
  ['alohagaia', 'https://alohagaia.ru/'],
  ['duman', 'https://www.duman.store/'],
  ['geekboards', 'https://geekboards.ru/'],
  ['limemart', 'https://limemart.wizzu.ru/'],
];
const UA_MOB = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// Прячем всё фиксированное поверх контента, кроме шапки у верхнего края.
// Прячем только всплывашки: фиксированный блок с текстом про промокод, cookies, адрес, плюс мелкие плавающие кнопки чатов.
const CLEAN = `(() => {
  const t = /cookie|получить промокод|адрес доставки|да, верно/i;
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if (s.position !== 'fixed') continue;
    const r = el.getBoundingClientRect();
    const small = r.width < 140 && r.height < 140 && r.top > innerHeight * 0.6;   // кнопка чата
    const popup = t.test(el.innerText || '') && r.width < innerWidth * 0.9;
    if (small || popup) el.style.setProperty('display', 'none', 'important');
  }
  // окно «Адрес доставки» на мобильном Duman лежит внутри фиксированной панели — поднимаемся до его карточки
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length || !/^Адрес доставки$/i.test((el.textContent || '').trim())) continue;
    // в шапке Aloha Gaia есть скрытый пункт «Адрес доставки» — шапку сайта не трогаем
    if (el.closest('header')) continue;
    let box = el;
    while (box.parentElement && box.parentElement.getBoundingClientRect().height < 320 && !/^(HEADER|BODY)$/.test(box.parentElement.tagName)) box = box.parentElement;
    box.style.setProperty('display', 'none', 'important');
  }
  // служебные и рекламные полосы магазина («из-за высокой загруженности…», «скидка по промокоду WELCOME») — в портфолио это шум
  for (const el of document.querySelectorAll('body *')) {
    const txt = (el.textContent || '').trim();
    // только сама полоса: короткий текст (у Duman полоса и шапка лежат в одном .header__wrapper с двумя детьми)
    if (txt.length > 140 || !/высокой загруженности|промокоду[\s\u00a0]*WELCOME/i.test(txt)) continue;
    let box = el;
    // поднимаемся, пока у родителя нет другого текста: так прячется вся полоса, но не шапка с логотипом и меню
    const own = (box.textContent || '').trim();
    while (box.parentElement && box.parentElement !== document.body && (box.parentElement.textContent || '').trim() === own) box = box.parentElement;
    box.style.setProperty('display', 'none', 'important');
  }
  for (const el of document.querySelectorAll('jdiv, [class*=cookie i], [id*=cookie i]')) el.style.setProperty('display', 'none', 'important');
  // в шапке Aloha Gaia город не определяется в безголовом Chrome и пишется «не найдено» — прячем этот пункт целиком (с иконкой)
  for (const el of document.querySelectorAll('header *')) {
    if (el.children.length || !/^не найдено$/i.test((el.textContent || '').trim())) continue;
    let box = el;
    while (box.parentElement && box.parentElement.tagName !== 'HEADER' && (box.parentElement.textContent || '').trim() === 'не найдено') box = box.parentElement;
    if (box.getBoundingClientRect().width > 0) box.style.setProperty('visibility', 'hidden', 'important');
  }
  scrollTo(0, 0);
})()`;

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=9333',
  `--user-data-dir=${process.env.TMPDIR || '/tmp'}/partner-shots-cdp`, 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const list = await (await fetch('http://127.0.0.1:9333/json')).json();
    const page = list.find(t => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch { await sleep(250); }
}
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });

await send('Page.enable'); await send('Runtime.enable');
for (const [name, url] of SITES) {
  for (const v of [
    { suf: 'desk', w: 1440, h: 900, k: 2, mobile: false, ua: '' },
    { suf: 'mob', w: 390, h: 844, k: 3, mobile: true, ua: UA_MOB },
  ]) {
    await send('Emulation.setDeviceMetricsOverride', { width: v.w, height: v.h, deviceScaleFactor: v.k, mobile: v.mobile });
    await send('Emulation.setUserAgentOverride', { userAgent: v.ua || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' });
    await send('Page.navigate', { url });
    await sleep(9000);
    await send('Runtime.evaluate', { expression: CLEAN });
    await sleep(800);
    await send('Runtime.evaluate', { expression: CLEAN });
    await sleep(400);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, `${name}-${v.suf}.png`), Buffer.from(shot.result.data, 'base64'));
    console.log('ok', name, v.suf);
  }
}
ws.close(); chrome.kill();
