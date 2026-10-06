// Проверка согласованности материалов услуги InSales. Запускать после любой правки цен, норм или текстов.
//   node scripts/insales-lint.mjs
// Ловит то, что уже расходилось руками: id работ, которых нет в каталоге; цены «от» пакетов, не совпадающие
// с калькулятором; тарифы InSales, отличные от platformCosts; устаревший calculator.html.
import { readFileSync, readdirSync } from 'node:fs';
import { PACKAGES, parseCatalog, platformCosts, DEFAULT_BRIEF } from '../docs/insales-service/calc/estimate.js';

const dir = new URL('../docs/insales-service/', import.meta.url);
const root = new URL('../', import.meta.url);
const csv = readFileSync(new URL('03-catalog.csv', dir), 'utf8');
const catalog = parseCatalog(csv);
const problems = [];

const docs = [
  ...readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => ['docs/insales-service/' + f, new URL(f, dir)]),
  ...readdirSync(new URL('templates/', dir)).filter((f) => f.endsWith('.md')).map((f) => ['docs/insales-service/templates/' + f, new URL('templates/' + f, dir)]),
  ['src/data/insales.ts', new URL('src/data/insales.ts', root)],
];

// 1. id работ в тексте существуют в каталоге (маски вида INT-1C-* и SEO-02… пропускаем).
const ids = new Set(catalog.keys());
for (const [name, url] of docs) {
  const text = readFileSync(url, 'utf8');
  for (const m of text.matchAll(/\b([A-Z]{2,4}(?:-[A-Z0-9]{1,3})?-\d{2})\b(?![*…])/g)) {
    if (!ids.has(m[1]) && !/^(HA|EN|MT|WZ)-/.test(m[1])) problems.push(`${name}: работы ${m[1]} нет в 03-catalog.csv`);
  }
}

// 2. Цены «от» пакетов: «Магазин от 105 000 ₽» и т. п. рядом с названием пакета.
const nameToMin = Object.fromEntries(Object.values(PACKAGES).map((p) => [p.name, p.min]));
for (const [name, url] of docs) {
  if (name.endsWith('01-research.md') || name.endsWith('11-improvement.md') || name.endsWith('04-estimation.md')) continue; // история и рынок
  const text = readFileSync(url, 'utf8');
  for (const [pkg, min] of Object.entries(nameToMin)) {
    const re = new RegExp(`${pkg}[^\\n]{0,40}?от\\s*(\\d{2,3})(?:[\\s\\u00a0]000|\\s*тыс)`, 'g');
    for (const m of text.matchAll(re)) {
      if (Object.keys(nameToMin).some((o) => o !== pkg && m[0].includes(o))) continue; // «Магазин в пакете «Старт» от 75»
      if (Number(m[1]) * 1000 !== min) problems.push(`${name}: «${pkg}» от ${m[1]} тыс., в калькуляторе ${min / 1000} тыс.`);
    }
  }
}

// 3. Тарифы InSales в текстах совпадают с platformCosts.
const shop = platformCosts({ ...DEFAULT_BRIEF, segment: 'offline', source: 'excel', marketplaces: 0 }).tariff.month;
const combo = platformCosts({ ...DEFAULT_BRIEF, marketplaces: 1 }).tariff.month;
for (const [name, url] of docs) {
  if (name.endsWith('01-research.md') || name.endsWith('11-improvement.md')) continue;
  const text = readFileSync(url, 'utf8');
  for (const m of text.matchAll(/«Интернет-магазин»\)?\s*(\d)\s?(\d{3})\s*₽/g))
    if (Number(m[1] + m[2]) !== shop) problems.push(`${name}: «Интернет-магазин» ${m[1]} ${m[2]} ₽, в калькуляторе ${shop}`);
  for (const m of text.matchAll(/«Комбо»\)?\s*(\d)\s?(\d{3})\s*₽/g))
    if (Number(m[1] + m[2]) !== combo) problems.push(`${name}: «Комбо» ${m[1]} ${m[2]} ₽, в калькуляторе ${combo}`);
}

// 4. calculator.html собран из текущих CSV и estimate.js.
const html = readFileSync(new URL('calculator.html', dir), 'utf8');
if (!html.includes(JSON.stringify(csv))) problems.push('calculator.html устарел: node scripts/insales-calc.mjs --html');
const core = readFileSync(new URL('calc/estimate.js', dir), 'utf8').replace(/^export /gm, '');
if (!html.includes(core)) problems.push('calculator.html устарел (estimate.js): node scripts/insales-calc.mjs --html');

if (problems.length) {
  console.log(problems.map((p) => '✗ ' + p).join('\n'));
  process.exit(1);
}
console.log(`✓ согласовано: ${ids.size} работ, цены пакетов ${Object.values(nameToMin).map((v) => v / 1000).join(' / ')} тыс. ₽, тарифы ${shop} / ${combo} ₽`);
