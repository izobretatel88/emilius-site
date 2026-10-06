#!/usr/bin/env node
// Проверка таблицы товаров клиента перед импортом в InSales (работы IMP-01, IMP-02).
//
//   node scripts/insales-import-check.mjs товары.csv            # отчёт в консоль
//   node scripts/insales-import-check.mjs товары.csv --md отчёт.md --brief brief.json
//   node scripts/insales-calc.mjs brief.json                    # смета с полями из файла
//
// Вход — CSV (разделитель ; , или таб, определяется сам). XLSX сохранить как CSV UTF-8.
// Колонки ищутся по синонимам (выгрузки 1С, МоегоСклада, WB, Ozon, Excel клиента).
// Итог: список проблем, «грязные» строки и часы на чистку для калькулятора (IMP-02, ч/100 товаров).

import { readFileSync, writeFileSync } from 'node:fs';

const COLS = {
  name: ['название товара или услуги', 'название', 'наименование', 'товар', 'name', 'title'],
  sku: ['артикул', 'артикул продавца', 'код', 'sku', 'vendor code', 'offer_id'],
  price: ['цена продажи', 'цена', 'розничная цена', 'цена до скидки', 'price'],
  oldPrice: ['старая цена', 'цена без скидки', 'old price'],
  stock: ['остаток', 'остатки', 'количество', 'stock', 'qty'],
  category: ['категория', 'подкатегория', 'раздел', 'группа', 'размещение на сайте', 'category', 'предмет'],
  images: ['изображения', 'фото', 'изображение', 'картинки', 'ссылки на фото', 'images', 'photo'],
  description: ['описание', 'полное описание', 'description'],
  barcode: ['штрих-код', 'штрихкод', 'баркод', 'barcode', 'ean'],
  weight: ['вес', 'вес, кг', 'вес, г', 'weight'],
  variantOf: ['группа вариантов', 'родительский артикул', 'модель', 'артикул модели', 'nmid', 'артикул wb'],
};
// Колонки-характеристики: «Параметр: Цвет», «Свойство: Размер», «Цвет», «Размер», «Материал»…
const PROP_HINT = /^(параметр|свойство|характеристика)\s*:|^(цвет|размер|материал|состав|бренд|страна|объ[её]м|сезон|пол)$/i;

const args = process.argv.slice(2);
const file = args.find((a, i) => !a.startsWith('--') && !['--md', '--brief'].includes(args[i - 1]));
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const mdOut = opt('--md');
const briefOut = opt('--brief');
if (!file) {
  console.error('Укажите CSV: node scripts/insales-import-check.mjs товары.csv [--md отчёт.md]');
  process.exit(1);
}

const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
const rows = parseCsv(text);
const header = rows.shift().map((h) => h.trim());
const data = rows.filter((r) => r.some((c) => c.trim() !== ''));

const idx = {};
for (const [key, names] of Object.entries(COLS)) {
  idx[key] = header.findIndex((h) => names.includes(h.toLowerCase().replace(/\s+/g, ' ')));
}
const propCols = header
  .map((h, i) => ({ h, i }))
  .filter(({ h, i }) => PROP_HINT.test(h.trim()) && !Object.values(idx).includes(i));

const issues = []; // { level: 'блокер' | 'чистка' | 'совет', code, text, rows: [] }
const dirty = new Set();
// Без списка строк — замечание ко всему файлу; со списком — только если строки нашлись.
const add = (level, code, text, list) => {
  if (list && !list.length) return;
  list ||= [];
  issues.push({ level, code, text, rows: list });
  if (level !== 'совет') list.forEach((n) => dirty.add(n));
};
const cell = (r, key) => (idx[key] >= 0 ? (r[idx[key]] ?? '').trim() : '');
const lineNo = (i) => i + 2; // строка 1 — заголовок

// 1. Обязательные колонки
for (const key of ['name', 'price']) {
  if (idx[key] < 0) add('блокер', `нет-${key}`, `Нет колонки «${COLS[key][0]}». Без неё импорт не пройдёт.`);
}
if (idx.sku < 0) add('чистка', 'нет-артикула', 'Нет колонки артикула. Без артикула не связать фото, остатки и обновления из учёта.');
if (idx.category < 0) add('чистка', 'нет-категории', 'Нет колонки категории. Раскладку по каталогу придётся делать вручную (CAT-03).');
if (idx.images < 0) add('совет', 'нет-фото', 'Нет колонки с фото. Нужен архив с именами по артикулу (IMP-05).');

// 2. Построчные проверки
const by = (fn) => data.map((r, i) => (fn(r) ? lineNo(i) : null)).filter(Boolean);
if (idx.name >= 0) {
  add('чистка', 'пустое-название', 'Пустое название', by((r) => !cell(r, 'name')));
  add('совет', 'длинное-название', 'Название длиннее 120 символов — режется в карточке и выдаче', by((r) => cell(r, 'name').length > 120));
  add('совет', 'капс', 'Название целиком заглавными (типично для 1С)', by((r) => /[А-ЯЁ]{4}/.test(cell(r, 'name')) && cell(r, 'name') === cell(r, 'name').toUpperCase()));
}
if (idx.price >= 0) {
  add('чистка', 'цена', 'Цена пустая, нулевая или не число', by((r) => !(num(cell(r, 'price')) > 0)));
  if (idx.oldPrice >= 0) add('чистка', 'старая-цена', 'Старая цена не больше текущей — скидка не покажется', by((r) => cell(r, 'oldPrice') && num(cell(r, 'oldPrice')) <= num(cell(r, 'price'))));
}
if (idx.stock >= 0) add('совет', 'остаток', 'Остаток пустой или отрицательный', by((r) => !(num(cell(r, 'stock')) >= 0)));
if (idx.images >= 0) {
  add('чистка', 'без-фото', 'Товар без фото', by((r) => !cell(r, 'images')));
  add('чистка', 'фото-не-ссылка', 'В колонке фото не ссылка http(s) — нужен архив или пересборка ссылок', by((r) => cell(r, 'images') && !/^https?:\/\//i.test(cell(r, 'images'))));
  add('совет', 'фото-маркетплейса', 'Фото по ссылкам WB/Ozon: ссылки могут перестать открываться — скачать и загрузить к себе', by((r) => /wbbasket|wbstatic|wildberries|ozone\.ru|ozon\.ru/i.test(cell(r, 'images'))));
}
if (idx.description >= 0) {
  add('совет', 'без-описания', 'Пустое описание (SEO и доверие; CNT-работы)', by((r) => !cell(r, 'description')));
  add('совет', 'html-мусор', 'В описании стили Word или теги font/span — вычистить', by((r) => /mso-|<font|style="/i.test(cell(r, 'description'))));
}
if (idx.barcode >= 0) add('совет', 'штрихкод', 'Штрих-код не 8/12/13 цифр', by((r) => cell(r, 'barcode') && !/^\d{8}$|^\d{12,13}$/.test(cell(r, 'barcode').replace(/\.0$/, ''))));
if (idx.weight < 0) add('совет', 'нет-веса', 'Нет колонки веса — расчёт доставки СДЭК/Почты будет по умолчанию (DLV)');

// 3. Дубли
if (idx.sku >= 0) {
  const seen = new Map();
  data.forEach((r, i) => {
    const k = cell(r, 'sku').toLowerCase();
    if (k) seen.set(k, [...(seen.get(k) || []), lineNo(i)]);
  });
  const dupes = [...seen.values()].filter((l) => l.length > 1).flat();
  add('чистка', 'дубль-артикула', 'Повторяется артикул — импорт перезапишет товар', dupes);
  add('чистка', 'пустой-артикул', 'Пустой артикул', by((r) => !cell(r, 'sku')));
  add('совет', 'артикул-пробелы', 'Пробелы или кириллица в артикуле — ломают сопоставление с учётом', by((r) => /\s|[а-яё]/i.test(cell(r, 'sku'))));
}
if (idx.name >= 0 && idx.variantOf < 0) {
  const seen = new Map();
  data.forEach((r, i) => {
    const k = cell(r, 'name').toLowerCase().replace(/[\s,.;-]+(xs|s|m|l|xl|xxl|\d{2,3}|черн\S*|бел\S*|сер\S*)$/i, '');
    if (k) seen.set(k, [...(seen.get(k) || []), lineNo(i)]);
  });
  const groups = [...seen.values()].filter((l) => l.length > 1);
  if (groups.length) add('совет', 'варианты', `Похоже на модификации без группировки: ${groups.length} групп одинаковых названий. Свести в один товар с вариантами (CAT-05)`, groups.flat());
}

// 4. Справочники значений: «черный / Чёрный / черн.»
const propReport = [];
for (const { h, i } of propCols) {
  const vals = data.map((r) => (r[i] ?? '').trim()).filter(Boolean);
  const norm = new Map();
  for (const v of vals) {
    const k = v.toLowerCase().replace(/ё/g, 'е').replace(/[.\s]+$/g, '');
    norm.set(k, new Set([...(norm.get(k) || []), v]));
  }
  const clashes = [...norm.values()].filter((s) => s.size > 1).map((s) => [...s].join(' / '));
  const fill = vals.length / data.length;
  propReport.push({ h, unique: norm.size, fill, clashes });
  if (clashes.length) add('чистка', 'значения', `«${h}»: одно значение записано по-разному — ${clashes.slice(0, 5).join('; ')}`, by((r) => clashes.some((c) => c.split(' / ').includes((r[i] ?? '').trim()))));
  if (norm.size > 0.6 * data.length && data.length > 20) add('совет', 'свободный-текст', `«${h}»: ${norm.size} разных значений на ${data.length} товаров — это текст, а не фильтр`);
}

// 5. Категории
let catCount = 0;
let maxDepth = 0;
if (idx.category >= 0) {
  const cats = new Map();
  for (const r of data) {
    const c = cell(r, 'category');
    if (!c) continue;
    cats.set(c, (cats.get(c) || 0) + 1);
    maxDepth = Math.max(maxDepth, c.split(/\s*[/>\\]\s*/).length);
  }
  catCount = cats.size;
  add('чистка', 'без-категории', 'Товар без категории', by((r) => !cell(r, 'category')));
  const tiny = [...cats.entries()].filter(([, n]) => n < 3).map(([c]) => c);
  if (catCount > 5 && tiny.length > catCount / 3) add('совет', 'мелкие-категории', `${tiny.length} из ${catCount} категорий содержат 1–2 товара — укрупнить (CAT-01)`);
  if (maxDepth > 3) add('совет', 'глубина', `Глубина категорий ${maxDepth} — больше 3 уровней покупатель не дойдёт`);
}

// Итог
const n = data.length;
const dirtyShare = n ? dirty.size / n : 0;
const blockers = issues.filter((x) => x.level === 'блокер').length;
const units = Math.ceil(n / 100);
// Норматив IMP-02: 1 ч на 100 товаров при полной чистке. Берём долю грязных строк, минимум 0,5 ч если есть хоть одна.
const imp02 = dirty.size ? Math.max(0.5, Math.round(units * Math.min(1, dirtyShare * 1.5) * 2) / 2) : 0;
const verdict = blockers ? 'не готов: есть блокеры' : dirtyShare > 0.3 ? 'грязный: закладываем IMP-02' : dirtyShare > 0 ? 'почти чистый' : 'чистый';

// Поля брифа для calc/estimate.js — то, что видно по файлу, без догадок.
const share = (code) => (issues.find((x) => x.code === code)?.rows.length || 0) / (n || 1);
const sizeCol = propCols.find(({ h }) => /размер/i.test(h));
const sizeVals = sizeCol ? data.map((r) => (r[sizeCol.i] ?? '').trim()).filter(Boolean) : [];
const brief = {
  sku: n,
  categories: catCount || undefined,
  variants: idx.variantOf >= 0 || sizeVals.length > 0 || issues.some((x) => x.code === 'варианты'),
  apparel: sizeVals.some((v) => /^(xx?s|s|m|l|xx?l|\d{2}(-\d{2})?)$/i.test(v)),
  dataQuality: blockers || dirtyShare > 0.3 ? 'bad' : dirtyShare > 0.05 ? 'ok' : 'good',
  photos: idx.images < 0 || share('без-фото') + share('фото-не-ссылка') > 0.1 ? 'mixed' : 'ready',
  descriptions: idx.description < 0 || share('без-описания') > 0.3 ? 'write' : 'have',
};
if (briefOut) writeFileSync(briefOut, JSON.stringify(brief, null, 2) + '\n');

const lines = [];
lines.push(`# Проверка файла импорта: ${file.split('/').pop()}`, '');
lines.push(`Товаров: **${n}** · категорий: **${catCount || '—'}** (глубина ${maxDepth || '—'}) · характеристик: **${propCols.length}**`);
lines.push(`Строк с проблемами: **${dirty.size}** (${Math.round(dirtyShare * 100)}%) · вердикт: **${verdict}**`);
lines.push(`Чистка IMP-02 по факту файла ≈ **${imp02} ч** (калькулятор при dataQuality: bad берёт 1 ч на 100 товаров)`);
lines.push('Поля брифа: `' + JSON.stringify(brief) + '`', '');
lines.push('Найденные колонки: ' + Object.entries(idx).filter(([, i]) => i >= 0).map(([k, i]) => `${k} → «${header[i]}»`).join(', '), '');
for (const level of ['блокер', 'чистка', 'совет']) {
  const shown = issues.filter((x) => x.level === level);
  if (!shown.length) continue;
  lines.push(`## ${level[0].toUpperCase() + level.slice(1)}`, '');
  for (const x of shown) {
    const r = x.rows.length ? ` — ${x.rows.length} стр.: ${x.rows.slice(0, 12).join(', ')}${x.rows.length > 12 ? '…' : ''}` : '';
    lines.push(`- ${x.text}${r}`);
  }
  lines.push('');
}
if (propReport.length) {
  lines.push('## Характеристики', '', '| Колонка | Заполнено | Разных значений | Разнобой |', '|---|---|---|---|');
  for (const p of propReport) lines.push(`| ${p.h} | ${Math.round(p.fill * 100)}% | ${p.unique} | ${p.clashes.length} |`);
  lines.push('');
}
const out = lines.join('\n');
if (mdOut) writeFileSync(mdOut, out + '\n');
console.log(out);
process.exit(blockers ? 2 : 0);

function num(s) {
  const v = parseFloat(String(s).replace(/\s| |₽|руб\.?/g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : NaN;
}

function parseCsv(src) {
  const first = src.split('\n', 1)[0];
  const sep = ['\t', ';', ','].map((s) => [s, first.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const out = [];
  let row = [];
  let f = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { f += '"'; i++; }
      else if (ch === '"') q = false;
      else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(f); f = ''; }
    else if (ch === '\n') { row.push(f.replace(/\r$/, '')); out.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); out.push(row); }
  return out;
}
