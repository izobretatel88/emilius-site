// Правила оценки: ответы брифа → список работ с количеством → часы → цена.
// Ставки и коэффициенты — рабочие допущения от 08.10.2026, пересматривать по факту проектов
// (см. docs/insales-service/12-improvement.md).

import { WORKS } from './works.mjs';

// Продажная ставка, ₽/ч. Рынок 2025–2026: поддержка InSales 2 690–4 500 ₽/ч.
export const RATES = { PM: 2500, IN: 2000, KM: 1200, DZ: 2800, FR: 3200, SEO: 2800, AN: 2800 };

export const PM_SHARE = 0.12;      // управление проектом от производственных часов
export const PM_MIN_HOURS = 3;
export const RISK = { 1: 0.05, 2: 0.10, 3: 0.20 }; // резерв по уровню сложности проекта
export const URGENT = 1.3;         // запуск быстрее нормы срока
export const ROUND = 1000;         // округление цены вверх
export const STAGE0_PRICE = 15000; // Этап 0, засчитывается в проект при старте в 30 дней

// Пакеты: границы, по которым проект попадает в фиксированную цену.
// includes — что входит в пакет: код работы → количество единиц. Всё сверх — допработы по прайсу.
const BASE = Object.fromEntries(['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10', 'B11', 'B12',
  'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20', 'B21', 'B22', 'K01', 'K03', 'MK5'].map((c) => [c, 1]));
const SHOP = { ...BASE, B12: 1.5, B13: 1.5, K02: 2, K04: 5, K05: 2, K06: 1, K07: 1, K08: 5, K13: 1, K14: 1,
  D02: 3, D03: 1, D04: 3, D07: 1, AN1: 1 };
export const PACKAGES = [
  { id: 'start', name: 'Старт', price: 59000, days: '10 рабочих дней',
    limits: { sku: 50, categories: 20, integrations: 0 },
    includes: { ...BASE, K04: 3, K06: 1, K08: 1, D02: 1 } },
  { id: 'shop', name: 'Магазин', price: 119000, days: '15–20 рабочих дней',
    limits: { sku: 500, categories: 40, integrations: 0 }, includes: SHOP },
  { id: 'sync', name: 'Магазин + синхронизация', price: 169000, days: '20–30 рабочих дней',
    limits: { sku: 1000, categories: 60, integrations: 2 },
    includes: { ...SHOP, Z01: 1, Z02: 1, Z03: 1, Z04: 1, Z05: 1, Z06: 1, K02: 4, K08: 10, MP1: 2, MP2: 10, MP3: 2,
      MS1: 1, MS2: 1, MS3: 1, MS4: 1, MS5: 1, MS6: 1, MS7: 1, MS8: 1 } },
];
// В пакет не помещаются: 1С, переезд, семантика, МойСклад вместе с площадками.
// Такие проекты считаются только сметой.
export const integrationCount = (b) => (b.accounting === 'moysklad' ? 1 : 0) + (b.marketplaces || 0) + (b.crm ? 1 : 0);
export const fitsPackage = (b, p) => (b.sku || 0) <= p.limits.sku
  && !(b.accounting === 'moysklad' && (b.marketplaces || 0) > 1)
  && (b.categories || 0) <= p.limits.categories
  && integrationCount(b) <= p.limits.integrations
  && !b.migration && b.accounting !== '1c' && b.seo !== 'semantic';

// Цена допработы за единицу — для прайса и быстрых оценок: норматив × ставка × (1 + PM) × (1 + резерв 10%).
export const unitPrice = (x) => Math.ceil((x.hNorm * RATES[x.role] * (1 + PM_SHARE) * 1.1) / 500) * 500;

const ceil = (n, by) => Math.max(0, Math.ceil(n / by));

/**
 * Бриф (все поля необязательны, недостающее = «нет/по умолчанию»):
 * stage0: bool — продаём Этап 0 отдельно
 * sku, categories, variants: 'none'|'some'|'all'
 * source: 'manual'|'table'|'mp'|'moysklad'|'1c'|'oldsite'
 * photosReady: bool, descriptionsReady: bool
 * accounting: 'none'|'moysklad'|'1c'; orders1c: bool; onec: 'typical'|'custom'
 * marketplaces: number (сколько площадок синхронизировать)
 * warehouses: number, b2b: bool
 * payments: number (способов онлайн-оплаты), deliveries: number (служб с расчётом)
 * brandbook: bool, banners: number, extraPages: number, cssFixes: number, customBlocks: number, sizeTable: bool
 * crm: bool, telephony: bool, email: bool, emailTriggers: bool, ads: bool, offline: bool, chat: bool
 * ecommerce: bool, report30: bool
 * seo: 'base'|'semantic'; seoTexts: number; local: bool
 * migration: bool, oldUrls: number, oldPages: number, oldCustomers: bool
 * promo: bool, support: number (часов в месяц, только для информации)
 * urgent: bool
 */
export function scope(b) {
  const q = {}; // код работы → количество единиц
  const add = (code, n = 1) => { if (n > 0) q[code] = (q[code] || 0) + n; };
  const sku = b.sku || 0;
  const cats = b.categories || Math.max(5, Math.ceil(sku / 25));

  if (b.stage0) ['Z01', 'Z02', 'Z03', 'Z04', 'Z05', 'Z06'].forEach((c) => add(c));
  // B03 не нужен, если тему выбрали на Этапе 0
  ['B01', 'B02', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10', 'B11', 'B12', 'B13', 'B14',
    'B15', 'B16', 'B17', 'B18', 'B19', 'B20', 'B21', 'B22'].forEach((c) => add(c));
  if (!b.stage0) add('B03');
  if ((b.payments || 1) > 1) add('B12', (b.payments - 1) * 0.5); // второй способ — половина работы
  if ((b.deliveries || 1) > 1) add('B13', (b.deliveries - 1) * 0.5);

  // Каталог
  add('K01'); add('K03');
  if (cats > 20) add('K02', ceil(cats - 20, 10));
  const varShare = b.variants === 'all' ? 1 : b.variants === 'some' ? 0.3 : 0;
  const src = b.source || (sku > 60 ? 'table' : 'manual');
  if (src === 'manual') {
    add('K04', ceil(sku, 10));
    add('K05', ceil(sku * varShare, 10));
  } else if (src === 'table' || src === 'oldsite') {
    add('K06'); add('K08', ceil(sku, 100));
  } else if (src === 'mp') {
    add('K07'); add('K08', ceil(sku, 100));
  } else {
    add('K08', ceil(sku, 100)); // товары приходят из учёта, но чистить всё равно надо
  }
  if (b.photosReady === false) add('K09', ceil(sku, 10));
  if (b.descriptionsReady === false) add('K10', ceil(sku, 10));
  if ((b.warehouses || 1) > 1) add('K11');
  if (b.b2b) add('K12');
  if (b.promo) add('K13');
  if (sku > 50) add('K14');

  // Дизайн
  if (b.brandbook) add('D01');
  add('D02', b.banners || 0);
  add('D03', b.extraPages || 0);
  add('D04', b.cssFixes || 0);
  add('D05', b.customBlocks || 0); add('D06', b.customBlocks || 0);
  if (b.sizeTable) add('D07');

  // Учёт
  if (b.accounting === 'moysklad') {
    ['MS1', 'MS2', 'MS3', 'MS4', 'MS5', 'MS7', 'MS8'].forEach((c) => add(c));
    if (b.orders1c !== false) add('MS6');
  }
  if (b.accounting === '1c') {
    ['C101', 'C102', 'C103', 'C104', 'C106', 'C107', 'C110', 'C111', 'C112'].forEach((c) => add(c));
    if (varShare > 0) add('C105');
    if (b.orders1c !== false) { add('C108'); add('C109'); }
  }
  // Маркетплейсы
  const mp = b.marketplaces || 0;
  if (mp) { add('MP1', mp); add('MP2', mp * ceil(sku, 100)); add('MP3', mp); }

  // CRM и маркетинг
  if (b.crm) { add('CR1'); add('CR2'); }
  if (b.telephony) add('CR3');
  if (b.email) add('MK1');
  if (b.emailTriggers) { if (!b.email) add('MK1'); add('MK2'); }
  if (b.ads) add('MK3');
  if (b.offline) add('MK4');
  if (b.chat !== false) add('MK5');
  if (b.ecommerce || b.ads) add('AN1');
  if (b.report30) add('AN2');

  // SEO
  if (b.seo === 'semantic') { add('S1'); add('S2', b.seoTexts ?? Math.min(cats, 10)); }
  if (b.local) add('S3');

  // Переезд
  if (b.migration) {
    add('R1'); add('R2'); add('R6');
    add('R4', ceil(b.oldUrls || sku + cats + 10, 100));
    add('R5', ceil(b.oldPages || 0, 10));
    if (b.oldCustomers) add('R3');
  }
  return q;
}

// Уровень сложности проекта: максимум из сложности работ с заметным весом + факторы брифа.
export function complexity(b, lines) {
  let level = 1;
  if (lines.some((l) => l.cx >= 2 && l.hours >= 2)) level = 2;
  if (b.accounting === '1c' || (b.customBlocks || 0) > 1 || (b.sku || 0) > 2000 || b.onec === 'custom') level = 3;
  return level;
}

const byCode = Object.fromEntries(WORKS.map((x) => [x.code, x]));

export function estimate(b) {
  const q = scope(b);
  const lines = Object.entries(q).map(([code, qty]) => {
    const x = byCode[code];
    const hours = +(x.hNorm * qty).toFixed(2);
    return { code, module: x.module, name: x.sub, unit: x.unit, qty, role: x.role, cx: x.cx,
      hours, hMax: +(x.hMax * qty).toFixed(2), cost: hours * RATES[x.role] };
  });
  const prodHours = lines.reduce((s, l) => s + l.hours, 0);
  const pmHours = Math.max(PM_MIN_HOURS, prodHours * PM_SHARE);
  const level = complexity(b, lines);
  const base = lines.reduce((s, l) => s + l.cost, 0) + pmHours * RATES.PM;
  const risk = base * RISK[level];
  let total = (base + risk) * (b.urgent ? URGENT : 1);
  total = Math.ceil(total / ROUND) * ROUND;
  const hoursTotal = prodHours + pmHours;
  // Пакетная цена: самый дешёвый подходящий пакет + допработы сверх его состава.
  const offers = PACKAGES.filter((p) => fitsPackage(b, p)).map((p) => {
    const extras = lines.map((l) => ({ ...l, extraQty: +(l.qty - (p.includes[l.code] || 0)).toFixed(2) }))
      .filter((l) => l.extraQty > 0)
      .map((l) => ({ ...l, extraCost: l.extraQty * unitPrice(byCode[l.code]) }));
    const price = Math.ceil((p.price + extras.reduce((s, l) => s + l.extraCost, 0)) * (b.urgent ? URGENT : 1) / ROUND) * ROUND;
    return { ...p, extras, quote: price };
  }).sort((a, z) => a.quote - z.quote);
  const fits = offers[0];
  // Срок: 5 продуктивных часов команды в рабочий день + 5 дней на согласования и эквайринг.
  const workDays = Math.ceil(hoursTotal / 5) + 5;
  return { lines, prodHours, pmHours, hoursTotal, level, base, risk, total, package: fits || null, workDays,
    worstHours: lines.reduce((s, l) => s + l.hMax, 0) * (1 + PM_SHARE) };
}
