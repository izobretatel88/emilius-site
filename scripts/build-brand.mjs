// Собирает фирменные картинки из PNG логотипа владельца (public/brand/logo.png,
// готовится scripts/logo-from-png.py — знак не перерисовываем):
//   public/favicon.svg, public/favicon-32.png, public/apple-touch-icon.png,
//   public/brand/logo-mark.png, public/og.jpg, public/og/insales.jpg, public/og/insales-seller.jpg, public/og/projects.jpg
//
// Запуск: npm run build && npm run brand
// Картинки рисует установленный Google Chrome в headless-режиме,
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const PUB = join(ROOT, 'public');
const TMP = mkdtempSync(join(tmpdir(), 'emilius-brand-'));
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function shoot(html, out, w, h, { transparent = false } = {}) {
  const file = join(TMP, `${Math.random().toString(36).slice(2)}.html`);
  writeFileSync(file, html);
  const args = [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${w},${h}`, '--allow-file-access-from-files', `--screenshot=${out}`,
  ];
  if (transparent) args.push('--default-background-color=00000000');
  execFileSync(CHROME, [...args, `file://${file}`], { stdio: 'ignore' });
}

const page = (body, css = '') =>
  `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden}${css}</style></head><body>${body}</body></html>`;

const LOGO = join(PUB, 'brand', 'logo.png');
const logoUrl = `file://${LOGO}`;
// Знак по центру квадрата side×side с полем pad
const squareLogo = (side, pad, bg = 'transparent') =>
  page(`<div style="width:${side}px;height:${side}px;display:grid;place-items:center;background:${bg}"><img src="${logoUrl}" style="max-width:${side - pad * 2}px;max-height:${side - pad * 2}px"></div>`);

// 1. favicon.svg — та же PNG внутри SVG: браузеры, которые берут svg-иконку, покажут картинку владельца
const pngB64 = readFileSync(LOGO).toString('base64');
const [lw, lh] = [267, 401];
writeFileSync(
  join(PUB, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lh} ${lh}"><image href="data:image/png;base64,${pngB64}" x="${(lh - lw) / 2}" y="0" width="${lw}" height="${lh}"/></svg>`,
);

// 2. favicon-32.png — прозрачный фон
shoot(squareLogo(32, 1), join(PUB, 'favicon-32.png'), 32, 32, { transparent: true });

// 3. apple-touch-icon.png — светлый квадрат, iOS сам скруглит углы
shoot(squareLogo(180, 28, '#fefefe'), join(PUB, 'apple-touch-icon.png'), 180, 180);

// 4. brand/logo-mark.png — знак 512 px на прозрачном фоне, для соцсетей и документов
shoot(squareLogo(512, 40), join(PUB, 'brand', 'logo-mark.png'), 512, 512, { transparent: true });

// 5. og.jpg — 1200×630, миниатюра главной в мессенджерах. Решение владельца 22.11.2026: тёмная тема сайта,
//    знак по центру с мягким свечением, под ним «Наша миссия» и миссия в два тона, внизу название.
//    Черновики и стенд «как выглядит в Телеграме, WhatsApp, ВКонтакте» — design/og-home/.
//    Прежний вариант с колесом был бледным и мелким в окне Телеграма.
//    Размеры текста подобраны под Телеграм: превью там шириной ~430 px, метка 32 px читается как ~11 px.
{
  const font = (w) =>
    `@font-face{font-family:Glober;font-weight:${w};src:url('file://${ROOT}/src/styles/fonts/glober-${w}.woff2') format('woff2')}`;
  const css = `
    ${font(600)}${font(700)}${font(800)}
    body{width:1200px;height:630px;box-sizing:border-box;font-family:Glober,sans-serif;color:var(--ink);text-align:center;
      display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 60px 40px;
      background:radial-gradient(500px 300px at 50% 22%,color-mix(in srgb,var(--ray-2) 40%,transparent),transparent 70%),var(--page)}
    .mark{transform:translateY(-40px)} /* знак выше, текст на месте (владелец) */
    .mark img{display:block;height:172px;filter:drop-shadow(0 0 40px color-mix(in srgb,var(--spark-glow) 25%,transparent))}
    .eyebrow{margin-top:34px;color:var(--teal-text);font-weight:800;font-size:32px;letter-spacing:.06em;text-transform:uppercase}
    h1{margin:12px 0 0;font-weight:600;font-size:62px;line-height:1.06;letter-spacing:-.015em}
    h1 span{color:var(--ink-2)}
    .name{position:absolute;left:0;right:0;bottom:38px;font-weight:700;font-size:30px;color:var(--ink-2)}`;
  const body = `
    <div class="mark"><img src="${logoUrl}" alt=""></div>
    <div class="eyebrow">Наша миссия</div>
    <h1>Помогаем великолепным людям<br><span>создавать великолепные продукты</span></h1>
    <div class="name">Эмилиус Эдженси</div>`;
  const ogHtml = page(body, css)
    .replace('data-theme="light"', 'data-theme="dark"')
    .replace('<style>', `<link rel="stylesheet" href="file://${ROOT}/src/styles/tokens.css"><style>`);
  const png = join(TMP, 'og.png');
  shoot(ogHtml, png, 1200, 630);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '3', join(PUB, 'og.jpg')]);
}

// 6. Миниатюры страниц услуги «Магазин на шаблоне InSales»: public/og/insales.jpg и public/og/insales-seller.jpg.
//    Их показывают Телеграм, ВКонтакте и мессенджеры, когда ссылку пересылают. Заголовки повторяют первый экран
//    лендинга (HERO в src/data/insales.ts), цены берутся из калькулятора, телефон — тот же живой магазин, что на странице.
const { PACKAGES } = await import(pathToFileURL(join(ROOT, 'docs', 'insales-service', 'calc', 'estimate.js')).href);
const from = (n) => `от ${Math.round(n / 1000)} 000 ₽`;
const CARDS = [
  {
    file: 'insales.jpg',
    eyebrow: 'Интернет-магазин на InSales',
    title: 'Свой интернет-магазин за 3–5 недель',
    sub: 'Сдаём, когда проходит настоящий заказ с телефона',
    chips: [from(PACKAGES.S.min), 'цена фиксируется до старта'],
    phone: 'happyanimal',
  },
  {
    file: 'insales-seller.jpg',
    eyebrow: 'Магазин для продавцов WB и Ozon',
    title: 'Свой магазин рядом с Wildberries и Ozon',
    sub: 'Остатки на сайте и на площадках — общие',
    chips: [from(PACKAGES.P.min), '3–5 недель', 'площадки работают как раньше'],
    phone: 'duman',
  },
];
mkdirSync(join(PUB, 'og'), { recursive: true });
const fontFace = (w) =>
  `@font-face{font-family:Glober;font-weight:${w};src:url('file://${ROOT}/src/styles/fonts/glober-${w}.woff2') format('woff2')}`;
const cardCss = `
  ${[400, 600, 700, 800].map(fontFace).join('')}
  body{width:1200px;height:630px;font-family:Glober,sans-serif;color:var(--ink);background:
    linear-gradient(var(--veil-a),var(--veil-b)),conic-gradient(from 200deg at 70% 45%,var(--ray-1),var(--ray-2),var(--ray-3),var(--ray-4),var(--ray-1));
    background-color:var(--page);display:grid;grid-template-columns:1fr 292px;gap:56px;align-items:center;padding:0 88px 0 72px;box-sizing:border-box}
  .left{display:flex;flex-direction:column;gap:22px}
  .pill{align-self:flex-start;display:inline-flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--hair);border-radius:20px;padding:10px 24px;font-weight:600;font-size:24px}
  .pill img{width:27px;height:40px;display:block}
  .eyebrow{color:var(--teal-text);font-weight:800;font-size:20px;letter-spacing:.05em;text-transform:uppercase;margin-top:14px}
  h1{margin:6px 0 0;font-weight:600;font-size:58px;line-height:1.08;text-wrap:balance}
  .sub{font-size:26px;color:var(--ink-2);line-height:1.3}
  .chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}
  .chip{background:var(--card);border:1px solid var(--hair);border-radius:13px;padding:9px 18px;font-weight:600;font-size:21px}
  .chip.price{background:var(--teal-btn);border-color:var(--teal-btn);color:var(--on-teal)}
  .phone{width:292px;height:594px;border-radius:50px;background:#16181a;padding:12px;box-sizing:border-box;box-shadow:var(--shadow-pop)}
  .phone img{display:block;width:100%;height:100%;object-fit:cover;object-position:top;border-radius:39px;background:#fff}`;
for (const c of CARDS) {
  const body = `
    <div class="left">
      <div class="pill"><span>Эмилиус</span><img src="${logoUrl}" alt=""><span>Эдженси</span></div>
      <div><div class="eyebrow">${c.eyebrow}</div><h1>${c.title}</h1></div>
      <div class="sub">${c.sub}</div>
      <div class="chips">${c.chips.map((x, i) => `<span class="chip${i === 0 ? ' price' : ''}">${x}</span>`).join('')}</div>
    </div>
    <div class="phone"><img src="file://${join(PUB, 'cases', 'mobile', `${c.phone}.webp`)}" alt=""></div>`;
  const html = page(body, cardCss).replace('<style>', `<link rel="stylesheet" href="file://${ROOT}/src/styles/tokens.css"><style>`);
  const png = join(TMP, `${c.file}.png`);
  shoot(html, png, 1200, 630);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '3', join(PUB, 'og', c.file)]);
}

// 7. Миниатюра галереи /projects/: public/og/projects.jpg. Ссылку на портфолио пересылают клиентам —
//    в превью видны настоящие работы: шесть снимков галереи (первый кадр записи, public/cases/gallery/{id}-800.webp).
// Happy Animal не берём, пока на их сайте плашка «приём заказов недоступен» (docs/HANDOFF.md)
const SHOTS = ['alohagaia', 'navalishenskoe', 'zalina', 'wizzu', 'duman', 'geekboards'];
const projectsCss = `
  ${[400, 600, 700, 800].map(fontFace).join('')}
  body{width:1200px;height:630px;font-family:Glober,sans-serif;color:var(--ink);background:
    linear-gradient(var(--veil-a),var(--veil-b)),conic-gradient(from 200deg at 70% 45%,var(--ray-1),var(--ray-2),var(--ray-3),var(--ray-4),var(--ray-1));
    background-color:var(--page);display:grid;grid-template-columns:1fr 540px;gap:48px;align-items:center;padding:0 56px 0 72px;box-sizing:border-box}
  .left{display:flex;flex-direction:column;gap:22px}
  .pill{align-self:flex-start;display:inline-flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--hair);border-radius:20px;padding:10px 24px;font-weight:600;font-size:24px}
  .pill img{width:27px;height:40px;display:block}
  .eyebrow{color:var(--teal-text);font-weight:800;font-size:20px;letter-spacing:.05em;text-transform:uppercase;margin-top:14px}
  h1{margin:6px 0 0;font-weight:600;font-size:54px;line-height:1.08;text-wrap:balance}
  .sub{font-size:25px;color:var(--ink-2);line-height:1.3}
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
  .tile{background:var(--card);border-radius:16px;padding:7px;box-shadow:var(--shadow-card)}
  .tile img{display:block;width:100%;aspect-ratio:8/5;object-fit:cover;object-position:top;border-radius:10px}`;
const projectsBody = `
  <div class="left">
    <div class="pill"><span>Эмилиус</span><img src="${logoUrl}" alt=""><span>Эдженси</span></div>
    <div><div class="eyebrow">Проекты</div><h1>Магазины и сайты, которые работают</h1></div>
    <div class="sub">12 работ: от фронтенда на inSales до полного цикла — дизайн, разработка, маркетинг</div>
  </div>
  <div class="grid">${SHOTS.map((id) => `<div class="tile"><img src="file://${join(PUB, 'cases', 'gallery', `${id}-800.webp`)}" alt=""></div>`).join('')}</div>`;
{
  const html = page(projectsBody, projectsCss).replace('<style>', `<link rel="stylesheet" href="file://${ROOT}/src/styles/tokens.css"><style>`);
  const png = join(TMP, 'projects.png');
  shoot(html, png, 1200, 630);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '3', join(PUB, 'og', 'projects.jpg')]);
}

console.log('Готово: favicon.svg, favicon-32.png, apple-touch-icon.png, brand/logo-mark.png, og.jpg, og/insales.jpg, og/insales-seller.jpg, og/projects.jpg');
