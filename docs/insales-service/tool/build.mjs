// Собирает из works.mjs + rules.mjs:
//   ../data/works.csv        — каталог работ для Google Таблиц
//   ../05-price-list.md      — прайс пакетов и допработ
//   ../calculator.html       — калькулятор по брифу (один файл, без зависимостей)
// Запуск: node build.mjs (после любой правки нормативов или ставок).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { WORKS, MODULES } from './works.mjs';
import { PACKAGES, RATES, unitPrice, STAGE0_PRICE } from './rules.mjs';

const here = new URL('.', import.meta.url);
const out = (p) => new URL('../' + p, here);
mkdirSync(out('data'), { recursive: true });

// CSV
const cols = ['code', 'module', 'stage', 'task', 'sub', 'desc', 'when', 'input', 'result', 'hMin', 'hNorm', 'hMax', 'unit', 'cx', 'role', 'deps', 'risks', 'variants'];
const head = ['Код', 'Модуль', 'Этап', 'Задача', 'Подзадача', 'Описание', 'Когда нужна', 'Входные данные', 'Результат', 'Часы мин', 'Часы норматив', 'Часы макс', 'Единица', 'Сложность', 'Роль', 'Зависит от', 'Риски', 'Варианты', 'Цена за единицу, ₽'];
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = [head.map(esc).join(',')]
  .concat(WORKS.map((x) => cols.map((c) => (c === 'module' ? MODULES[x.module] : x[c])).concat(unitPrice(x)).map(esc).join(',')))
  .join('\n');
writeFileSync(out('data/works.csv'), '﻿' + csv);

// Прайс
const rub = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
const md = ['# Прайс: пакеты и допработы', '',
  '> Файл собирается `node tool/build.mjs` из нормативов `tool/works.mjs` и ставок `tool/rules.mjs`. Руками не править.', '',
  '## Пакеты', '', '| Пакет | Цена | Срок | Товаров до | Категорий до | Синхронизаций |', '|---|---|---|---|---|---|',
  ...PACKAGES.map((p) => `| ${p.name} | ${rub(p.price)} | ${p.days} | ${p.limits.sku} | ${p.limits.categories} | ${p.limits.integrations} |`),
  '', `Этап 0 «Диагностика и план запуска» отдельно — ${rub(STAGE0_PRICE)}, засчитывается в пакет при старте в течение 30 дней. В пакет «Магазин + синхронизация» входит.`, '',
  `Ставки: ${Object.entries(RATES).map(([k, v]) => `${k} ${rub(v)}/ч`).join(' · ')}. Цена допработы = норматив × ставка × 1,12 (управление) × 1,1 (резерв), округление до 500 ₽.`, ''];
for (const [m, title] of Object.entries(MODULES)) {
  const rows = WORKS.filter((x) => x.module === m);
  md.push(`## ${title}`, '', '| Код | Работа | Единица | Часы | Цена |', '|---|---|---|---|---|');
  rows.forEach((x) => md.push(`| ${x.code} | ${x.sub} | ${x.unit} | ${x.hNorm} | ${rub(unitPrice(x))} |`));
  md.push('');
}
writeFileSync(out('05-price-list.md'), md.join('\n'));

// Калькулятор: исходники модулей встраиваются в страницу как есть, без import/export.
const strip = (f) => readFileSync(new URL(f, here), 'utf8').replace(/^import .*$/gm, '').replace(/^export /gm, '');
const tpl = readFileSync(new URL('calculator.template.html', here), 'utf8');
writeFileSync(out('calculator.html'), tpl.replace('/*__ENGINE__*/', () => strip('works.mjs') + '\n' + strip('rules.mjs')));
console.log('works.csv, 05-price-list.md, calculator.html — собраны;', WORKS.length, 'работ');
