// Черновики миниатюры главной (og.jpg) — три варианта для выбора владельцем.
// Запуск: npm run build && node design/og-home/drafts.mjs (или BASE_PATH-сборка в .local-site: DIST=.local-site)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '../..');
const PUB = join(ROOT, 'public');
const OUT = join(ROOT, 'design', 'og-home');
const TMP = mkdtempSync(join(tmpdir(), 'og-home-'));
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const logo = `file://${PUB}/brand/logo.png`;
const font = (w) => `@font-face{font-family:Glober;font-weight:${w};src:url('file://${ROOT}/src/styles/fonts/glober-${w}.woff2') format('woff2')}`;
const page = (theme, css, body) => `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><link rel="stylesheet" href="file://${ROOT}/src/styles/tokens.css"><style>${[400, 600, 700, 800].map(font).join('')}html,body{margin:0;overflow:hidden}body{width:1200px;height:630px;box-sizing:border-box;font-family:Glober,sans-serif;color:var(--ink);background:var(--page)}${css}</style></head><body>${body}</body></html>`;
const shoot = (name, html) => {
  const f = join(TMP, name + '.html'); writeFileSync(f, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1200,630', '--allow-file-access-from-files', `--screenshot=${join(OUT, name + '.png')}`, `file://${f}`], { stdio: 'ignore' });
};

// Колесо из собранной главной — как в scripts/build-brand.mjs
const dist = readFileSync(join(ROOT, process.env.DIST || 'dist', 'index.html'), 'utf8');
const s = dist.indexOf('<div class="wheel-box"');
const wheel = dist.slice(s, dist.indexOf('<div class="center-q"', s))
  .concat(`<img class="mid" src="${logo}" alt=""></div>`)
  .replace(/<svg class="wheel-overlay"[\s\S]*?<\/svg>/, '').replace(/<text class="attn"[\s\S]*?<\/text>/, '')
  .replace(/<a [^>]*class="sector-link"[\s\S]*?<\/a>/g, '').replace(/<text class="center-word center-sector"[\s\S]*?<\/text>/g, '');
const wheelCss = (size) => `
  .wheel-box{position:absolute;width:${size}px;height:${size}px}
  .wheel-box svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
  .wheel-box .mid{position:absolute;left:50%;top:50%;width:${Math.round(size * 0.13)}px;transform:translate(-50%,-50%)}
  .sector-fill{fill:var(--f);opacity:1} .sector-label{opacity:1} .ticks{opacity:.9}
  .num{fill:var(--teal-num)} .day-cell{display:none}
  .dividers line{stroke:var(--wheel-line);stroke-width:1} .tick{stroke:var(--wheel-line)} .tick.quarter{stroke:var(--teal);opacity:.6}`;
const brand = `<div class="brand"><img src="${logo}" alt=""><span>Эмилиус Эдженси</span></div>`;

// A — «Крупно»: тот же смысл, но всё в 1,5 раза крупнее, колесо большое и уходит за край
shoot('a-krupno', page('light', `
  body{padding:64px 0 0 72px;background:linear-gradient(var(--veil-a),var(--veil-b)),conic-gradient(from 200deg at 75% 50%,var(--ray-1),var(--ray-2),var(--ray-3),var(--ray-4),var(--ray-1));background-color:var(--page)}
  .brand{display:flex;align-items:center;gap:16px;font-weight:700;font-size:34px}.brand img{height:58px}
  h1{position:relative;z-index:2;margin:52px 0 0;width:640px;font-weight:600;font-size:58px;line-height:1.06;letter-spacing:-.01em}
  h1 span{color:var(--ink-2)}
  .sub{position:relative;z-index:2;margin-top:30px;font-size:27px;color:var(--ink-2)}
  ${wheelCss(700)} .wheel-box{left:740px;top:-35px}`,
  `${brand}<h1>Помогаем великолепным людям <span>создавать великолепные продукты</span></h1><div class="sub">Касдев → дизайн → разработка → маркетинг</div>${wheel}`));

// B — «Работы»: миссия и настоящие проекты — превью сразу показывает, что мы делаем
const shots = ['alohagaia', 'zalina', 'navalishenskoe', 'geekboards'];
shoot('b-raboty', page('light', `
  body{display:grid;grid-template-columns:1fr 470px;gap:40px;align-items:center;padding:0 0 0 72px;overflow:hidden}
  .left{display:flex;flex-direction:column;gap:30px}
  .brand{display:flex;align-items:center;gap:16px;font-weight:700;font-size:32px}.brand img{height:54px}
  h1{margin:0;font-weight:600;font-size:54px;line-height:1.06;letter-spacing:-.01em}h1 span{color:var(--ink-2)}
  .sub{font-size:25px;color:var(--ink-2)}
  .grid{display:grid;grid-template-columns:repeat(2,230px);gap:16px;transform:rotate(-5deg) translate(10px,-40px)}
  .tile{background:var(--card);border-radius:20px;padding:8px;box-shadow:var(--shadow-card)}
  .tile img{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;object-position:top;border-radius:13px}
  .tile:nth-child(even){transform:translateY(60px)}`,
  `<div class="left">${brand}<h1>Помогаем великолепным людям <span>создавать великолепные продукты</span></h1><div class="sub">Дизайн, разработка и маркетинг по кругу</div></div>
   <div class="grid">${shots.map((id) => `<div class="tile"><img src="file://${PUB}/cases/gallery/${id}-800.webp" alt=""></div>`).join('')}</div>`));

// C — «Знак»: тёмная тема сайта, знак главным героем, подпись коротко
shoot('c-znak', page('dark', `
  body{display:grid;grid-template-columns:400px 1fr;gap:40px;align-items:center;padding:0 70px 0 60px;
    background:radial-gradient(520px 420px at 250px 50%,color-mix(in srgb,var(--ray-2) 40%,transparent),transparent 70%),radial-gradient(500px 400px at 330px 60%,color-mix(in srgb,var(--ray-4) 35%,transparent),transparent 70%),var(--page)}
  .mark{display:grid;place-items:center}.mark img{height:380px;filter:drop-shadow(0 0 40px color-mix(in srgb,var(--spark-glow) 25%,transparent))}
  .name{font-weight:700;font-size:40px;color:var(--ink-2)}
  .eyebrow{margin-top:34px;color:var(--teal-text);font-weight:800;font-size:20px;letter-spacing:.06em;text-transform:uppercase}
    h1{margin:14px 0 0;font-weight:600;font-size:55px;line-height:1.06;letter-spacing:-.01em}
  .sub{margin-top:30px;font-size:26px;color:var(--ink-2)}`,
  `<div class="mark"><img src="${logo}" alt=""></div><div><div class="name">Эмилиус Эдженси</div><div class="eyebrow">Наша миссия</div><h1>Помогаем великолепным людям создавать великолепные продукты</h1></div>`));
console.log('ok', OUT);

// A2 — колесо целиком (владелец: «колесо оставить, оно норм»), крупнее и ярче прежнего; текст крупнее
shoot('a2-koleso', page('light', `
  body{padding:62px 0 0 64px;background:linear-gradient(var(--veil-a),var(--veil-b)),conic-gradient(from 200deg at 74% 50%,var(--ray-1),var(--ray-2),var(--ray-3),var(--ray-4),var(--ray-1));background-color:var(--page)}
  .brand{display:flex;align-items:center;gap:14px;font-weight:700;font-size:30px}.brand img{height:50px}
  h1{margin:48px 0 0;width:560px;font-weight:600;font-size:52px;line-height:1.08;letter-spacing:-.01em}
  h1 span{color:var(--ink-2)}
  .sub{margin-top:30px;font-size:24px;color:var(--ink-2)}
  ${wheelCss(580)} .wheel-box{left:600px;top:25px}`,
  `${brand}<h1>Помогаем великолепным людям <span>создавать великолепные продукты</span></h1><div class="sub">Касдев → дизайн → разработка → маркетинг</div>${wheel}`));
console.log('a2');

// Колесо за краем — ещё три подачи (владелец: «где колесо не целиком тоже нравится»)
const cropped = (name, size, left, top, h1px = 56, extra = '') => shoot(name, page('light', `
  body{padding:62px 0 0 68px;background:linear-gradient(var(--veil-a),var(--veil-b)),conic-gradient(from 200deg at 80% 50%,var(--ray-1),var(--ray-2),var(--ray-3),var(--ray-4),var(--ray-1));background-color:var(--page)}
  .brand{display:flex;align-items:center;gap:14px;font-weight:700;font-size:30px;position:relative;z-index:2}.brand img{height:50px}
  h1{position:relative;z-index:2;margin:48px 0 0;width:600px;font-weight:600;font-size:${h1px}px;line-height:1.07;letter-spacing:-.01em}
  h1 span{color:var(--ink-2)}
  .sub{position:relative;z-index:2;margin-top:30px;font-size:24px;color:var(--ink-2)}
  ${wheelCss(size)} .wheel-box{left:${left}px;top:${top}px} ${extra}`,
  `${brand}<h1>Помогаем великолепным людям <span>создавать великолепные продукты</span></h1><div class="sub">Касдев → дизайн → разработка → маркетинг</div>${wheel}`));
// a3 — видно чуть больше половины колеса, центр со знаком на виду
cropped('a3-pol-kolesa', 640, 735, -5);
// a4 — огромное колесо, видна только левая дуга с этапами «маркетинг» и «касдев» и центр у края
cropped('a4-duga', 900, 760, -135);
// a5 — колесо уходит в правый нижний угол: видны три этапа, центр в кадре
cropped('a5-ugol', 760, 690, 150);
console.log('a3-a5');

// Эксперименты, серия 2 (владелец: «давай ещё эксперименты»)
const bgRays = (at) => `background:linear-gradient(var(--veil-a),var(--veil-b)),conic-gradient(from 200deg at ${at},var(--ray-1),var(--ray-2),var(--ray-3),var(--ray-4),var(--ray-1));background-color:var(--page)`;
const H1 = `<h1>Помогаем великолепным людям <span>создавать великолепные продукты</span></h1>`;
const SUB = `<div class="sub">Касдев → дизайн → разработка → маркетинг</div>`;
const txt = (h = 54, w = 600) => `.brand{display:flex;align-items:center;gap:14px;font-weight:700;font-size:30px;position:relative;z-index:2}.brand img{height:50px}
  h1{position:relative;z-index:2;margin:46px 0 0;width:${w}px;font-weight:600;font-size:${h}px;line-height:1.07;letter-spacing:-.01em} h1 span{color:var(--ink-2)}
  .sub{position:relative;z-index:2;margin-top:28px;font-size:24px;color:var(--ink-2)}`;

// e1 — тёмная тема сайта, колесо за краем
shoot('e1-temnyi', page('dark', `body{padding:62px 0 0 68px;${bgRays('80% 50%')}} ${txt()} ${wheelCss(640)} .wheel-box{left:735px;top:-5px}`, `${brand}${H1}${SUB}${wheel}`));

// e2 — «восход»: колесо полукругом снизу по центру, текст над ним по центру
shoot('e2-voshod', page('light', `body{padding:52px 80px 0;text-align:center;${bgRays('50% 100%')}}
  .brand{display:inline-flex;align-items:center;gap:14px;font-weight:700;font-size:28px}.brand img{height:46px}
  h1{margin:26px auto 0;max-width:1000px;font-weight:600;font-size:52px;line-height:1.07;letter-spacing:-.01em} h1 span{color:var(--ink-2)}
  ${wheelCss(820)} .wheel-box{left:190px;top:360px}`, `${brand}${H1}${wheel}`));

// e3 — коротко и крупно: одна мысль про круг, колесо справа за краем
shoot('e3-korotko', page('light', `body{padding:62px 0 0 68px;${bgRays('80% 50%')}} ${txt(76, 640)} h1{margin-top:70px} ${wheelCss(640)} .wheel-box{left:735px;top:-5px}`,
  `${brand}<h1>Делаем продукты <span>по кругу</span></h1><div class="sub">Касдев → дизайн → разработка → маркетинг.<br>52 дня на итерацию.</div>${wheel}`));

// e4 — колесо слева за краем, текст справа
shoot('e4-sleva', page('light', `body{padding:62px 60px 0 560px;${bgRays('15% 50%')}} ${txt(50, 580)} ${wheelCss(640)} .wheel-box{left:-180px;top:-5px}`, `${brand}${H1}${SUB}${wheel}`));

// e5 — колесо на белой карточке-полосе справа (как блок «Делаем по кругу» на сайте)
shoot('e5-kartochka', page('light', `body{padding:62px 0 0 68px} ${txt(52, 560)}
  .card{position:absolute;left:700px;top:40px;width:560px;height:550px;background:var(--card);border-radius:20px 0 0 20px;box-shadow:var(--shadow-card);overflow:hidden}
  .card .tag{position:absolute;left:32px;top:26px;font-weight:600;font-size:22px} .card .meta{position:absolute;right:120px;top:30px;font-size:18px;color:var(--ink-3)}
  ${wheelCss(620)} .card .wheel-box{left:40px;top:80px}`,
  `${brand}${H1}${SUB}<div class="card"><div class="tag">Делаем по кругу</div><div class="meta">52 дня · 4 этапа</div>${wheel}</div>`));
console.log('e1-e5');

// Серия 3 — текст и композиция (владелец: «надо больше с текстом поработать, композицией»).
// Телеграм уже пишет под картинкой название и описание сайта — на картинке одна мысль крупно, остальное тихо.
// Колесо справа за краем (понравилось владельцу), центр колеса и заголовок на одной горизонтали.
const W = `${wheelCss(640)} .wheel-box{left:735px;top:-5px}`;
const stages = [['касдев', '01–13', 'custdev'], ['дизайн', '14–26', 'design'], ['разработка', '27–39', 'dev'], ['маркетинг', '40–52', 'marketing']];
const base = `body{${bgRays('80% 50%')};padding:0 0 0 72px}
  .col{position:absolute;left:72px;top:0;bottom:0;width:600px;display:flex;flex-direction:column;justify-content:center}
  .brand{position:absolute;left:72px;top:56px;display:flex;align-items:center;gap:12px;font-weight:700;font-size:26px}.brand img{height:42px}
  h1{margin:0;font-weight:600;letter-spacing:-.015em;line-height:1.02} h1 span{color:var(--ink-2)}`;

// t1 — одна мысль, две строки, по центру колеса; снизу тихая строка этапов
shoot('t1-mysl', page('light', `${base} h1{font-size:84px}
  .foot{position:absolute;left:72px;bottom:52px;font-size:22px;color:var(--ink-3)}
  ${W}`, `${brand}<div class="col"><h1>Делаем<br>продукты<br><span>по кругу</span></h1></div><div class="foot">касдев → дизайн → разработка → маркетинг · 52 дня</div>${wheel}`));

// t2 — заголовок + легенда колеса: четыре этапа с днями, как подписи к схеме
shoot('t2-legenda', page('light', `${base} h1{font-size:64px}
  .legend{margin-top:40px;display:grid;grid-template-columns:repeat(2,auto);justify-content:start;column-gap:56px;row-gap:16px;font-size:24px}
  .legend div{display:flex;align-items:center;gap:12px} .legend i{width:14px;height:14px;border-radius:50%}
  .legend b{font-weight:600} .legend small{font-size:20px;color:var(--ink-3)}
  ${stages.map(([, , k]) => `.legend .${k} i{background:var(--sec-${k}-ink)}`).join('')}
  ${W}`, `${brand}<div class="col"><h1>Делаем продукты<br><span>по кругу</span></h1>
  <div class="legend">${stages.map(([t, d, k]) => `<div class="${k}"><i></i><b>${t}</b><small>${d}</small></div>`).join('')}</div></div>${wheel}`));

// t3 — миссия, но иерархия: строка-обещание крупно, миссия тише ниже
shoot('t3-missiya', page('light', `${base} h1{font-size:72px}
  .eyebrow{color:var(--teal-text);font-weight:800;font-size:18px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:22px}
  .sub{margin-top:30px;width:520px;font-size:27px;line-height:1.3;color:var(--ink-2)}
  ${W}`, `${brand}<div class="col"><div class="eyebrow">Продуктовая студия</div><h1>Великолепные <span>продукты</span></h1>
  <div class="sub">для великолепных людей — касдев, дизайн, разработка и маркетинг по кругу</div></div>${wheel}`));
console.log('t1-t3');

// C в светлой теме (владелец: «давай попробуем в светлом тоже»). Свечение на светлом не видно —
// вместо него мягкие цветные пятна фона из лучей страницы, чуть насыщеннее.
const znakLight = (name, spots) => shoot(name, page('light', `
  body{display:grid;grid-template-columns:400px 1fr;gap:40px;align-items:center;padding:0 70px 0 60px;
    background:${spots},var(--page)}
  .mark{display:grid;place-items:center}.mark img{height:380px}
  .name{font-weight:700;font-size:40px;color:var(--ink-2)}
  .eyebrow{margin-top:34px;color:var(--teal-text);font-weight:800;font-size:20px;letter-spacing:.06em;text-transform:uppercase}
    h1{margin:14px 0 0;font-weight:600;font-size:55px;line-height:1.06;letter-spacing:-.01em}
  .sub{margin-top:30px;font-size:26px;color:var(--ink-2)}`,
  `<div class="mark"><img src="${logo}" alt=""></div><div><div class="name">Эмилиус Эдженси</div><div class="eyebrow">Наша миссия</div><h1>Помогаем великолепным людям создавать великолепные продукты</h1></div>`));
znakLight('c-znak-light', `radial-gradient(520px 420px at 230px 40%,var(--sec-dev-now),transparent 70%),radial-gradient(480px 400px at 300px 70%,var(--sec-custdev-now),transparent 70%)`);
// вариант на белом — знак на чистом листе, как на карточке
znakLight('c-znak-white', `linear-gradient(var(--card),var(--card))`);
console.log('c-light');

// Серия K — знак + миссия, работа над композицией и текстом (тёмная тема)
const glow = `radial-gradient(520px 420px at 250px 50%,color-mix(in srgb,var(--ray-2) 40%,transparent),transparent 70%),radial-gradient(500px 400px at 330px 60%,color-mix(in srgb,var(--ray-4) 35%,transparent),transparent 70%),var(--page)`;
const kBase = `.eyebrow{color:var(--teal-text);font-weight:800;font-size:28px;letter-spacing:.06em;text-transform:uppercase}
  h1{margin:16px 0 0;font-weight:600;letter-spacing:-.015em;line-height:1.04} h1 span{color:var(--ink-2)}
  .mark img{display:block;filter:drop-shadow(0 0 40px color-mix(in srgb,var(--spark-glow) 25%,transparent))}`;
const MISSION = `Помогаем великолепным людям <span>создавать великолепные продукты</span>`;

// k1 — как на сайте: миссия в два тона (главное ярко, продолжение тише), название — тихой подписью внизу,
// знак и текст на одной оси, текст крупнее
shoot('k1-dva-tona', page('dark', `body{background:${glow};display:grid;grid-template-columns:360px 1fr;gap:64px;align-items:center;padding:0 72px 0 84px} ${kBase}
  .mark img{height:400px} h1{font-size:64px}
  .name{position:absolute;right:72px;bottom:48px;font-weight:700;font-size:28px;color:var(--ink-2)}`,
  `<div class="mark"><img src="${logo}" alt=""></div><div><div class="eyebrow">Наша миссия</div><h1>${MISSION}</h1></div><div class="name">Эмилиус Эдженси</div>`));

// k2 — короче и крупнее: миссия разбита на обещание и подпись
shoot('k2-krupno', page('dark', `body{background:${glow};display:grid;grid-template-columns:360px 1fr;gap:64px;align-items:center;padding:0 72px 0 84px} ${kBase}
  .mark img{height:400px} h1{font-size:80px;line-height:1}
  .sub{margin-top:28px;font-size:30px;color:var(--ink-2);line-height:1.25}
  .name{margin-top:44px;font-weight:700;font-size:28px;color:var(--ink-2)}`,
  `<div class="mark"><img src="${logo}" alt=""></div><div><div class="eyebrow">Наша миссия</div><h1>Великолепные продукты</h1><div class="sub">для великолепных людей — помогаем<br>их создавать</div><div class="name">Эмилиус Эдженси</div></div>`));

// k3 — знак уходит за левый край крупно (как колесо за краем), текст по центру оставшегося места
shoot('k3-znak-za-kraem', page('dark', `body{background:radial-gradient(600px 500px at 120px 50%,color-mix(in srgb,var(--ray-2) 40%,transparent),transparent 70%),radial-gradient(520px 420px at 200px 75%,color-mix(in srgb,var(--ray-4) 35%,transparent),transparent 70%),var(--page);padding:0 72px 0 520px;display:flex;flex-direction:column;justify-content:center} ${kBase}
  .mark{position:absolute;left:-90px;top:-60px} .mark img{height:750px} h1{font-size:60px}
  .name{position:absolute;left:520px;top:52px;font-weight:700;font-size:28px;color:var(--ink-2)}`,
  `<div class="mark"><img src="${logo}" alt=""></div><div class="name">Эмилиус Эдженси</div><div class="eyebrow">Наша миссия</div><h1>${MISSION}</h1>`));

// k4 — по центру: знак сверху, миссия под ним по центру, название в подписи
shoot('k4-centr', page('dark', `body{background:radial-gradient(500px 300px at 50% 30%,color-mix(in srgb,var(--ray-2) 40%,transparent),transparent 70%),var(--page);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 120px} ${kBase}
  .mark img{height:190px} .eyebrow{margin-top:34px} h1{font-size:54px;margin-top:14px}
  .name{position:absolute;left:0;right:0;bottom:40px;font-weight:700;font-size:28px;color:var(--ink-2)}`,
  `<div class="mark"><img src="${logo}" alt=""></div><div class="eyebrow">Наша миссия</div><h1>${MISSION}</h1><div class="name">Эмилиус Эдженси</div>`));
console.log('k1-k4');
