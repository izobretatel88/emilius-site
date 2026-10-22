// Справочник услуги InSales: все документы docs/insales-service одним сайтом (меню, поиск, оглавления,
// конструктор работ карточками, шаги владельца на главной) + калькулятор и итог соседними страницами.
// npm run insales:handbook  →  handbook-out/index.html, calculator.html, summary.html
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { marked } from 'marked';

const SRC = path.resolve(process.argv[2] || 'docs/insales-service');
const OUT = path.resolve(process.argv[3] || 'handbook-out');
fs.mkdirSync(OUT, { recursive: true });

// Цены, ставки и названия пакетов — из калькулятора, чтобы справочник не расходился со сметой
const { PACKAGES, RATES } = await import(pathToFileURL(path.join(SRC, 'calc/estimate.js')).href);
const ROLES = { NC: 'сборщик InSales', CNT: 'контент-менеджер', DSN: 'дизайнер', SEO: 'SEO-специалист', INT: 'интегратор', DEV: 'разработчик Liquid', QA: 'тестирование' };
const rub = (n) => n.toLocaleString('ru-RU').replace(/ /g, ' ');

// Иконки групп — простые линии в духе SF Symbols, белым по бирюзовому квадрату
const ICONS = {
  start: '<path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/>',
  product: '<path d="M3.5 7.5 12 3.5l8.5 4-8.5 4-8.5-4Z"/><path d="M3.5 7.5v9l8.5 4 8.5-4v-9M12 11.5v9"/>',
  sales: '<path d="M4 5.5h16v10.5H10l-6 4.5V5.5Z"/>',
  production: '<path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="m4 6.5 1.3 1.3L7.8 5.2M4 12l1.3 1.3 2.5-2.6M4 17.5l1.3 1.3 2.5-2.6"/>',
  after: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v5h-5"/>',
};
const icon = (k) => `<span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg></span>`;

const GROUPS = [
  ['Начать здесь', 'start', [
    ['start', '14-start.md', 'Старт продаж: 10 дней'],
    ['map', 'README.md', 'Карта системы'],
  ]],
  ['Продукт', 'product', [
    ['research', '01-research.md', 'Рынок и аудитория'],
    ['product', '02-product.md', 'Пакеты и опции'],
    ['catalog', '03-catalog.csv', 'Конструктор: работы и часы'],
    ['estimation', '04-estimation.md', 'Оценка и бриф'],
    ['card', '06-service-card.md', 'Карточка услуги'],
    ['economics', '13-economics.md', 'Экономика'],
  ]],
  ['Продажи', 'sales', [
    ['landing', '07-landing.md', 'Лендинг'],
    ['leadgen', '08-lead-gen.md', 'Каналы и поиск клиентов'],
    ['outreach', '09-outreach.md', 'Первые сообщения'],
    ['sales', '10-sales.md', 'Диалог и возражения'],
    ['hot', 'templates/hot-replies.md', 'Ответы на горячие запросы'],
    ['partner', 'templates/partner-card.md', 'Карточка партнёра InSales'],
  ]],
  ['Производство', 'production', [
    ['process', '05-process.md', 'Порядок работ'],
    ['diag', 'templates/diagnostic-report.md', 'Заключение диагностики'],
    ['kp', 'templates/kp-example-seller.md', 'Пример КП'],
    ['order', 'templates/order-example-seller.md', 'Пример Заказа к договору'],
    ['qa', 'templates/qa-protocol.md', 'Тесты и запуск'],
    ['themes', 'templates/theme-shortlist.md', 'Шортлист тем'],
    ['video', 'templates/video-library.md', 'Видеоинструкции'],
    ['onboarding', 'templates/onboarding.md', 'Ввод нового человека'],
  ]],
  ['После запуска и улучшение', 'after', [
    ['retention', '12-retention.md', 'Удержание и абонемент'],
    ['improvement', '11-improvement.md', 'Итерации и бэклог'],
    ['lessons', 'data/lessons.md', 'Уроки из переписок'],
  ]],
];

const byFile = new Map();
const groupOf = new Map();
for (const [g, , items] of GROUPS) for (const [id, file] of items) { byFile.set(file, id); groupOf.set(id, g); }

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => linkCodeNames(marked.parseInline(String(s)), '');

// Ссылки между документами → переходы внутри справочника
function relink(html, fromFile) {
  return html.replace(/href="([^"#]+?)(#[^"]*)?"/g, (m, href) => {
    if (/^https?:|^mailto:/.test(href)) return m;
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), href)).replace(/^\.\//, '');
    if (byFile.has(resolved)) return `href="#${byFile.get(resolved)}"`;
    if (/calculator\.html$/.test(resolved)) return 'href="calculator.html"';
    if (/summary\.html$/.test(resolved)) return 'href="summary.html"';
    return 'href="https://github.com/izobretatel88/emilius-site/blob/main/docs/insales-service/' + resolved + '"';
  });
}

// Названия файлов в тексте (`05-process.md`) → ссылки
function linkCodeNames(html) {
  return html.replace(/<code>([^<]+?)<\/code>/g, (m, name) => {
    const clean = name.replace(/^docs\/insales-service\//, '').replace(/\s*§.*$/, '');
    if (byFile.has(clean)) return `<a class="doclink" href="#${byFile.get(clean)}"><code>${name}</code></a>`;
    if (clean === 'calculator.html') return `<a class="doclink" href="calculator.html"><code>${name}</code></a>`;
    return m;
  });
}

// Журнал запусков агента — в свёрнутый блок в конце документа
function splitRunLog(md) {
  const keep = [], log = [];
  for (const block of md.split(/\n{2,}/)) {
    if (/^(## )?Запуск \d+/.test(block.trim())) log.push(block.trim().replace(/^## /, ''));
    else keep.push(block);
  }
  return { md: keep.join('\n\n'), log };
}

// Разделы второго уровня получают якоря вида start-2 — на них ведёт оглавление
function addAnchors(html, id) {
  const toc = [];
  html = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (m, inner) => {
    const anchor = `${id}-${toc.length + 1}`;
    toc.push([anchor, inner.replace(/<[^>]+>/g, '')]);
    return `<h2 id="${anchor}">${inner}</h2>`;
  });
  return { html, toc };
}

// Строки markdown-таблицы из раздела «## N.» документа
function tableRows(md, sectionNo) {
  const sec = md.split(/\n(?=## )/).find((s) => s.startsWith(`## ${sectionNo}.`)) || '';
  return sec.split('\n').filter((l) => /^\|\s*\d+\s*\|/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

function renderCatalog(file) {
  const rows = fs.readFileSync(path.join(SRC, file), 'utf8').trim().split('\n').map((l) => l.split(';'));
  const head = rows.shift();
  const works = rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] || ''])));
  const modules = [...new Set(works.map((w) => w['модуль']))];
  const pk = (codes) => codes.split(',').filter(Boolean).map((c) => `<span class="pk pk-${esc(c)}" title="${esc(PACKAGES[c]?.name || c)}">${esc(PACKAGES[c]?.name || c)}</span>`).join('');
  const hours = (w) => {
    const per = parseFloat(w['часы_за_ед']) || 0;
    return esc(w['часы_база']) + ' ч' + (per ? ` + ${esc(w['часы_за_ед'])} ч / ${esc(w['единица'])}` : '');
  };
  const field = (label, v) => v && v !== '—' ? `<div class="wf"><dt>${label}</dt><dd>${inline(v)}</dd></div>` : '';
  const pkgLine = Object.entries(PACKAGES).map(([, p]) => `<b>${esc(p.name)}</b> от ${rub(p.min)} ₽`).join(' · ');
  const rateLine = Object.entries(RATES).map(([k, v]) => `${esc(ROLES[k] || k)} ${rub(v)}`).join(' · ');

  let h = `<h1>Конструктор услуги: ${works.length} работ</h1>
<p class="lead">Проект собирается из нужных работ, у каждой норма часов. Смету по ответам клиента считает <a href="calculator.html">калькулятор</a>.</p>
<p class="small">Пакеты: ${pkgLine}. Ставки, ₽/ч: ${rateLine}.</p>
<div class="cfilter">
  <div class="searchbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input class="search" id="cq" type="search" placeholder="Найти работу: 1С, остатки, домен" aria-label="Найти работу"></div>
  <div class="segmented" role="group" aria-label="Пакет"><button class="on" aria-pressed="true" data-pkg="">Все</button>${Object.entries(PACKAGES).map(([k, p]) => `<button aria-pressed="false" data-pkg="${k}">${esc(p.name)}</button>`).join('')}<button aria-pressed="false" data-pkg="-">Опции</button></div>
  <div class="small" id="ccount" aria-live="polite"></div>
</div>`;
  for (const m of modules) {
    const list = works.filter((w) => w['модуль'] === m);
    h += `<section class="module" data-module="${esc(m)}"><h2 id="catalog-${modules.indexOf(m) + 1}">${esc(m)} <span class="count">${list.length}</span></h2><div class="works">`;
    for (const w of list) {
      const text = [w.id, w['задача'], w['что делаем'], w['когда нужна'], w['риски'], w['варианты'], w['модуль']].join(' ').toLowerCase();
      h += `<details class="work" data-pkgs="${esc(w['пакеты'])}" data-text="${esc(text)}">
<summary><code class="wid">${esc(w.id)}</code><span class="wt">${esc(w['задача'])}</span><span class="wh">${hours(w)}</span><span class="wp">${pk(w['пакеты']) || '<span class="pk pk-opt">опция</span>'}</span></summary>
<dl>${field('Что делаем', w['что делаем'])}${field('Когда нужна', w['когда нужна'])}${field('Вход от клиента', w['вход от клиента'])}${field('Результат', w['результат'])}${field('Кто делает', `${ROLES[w['роль']] || w['роль']} · сложность ${w['сложность']} из 3`)}${field('Зависит от', w['зависит_от'])}${field('Риски', w['риски'])}${field('Варианты', w['варианты'])}</dl></details>`;
    }
    h += '</div></section>';
  }
  return { html: h, toc: modules.map((m, i) => [`catalog-${i + 1}`, m]), count: works.length };
}

const docs = [];
let workCount = 0;
for (const [, , items] of GROUPS) {
  for (const [id, file, title] of items) {
    let html, toc = [];
    if (file.endsWith('.csv')) {
      ({ html, toc, count: workCount } = renderCatalog(file));
    } else {
      const raw = fs.readFileSync(path.join(SRC, file), 'utf8');
      const { md, log } = splitRunLog(raw);
      ({ html, toc } = addAnchors(linkCodeNames(relink(marked.parse(md), file)), id));
      if (log.length) {
        html += `<details class="runlog"><summary>Журнал запусков агента по расписанию: ${log.length} записей</summary>${marked.parse(log.join('\n\n'))}</details>`;
      }
    }
    html = html.replace(/<table>/g, '<div class="tablewrap"><table>').replace(/<\/table>(?!<\/div>)/g, '</table></div>');
    const text = html.replace(/<details class="runlog">[\s\S]*$/, '').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
    docs.push({ id, file, title, html, text, toc });
  }
}

// Оглавление вверху длинного документа, переход к следующему внизу
const order = docs.map((d) => d.id);
const sections = docs.map((d, i) => {
  const toc = d.toc.length >= 3 && d.id !== 'catalog' ? `<details class="toc" open><summary>На этой странице · ${d.toc.length}</summary><ol>${d.toc.map(([a, t]) => `<li><a href="#${a}">${esc(t.replace(/^\d+[а-я]?\.\s*/, ''))}</a></li>`).join('')}</ol></details>` : '';
  const prev = docs[i - 1], next = docs[i + 1];
  const pager = `<nav class="pager" aria-label="Соседние документы">${prev ? `<a href="#${prev.id}"><span>Назад</span>${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="next" href="#${next.id}"><span>Дальше</span>${esc(next.title)}</a>` : ''}</nav>`;
  const h1end = d.html.indexOf('</h1>');
  const body = h1end > -1 ? d.html.slice(0, h1end + 5) + toc + d.html.slice(h1end + 5) : toc + d.html;
  return `<article class="doc" id="doc-${d.id}" hidden><div class="eyebrow">${esc(groupOf.get(d.id))}</div>${body}${pager}<p class="docmeta">Файл: ${esc(d.file)}</p></article>`;
}).join('\n');

// Главная: шаги владельца (§2) и вопросы агенту (§3) из 14-start.md
const startMd = fs.readFileSync(path.join(SRC, '14-start.md'), 'utf8');
const steps = tableRows(startMd, 2).map(([n, step, time, gain]) =>
  `<li><div class="st"><b>${inline(step)}</b><span class="time">${esc(time)}</span></div><span class="gain">${inline(gain)}</span></li>`).join('');
const questions = tableRows(startMd, 3);
const open = questions.filter((q) => !q[2]);
const qs = questions.map(([n, q, a, , change]) =>
  `<li class="${a ? 'done' : ''}"><span class="qs">${a ? 'ответ есть' : 'ждёт ответа'}</span><div><b>${inline(q)}</b><span class="gain">${a ? 'Ответ: ' + inline(a) : 'Изменится: ' + inline(change)}</span></div></li>`).join('');

const nav = GROUPS.map(([g, , items]) => `<div class="navgroup"><div class="navtitle">${esc(g)}</div>${items.map(([id, , t]) => `<a href="#${id}" data-id="${id}">${esc(t)}</a>`).join('')}</div>`).join('');
const index = JSON.stringify(docs.map((d) => ({ id: d.id, title: d.title, text: d.text }))).replace(/</g, '\\u003c');
const built = new Date().toISOString().slice(0, 10).split('-').reverse().join('.');
const pkgCards = Object.values(PACKAGES).map((p) => `<div class="pkg"><b>${esc(p.name)}</b><span class="price">от ${rub(p.min)} ₽</span><span class="note">${esc(p.note)}</span></div>`).join('');
const homeGroups = GROUPS.map(([g, key, items]) => `<div class="hg"><h3>${esc(g)}</h3><div class="group">${items.map(([id, , t]) => `<a class="row" href="#${id}">${icon(key)}<span class="rt">${esc(t)}</span><span class="chev" aria-hidden="true"></span></a>`).join('')}</div></div>`).join('');

const tpl = fs.readFileSync(new URL('./page.template.html', import.meta.url), 'utf8');
const page = tpl
  .replace('%NAV%', nav).replace('%DOCS%', sections).replace('%INDEX%', index)
  .replace('%STEPS%', steps).replace('%QUESTIONS%', qs).replace('%QOPEN%', String(open.length)).replace('%QALL%', String(questions.length))
  .replace('%PKGS%', pkgCards).replace('%HOMEGROUPS%', homeGroups).replaceAll('%WORKS%', String(workCount))
  .replaceAll('%BUILT%', built).replace('%COUNT%', String(docs.length));
fs.writeFileSync(path.join(OUT, 'index.html'), page);

// Калькулятор и итог — соседние страницы; ссылки на .md ведут обратно в справочник
for (const f of ['calculator.html', 'summary.html']) {
  let s = fs.readFileSync(path.join(SRC, f), 'utf8');
  s = s.replace(/href="([^"#:]+?\.(md|csv))"/g, (m, href) => byFile.has(href) ? `href="index.html#${byFile.get(href)}"` : m);
  if (!/^\s*<!doctype/i.test(s)) s = '<!doctype html>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + s;
  fs.writeFileSync(path.join(OUT, f), s);
}
console.log(`${docs.length} документов, ${workCount} работ, вопросов без ответа ${open.length} из ${questions.length} → ${path.relative(process.cwd(), OUT)}/index.html (${(fs.statSync(path.join(OUT, 'index.html')).size / 1024).toFixed(0)} КБ)`);
