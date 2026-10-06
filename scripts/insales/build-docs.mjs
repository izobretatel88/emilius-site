// Пересобирает таблицы из норм: node scripts/insales/build-docs.mjs
// → docs/insales-shop/03-raboty.md, works.csv, packages.md, calc-data.json
import { writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { WORKS, BLOCKS, RATES, PACKAGES, DRIVERS, STAGE0 } from './works.mjs';
import * as est from './estimate.mjs';
const { packagePrice, estimate, COEF } = est;

const out = new URL('../../docs/insales-shop/', import.meta.url);
const fmt = (n) => n.toLocaleString('ru-RU').replace(/ /g, ' ');
const norm = (w) => {
  if (!w.per && !w.pct) return `${w.h}`;
  if (w.pct) return `${w.pct * 100}% от сборки`;
  const [d, size, h] = w.per;
  const step = size === 1 ? `${h} за 1 (${DRIVERS[d]})` : `+${h} за каждые ${size} (${DRIVERS[d]})`;
  return w.scale || !w.h ? step : `${w.h} ${step}`;
};
const CODE = { express: 'Э', start: 'С', business: 'Б', multi: 'С+' };
const inPkgs = (id) => Object.entries(PACKAGES).filter(([, p]) => p.works.includes(id)).map(([k]) => CODE[k]).join(' ') || 'опция';

// 1. Таблица работ
let md = `# Перечень типовых работ и нормативы времени

> Файл собирается из \`scripts/insales/works.mjs\` командой \`node scripts/insales/build-docs.mjs\`. Править нормы — там, не здесь.

Норма — чистое время исполнителя по таймеру, часы. Ставки: ${Object.entries(RATES).map(([k, r]) => `**${k}** ${r.name} — ${fmt(r.rate)} ₽/ч`).join('; ')}.
Колонка «Пакеты»: Э — Экспресс, С — Старт, Б — Бизнес, С+ — Селлер+. Сложность: 1 — по чек-листу, 2 — нужен опыт, 3 — нужна оценка по ТЗ.

`;
for (const [key, title] of Object.entries(BLOCKS)) {
  const ws = WORKS.filter((w) => w.block === key);
  md += `## ${title}\n\n| ID | Работа | Роль | Норма, ч | Ур. | Когда нужна | Вход | Результат | Зависит от | Риск | Варианты | Пакеты |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const w of ws) {
    md += `| ${w.id} | ${w.name} | ${w.role} | ${norm(w)} | ${w.lvl} | ${w.when} | ${w.input} | ${w.result} | ${w.deps.join(', ') || '—'} | ${w.risk} | ${w.vars} | ${inPkgs(w.id)} |\n`;
  }
  md += '\n';
}
writeFileSync(new URL('03-raboty.md', out), md);

// 2. CSV для таблиц
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const head = ['id', 'блок', 'работа', 'роль', 'ставка', 'часы_база', 'драйвер', 'шаг', 'часы_за_шаг', 'процент', 'сложность', 'зависимости', 'когда', 'вход', 'результат', 'риск', 'варианты', 'пакеты'];
const rows = WORKS.map((w) => [w.id, BLOCKS[w.block], w.name, w.role, RATES[w.role].rate, w.scale ? 0 : w.h, w.per?.[0] ?? '', w.per?.[1] ?? '', w.per?.[2] ?? '', w.pct ?? '', w.lvl, w.deps.join(' '), w.when, w.input, w.result, w.risk, w.vars, inPkgs(w.id)]);
writeFileSync(new URL('works.csv', out), '﻿' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\n') + '\n');

// 3. Пакеты и примеры смет
let pk = `# Пакеты и примеры смет

> Собирается \`node scripts/insales/build-docs.mjs\` из норм. Цены пакетов — сумма норм × ставки − 10% пакетной скидки, округление вверх до 1000 ₽.

| Пакет | Для кого | Часы | Цена | Срок |\n|---|---|---|---|---|\n`;
const prices = {};
for (const [key, p] of Object.entries(PACKAGES)) {
  const e = packagePrice(key);
  prices[key] = e.price;
  pk += `| **${p.name}** | ${p.for} | ${e.hours} | **${fmt(e.price)} ₽** | ${e.weeks - 1}–${e.weeks} нед. |\n`;
}
pk += `| ${STAGE0.name} | отдельно или как вход в любой пакет; засчитывается при старте в течение 30 дней | ~8 | **${fmt(STAGE0.price)} ₽** | 3–5 раб. дней |\n\n`;
pk += `Коэффициенты к часам (анкета, раздел «Риски»): ${Object.entries(COEF).map(([k, v]) => `${k}: ${Object.entries(v).map(([a, b]) => `${a} ×${b}`).join(', ')}`).join('; ')}.\n\n`;
for (const [key, p] of Object.entries(PACKAGES)) {
  pk += `## ${p.name}\n\nСостав: ${p.works.map((id) => `${id} ${WORKS.find((w) => w.id === id).name}`).join('; ')}.\n\n`;
}
pk += `## Примеры смет по брифу\n\n`;
const exDir = new URL('./examples/', import.meta.url);
for (const f of readdirSync(exDir).filter((f) => f.endsWith('.json'))) {
  const b = JSON.parse(readFileSync(new URL(f, exDir), 'utf8'));
  const e = estimate(b);
  pk += `### ${b.title}\n\n\`node scripts/insales/estimate.mjs scripts/insales/examples/${f}\` → **${fmt(e.total)} ₽**, ${e.hours} ч (${Object.entries(e.byRole).map(([r, h]) => `${r} ${h}`).join(', ')}), ~${e.weeks} нед. Коэффициенты: общий ×${e.kAll}, каталог ×${e.kCat}.\n\n`;
}
writeFileSync(new URL('packages.md', out), pk);

// 4. Данные для HTML-калькулятора
writeFileSync(new URL('calc-data.json', out), JSON.stringify({ RATES, BLOCKS, WORKS, PACKAGES, COEF, STAGE0, prices }, null, 0));
console.log('ok', prices);

// 5. HTML-калькулятор: та же логика, что в estimate.mjs (функции переносятся исходником)
const tpl = readFileSync(new URL('./calc.template.html', import.meta.url), 'utf8');
const data = `const WORKS = ${JSON.stringify(WORKS)};\nconst RATES = ${JSON.stringify(RATES)};\nconst BLOCKS = ${JSON.stringify(BLOCKS)};\n` +
  `const PACKAGES = ${JSON.stringify(PACKAGES)};\nconst COEF = ${JSON.stringify(COEF)};\nconst PRICES = ${JSON.stringify(prices)};\n` +
  `const VOLUME_DISCOUNT = ${JSON.stringify(est.VOLUME_DISCOUNT)};\nconst byId = Object.fromEntries(WORKS.map((w) => [w.id, w]));\n` +
  `const round2 = ${est.round2.toString()};\n${est.hoursOf.toString()}\n${est.selectWorks.toString()}\n${est.estimate.toString()}\n`;
writeFileSync(new URL('calc.html', out), tpl.replace('/*__DATA__*/', () => data));
