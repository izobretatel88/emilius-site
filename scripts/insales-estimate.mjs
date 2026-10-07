// Калькулятор сметы «Магазин на шаблоне InSales».
// Нормативы — docs/insales-service/data/works.csv, правила выбора работ — ниже.
// Запуск: node scripts/insales-estimate.mjs docs/insales-service/data/brief-example.json
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Ставки часа по ролям, ₽. Источник: фреймворк Emilius (дек. 2025) — inSales 3 500, дизайн 2 400.
// N/A/Q/K — рабочее допущение v1, проверить по фактическим выплатам команде.
export const RATES = {
  M: 3500, // основатель / продажи — диагностика и смета
  R: 3500, // разработчик inSales
  N: 2400, // настройщик inSales / проджект
  D: 2400, // дизайнер
  A: 2400, // аналитик / SEO / маркетолог
  Q: 2400, // тестировщик
  K: 1200, // контент-ассистент (аутсорс)
};

export function loadWorks(path = resolve(root, 'docs/insales-service/data/works.csv')) {
  const [head, ...rows] = readFileSync(path, 'utf8').trim().split('\n');
  const keys = head.split(';');
  return Object.fromEntries(
    rows.map((r) => {
      const o = Object.fromEntries(r.split(';').map((v, i) => [keys[i], v]));
      o.h_fix = Number(o.h_fix);
      o.h_unit = Number(o.h_unit);
      return [o.code, o];
    }),
  );
}

const per100 = (n) => Math.ceil(n / 100);

// Бриф → список [код, количество единиц]. Количество 0 у работ «проект» значит «только h_fix».
export function selectWorks(b) {
  const sku = b.sku ?? 50;
  const out = [];
  const add = (code, qty = 0) => out.push([code, qty]);

  // Всегда
  ['A03', 'A04', 'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'C10', 'D01', 'G01', 'G02',
   'S01', 'S02', 'N01', 'T01', 'T03', 'T04', 'P01', 'P02', 'P03', 'P04'].forEach((c) => add(c));
  add('C01', b.categories ?? 10);
  add('C02', b.filters ?? 3);
  add('C11', per100(sku));
  add('D02', 4);
  add('E01', b.payments ?? 1);
  if (b.kassa !== false) add('E02');
  (b.extraPayments ?? 0) && add('E03', b.extraPayments);
  add('F01', b.deliveryServices ?? 1);
  if (b.pickup || b.ownCourier) add('F02', (b.pickup ? 1 : 0) + (b.ownCourier ? 1 : 0));
  if ((b.deliveryServices ?? 1) >= 3) add('F03');
  if (b.noDimensions) add('F04', per100(sku));

  // Каталог: откуда берём товары
  if (b.variants) add('C03');
  const src = b.source ?? 'excel';
  if (src === 'excel') add('C04', per100(sku));
  if (src === 'marketplace') add('C05', per100(sku));
  if (src === 'manual') add('C07', sku);
  if (b.dirtyData && src !== 'manual') add('C06', per100(sku));
  if (b.photosToProcess) add('C08', Math.ceil(b.photosToProcess / 10));
  if (b.descriptionsToWrite) add('C09', b.descriptionsToWrite);

  // Дизайн
  if (b.banners) add('B07', b.banners);
  if (b.brandDesign) add('B08');
  if (b.extraPages) add('D03', b.extraPages);
  if (b.copywritingPages) add('D04', b.copywritingPages);
  if (b.blogArticles) add('D05', Math.ceil(b.blogArticles / 10));

  // Заказы и CRM
  if (b.promo) add('G03');
  if (b.crm) add('G04', 1);
  if (b.chatWidgets) add('G05', b.chatWidgets);
  if (b.telephony) add('G06');
  if (b.b2b) add('G07');

  // Учёт
  if (b.accounting === 'moysklad') { add('H01'); if (b.ordersToAccounting) add('H02'); add('H07'); }
  if (b.accounting === '1c') {
    add('H03'); add('H04'); add('H05', Math.max(0, (b.warehouses ?? 1) - 1));
    if (b.ordersToAccounting) add('H06');
    add('H07');
  }

  // Маркетплейсы
  const mp = b.marketplaces ?? 0;
  if (mp) {
    add('M01', mp);
    if (b.sharedStock) add('M02', mp);
    if (b.mpOrders) add('M03', mp);
    if (b.priceRules) add('M04');
  }

  // SEO, перенос, аналитика, маркетинг
  if (b.seoCategories) { add('S03', b.seoCategories); add('S04', b.seoCategories); }
  if (b.migrationUrls) { add('S05'); add('S06', per100(b.migrationUrls)); add('S07'); }
  if (b.ecommerce) add('N02');
  if (b.adPixels) add('N03');
  if (b.dashboard) add('N04');
  if (b.email) add('K01');
  if (b.feeds) add('K02', b.feeds);
  if (b.directLaunch) add('K03');

  // Модификации
  if (b.smallEdits) add('X01', b.smallEdits);
  if (b.newBlocks) add('X02', b.newBlocks);
  if (b.configurator) add('X03');
  if (b.multilang) add('X04');

  const integrations = ['G04', 'H07', 'M01'].filter((c) => out.some(([k]) => k === c)).length;
  if (integrations) add('T02', integrations + (mp > 1 ? mp - 1 : 0));
  return out;
}

// Коэффициенты к часам. Применяются ко всему, кроме этапа 0.
export function coefficients(b) {
  const k = [];
  if (b.urgent) k.push(['Срочно: запуск быстрее стандартного срока', 1.25]);
  if (b.materialsNotReady) k.push(['Материалы не готовы, собираем по ходу', 1.15]);
  if ((b.stakeholders ?? 1) >= 3) k.push(['3+ согласующих со стороны клиента', 1.1]);
  k.push(['Риск-буфер фикс-цены', 1.1]);
  return k;
}

export function estimate(b, works = loadWorks()) {
  const order = Object.keys(works);
  const lines = selectWorks(b).sort(([a], [c]) => order.indexOf(a) - order.indexOf(c)).map(([code, qty]) => {
    const w = works[code];
    if (!w) throw new Error(`Нет работы ${code} в works.csv`);
    const hours = w.h_fix + w.h_unit * qty;
    return { code, name: w.name, block: w.block, role: w.role, qty, unit: w.unit, hours, cost: hours * RATES[w.role] };
  });
  const k = coefficients(b);
  const kTotal = k.reduce((p, [, v]) => p * v, 1);
  const hours = lines.reduce((s, l) => s + l.hours, 0);
  const cost = lines.reduce((s, l) => s + l.cost, 0);
  const price = Math.ceil((cost * kTotal) / 5000) * 5000;
  // Срок: 5 чистых часов команды в день на проект + 3 дня ожидания клиента на каждые 20 часов
  const days = Math.ceil((hours * kTotal) / 5 + Math.ceil(hours / 20) * 3);
  const integ = lines.filter((l) => /^(H|M|G04)/.test(l.code)).length;
  const cls = price <= 120000 && !integ ? 'S' : price <= 250000 ? 'M' : 'L';
  return { lines, hours, cost, k, kTotal, price, days, cls };
}

const fmt = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';

export function toMarkdown(b, e) {
  const out = [`# Смета: ${b.client ?? 'клиент'} — класс ${e.cls}`, ''];
  let block = '';
  out.push('| Код | Работа | Кол-во | Часы | Сумма |', '|---|---|---:|---:|---:|');
  for (const l of e.lines) {
    if (l.block !== block) { block = l.block; out.push(`| | **${block}** | | | |`); }
    out.push(`| ${l.code} | ${l.name} | ${l.qty || ''} ${l.qty ? l.unit : ''} | ${l.hours.toFixed(1)} | ${fmt(l.cost)} |`);
  }
  out.push('', `Часы по нормативам: **${e.hours.toFixed(1)}**, себестоимость по ставкам: ${fmt(e.cost)}.`);
  for (const [name, v] of e.k) out.push(`- ×${v} — ${name}`);
  out.push('', `**Цена работ: ${fmt(e.price)}** (округление до 5 000 ₽). Срок: ~${e.days} рабочих дней.`);
  out.push('', 'Не входит: подписка inSales, платная тема, приложения, эквайринг, касса, доставка, реклама.');
  return out.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error('Укажите JSON брифа'); process.exit(1); }
  const b = JSON.parse(readFileSync(file, 'utf8'));
  console.log(toMarkdown(b, estimate(b)));
}
