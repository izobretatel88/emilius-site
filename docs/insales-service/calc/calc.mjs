// Калькулятор проекта «Магазин на шаблоне InSales».
// Бриф (JSON) → объём работ → часы по ролям → цена → срок → смета первого года.
//
//   node docs/insales-service/calc/calc.mjs docs/insales-service/calc/examples/seller.json
//   node docs/insales-service/calc/calc.mjs --csv > docs/insales-service/03-works.csv
//
// Правила расчёта описаны в 04-pricing.md. Меняешь норму — меняешь works.mjs, не этот файл.

import { readFileSync } from 'node:fs';
import { WORKS, RATES, BLOCKS, PACKAGES } from './works.mjs';

const byId = Object.fromEntries(WORKS.map((w) => [w.id, w]));

// Коэффициенты (см. 04-pricing.md, раздел «Коэффициенты»)
export const K = {
  revisions: 0.1, // два круга правок и согласований
  riskLevel3: 0.25, // запас на работы уровня 3 (1С, парсинг, сложная механика)
  urgency: [0, 0.15, 0.3], // обычный срок / быстрее в 1,5 раза / в 2 раза
  manyApprovers: 0.1, // больше одного согласующего на стороне клиента
  dataQuality: { ready: 0, partial: 0.5, messy: 1 }, // часов чистки на 100 товаров (C6)
  volumeDiscount: [[160, 0.2], [120, 0.15], [80, 0.1], [40, 0.05]], // пакеты часов агентства
  hoursPerDay: 4, // продуктивных часов исполнителя в день
};

// Ориентиры расходов клиента на платформу. СВЕРИТЬ на insales.ru перед каждой сметой — тарифы обновлены в 2026.
export const OWNERSHIP = {
  tariffShop: 2295, // ₽/мес, тариф «Интернет-магазин» (исследование ЦА, 27.09.2026)
  tariffCombo: 5610, // ₽/мес при оплате за год, «Комбо» для сайта и маркетплейсов
  oneC: 990, // ₽/мес, обмен с 1С на тарифах ниже «Ультра» (по сводке поиска, не проверено)
  moySkladApp: 5000, // ₽ разово, приложение МойСклад для InSales (сайт МойСклад, 2025)
  supportPerMonth: 5 * 2400, // абонемент «5 часов в месяц»
};

const ceil = (n) => Math.ceil(n - 1e-9);
const per100 = (n) => (n > 0 ? Math.max(1, ceil(n / 100)) : 0);

// Пакет определяется брифом, а не желанием продать дороже.
export function pickPackage(b) {
  if (b.package) return b.package; // клиент выбрал сам (например, «Экспресс»)
  if ((b.accounting && b.accounting !== 'none') || b.sku > 500) return 'business';
  if (b.marketplaces?.length) return 'seller';
  return 'start';
}

// Бриф → список [id, количество]
export function scope(b) {
  const pkg = pickPackage(b);
  const q = new Map();
  const add = (id, n = 1) => n > 0 && q.set(id, (q.get(id) || 0) + n);
  const on = (id) => q.set(id, Math.max(q.get(id) || 0, 1)); // разовая работа: не удваивать, если уже в пакете

  PACKAGES[pkg].works.forEach(on);
  if (b.diagnostics) ['Z1', 'Z2', 'Z3', 'Z4'].forEach(on); // Этап 0 внутри проекта, если не куплен отдельно

  // Каталог
  const sku = b.sku || 0;
  add('C1x', Math.max(0, (b.categories || 0) - 15));
  add('C2x', Math.max(0, (b.properties || 0) - 8));
  if (!b.variants) q.delete('C3');
  const src = b.source || 'table';
  if (src === 'manual') {
    ['C4', 'C5'].forEach((id) => q.delete(id));
    add('C7', sku);
  } else if (src === 'table' || src === 'oldsite') {
    on('C4'); on('C5');
    if (pkg !== 'express') add('C5s', per100(sku)); // в «Экспрессе» грузим пробные 20 товаров, остальное — клиент
    add('C6', per100(sku) * (K.dataQuality[b.dataQuality || 'partial'] ?? 0.5));
  } else if (src === 'marketplace') {
    q.delete('C4'); q.delete('C5');
    add('C6', per100(sku) * (K.dataQuality[b.dataQuality || 'partial'] ?? 0.5) * 0.5); // карточки МП уже структурированы
  }
  add('C8', b.descriptions || 0);
  add('C9', b.photosToProcess || 0);

  // Маркетплейсы
  const mp = b.marketplaces || [];
  if (mp.length) {
    q.set('K1', mp.length);
    add('K3', per100(sku));
    if (src !== 'marketplace') q.delete('K2');
    if (!b.fbs) q.delete('K5');
  }

  // Учёт
  if (b.accounting === 'moysklad') { on('I1'); add('I2', per100(sku)); on('I3'); }
  if (b.accounting === '1c') {
    ['I4', 'I5', 'I7', 'I9'].forEach((id) => on(id));
    if (b.variants) on('I6');
    if (b.ordersTo1c !== false) on('I8');
    add('I10', per100(sku));
    if (src === 'table') { q.delete('C4'); q.delete('C5'); q.delete('C5s'); q.delete('C6'); }
  }

  // Оплата и доставка
  q.set('P1', Math.max(1, b.payments || 1));
  if (b.sbp) on('P2');
  if (b.cod || b.b2bInvoice) on('P4');
  if (b.pickupPoints) q.set('D1', b.pickupPoints); else q.delete('D1');
  if (b.courier) on('D2'); else q.delete('D2');
  const carriers = b.carriers ?? 1;
  if (carriers >= 3) { q.delete('D3'); on('D4'); } else if (carriers > 0) q.set('D3', carriers); else q.delete('D3');

  // Оформление и код
  add('T5', b.extraHomeBlocks || 0);
  add('T6', b.banners || 0);
  add('T11', b.extraPages || 0);
  add('M1', b.smallTweaks || 0);
  add('M2', b.newBlocks || 0);
  add('M3', b.newBlocksDesign || 0);
  add('M4', b.complexMechanics || 0);
  add('M5', b.landings || 0);
  if (b.landings) add('M2', b.landings);

  // Техника, аналитика, SEO
  if (b.domainMail) on('N2');
  if (b.ecommerce) on('A3');
  if (b.feed) on('A5');
  if (b.vkPixel) on('A6');
  if (b.seo === 'core') on('O2');
  add('O3', b.seoTexts || 0);
  if (b.localSeo) on('O4');

  // CRM и маркетинг
  if (b.crm === 'amo' || b.crm === 'bitrix') on('R3');
  if (b.crm === 'retail') on('R4');
  if (b.telephony) on('R5');
  if (b.bonuses) on('G1');
  if (b.mailing) on('G2');
  if (b.reviews) on('G3');
  if (b.certificates) on('G4');

  // Перенос
  const mig = b.migration;
  if (mig) {
    on('X1');
    if (mig.export) on('X2');
    if (mig.customers) on('X3');
    if (mig.urls) { on('X4'); add('X4s', per100(mig.urls)); on('X5'); }
    add('X6', mig.articles || 0);
  }

  return { pkg, items: [...q].filter(([, n]) => n > 0).map(([id, n]) => ({ ...byId[id], qty: n, hours: +(byId[id].h * n).toFixed(2) })) };
}

export function estimate(b) {
  const { pkg, items } = scope(b);
  const byRole = {};
  let base = 0, risky = 0;
  for (const it of items) {
    byRole[it.role] = (byRole[it.role] || 0) + it.hours;
    base += it.hours * RATES[it.role].rate;
    if (it.level === 3) risky += it.hours * RATES[it.role].rate;
  }
  const hours = Object.values(byRole).reduce((a, h) => a + h, 0);
  const mods = [
    ['Правки и согласования (2 круга)', base * K.revisions],
    ['Запас на рискованные работы', risky * K.riskLevel3],
    ['Срочность', base * K.urgency[b.urgency || 0]],
    ['Несколько согласующих', b.approvers > 1 ? base * K.manyApprovers : 0],
  ].filter(([, v]) => v > 0);
  const gross = base + mods.reduce((a, [, v]) => a + v, 0);
  const disc = K.volumeDiscount.find(([h]) => hours >= h)?.[1] || 0;
  const price = Math.ceil((gross * (1 - disc)) / 1000) * 1000;

  // Срок: часы / продуктивность + неделя на ожидания (банк, касса, материалы клиента)
  const workDays = ceil(hours / K.hoursPerDay / (b.executors || 1.5));
  const weeks = [ceil(workDays / 5) + 1, ceil(workDays / 5) + 2];

  const combo = (b.marketplaces?.length || 0) > 0;
  const tariff = combo ? OWNERSHIP.tariffCombo : OWNERSHIP.tariffShop;
  const year = {
    'Работа Emilius (разово)': price,
    [`Тариф InSales «${combo ? 'Комбо' : 'Интернет-магазин'}», 12 мес`]: tariff * 12,
    ...(b.accounting === '1c' ? { 'Обмен с 1С, 12 мес': OWNERSHIP.oneC * 12 } : {}),
    ...(b.accounting === 'moysklad' ? { 'Приложение МойСклад (разово)': OWNERSHIP.moySkladApp } : {}),
    'Поддержка 5 ч/мес, 12 мес (по желанию)': OWNERSHIP.supportPerMonth * 12,
  };

  return { pkg, items, byRole, hours, base, mods, disc, price, weeks, year };
}

const rub = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
const h = (n) => (Math.round(n * 10) / 10).toLocaleString('ru-RU') + ' ч';

export function toMarkdown(b, e) {
  const L = [];
  L.push(`### ${b.client || 'Проект'} — пакет «${PACKAGES[e.pkg].name}»`, '');
  L.push(`**Цена работ: ${rub(e.price)}** · ${h(e.hours)} · срок ${e.weeks[0]}–${e.weeks[1]} нед.`, '');
  L.push('| Блок | Работа | Кол-во | Часы | Роль |', '|---|---|---:|---:|---|');
  for (const it of e.items) L.push(`| ${BLOCKS[it.block]} | ${it.name} | ${it.qty % 1 ? it.qty.toFixed(1) : it.qty} | ${h(it.hours)} | ${RATES[it.role].name} |`);
  L.push('', '| Расчёт | Сумма |', '|---|---:|');
  for (const [r, hh] of Object.entries(e.byRole)) L.push(`| ${RATES[r].name}: ${h(hh)} × ${RATES[r].rate} ₽ | ${rub(hh * RATES[r].rate)} |`);
  for (const [n, v] of e.mods) L.push(`| ${n} | +${rub(v)} |`);
  if (e.disc) L.push(`| Скидка за объём ${e.disc * 100}% | −${e.disc * 100}% |`);
  L.push(`| **Итого (округлено вверх до 1000)** | **${rub(e.price)}** |`, '');
  L.push('Смета первого года (ориентир, тарифы сверить на insales.ru):', '');
  L.push('| Статья | Сумма |', '|---|---:|');
  for (const [n, v] of Object.entries(e.year)) L.push(`| ${n} | ${rub(v)} |`);
  L.push(`| Не входит: эквайринг (% с оплат), касса/ОФД, доставка, реклама | по договорам клиента |`);
  return L.join('\n');
}

function toCsv() {
  const head = ['id', 'блок', 'работа', 'описание', 'когда нужна', 'вход', 'результат', 'роль', 'ставка', 'норма ч', 'единица', 'уровень', 'зависимости', 'риски', 'в пакетах'];
  const esc = (s) => `"${String(s ?? '').replaceAll('"', '""')}"`;
  const unit = { project: 'проект', sku100: '100 товаров', item: 'шт.' };
  const inPk = (id) => Object.entries(PACKAGES).filter(([, p]) => p.works.includes(id)).map(([, p]) => p.name).join(', ');
  const rows = WORKS.map((w) => [w.id, BLOCKS[w.block], w.name, w.desc, w.when, w.input, w.output, RATES[w.role].name, RATES[w.role].rate, String(w.h).replace('.', ','), unit[w.unit], w.level, w.deps.join(' '), w.risks, inPk(w.id)]);
  return [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (arg === '--csv') console.log(toCsv());
  else if (arg) {
    const b = JSON.parse(readFileSync(arg, 'utf8'));
    console.log(toMarkdown(b, estimate(b)));
  } else console.error('node calc.mjs <brief.json> | --csv');
}
