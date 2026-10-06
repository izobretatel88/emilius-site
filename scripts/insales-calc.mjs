// Оценка проекта «Магазин на шаблоне InSales» по брифу.
//   node scripts/insales-calc.mjs                 — типовые сценарии (проверка норм)
//   node scripts/insales-calc.mjs brief.json      — смета по брифу
//   node scripts/insales-calc.mjs --html          — пересобрать docs/insales-service/calculator.html
//   node scripts/insales-calc.mjs --answers '{…}' — смета по ответам из заявки с лендинга (строка «Ответы» в Telegram)
//   node scripts/insales-calc.mjs --quick         — ориентиры формы лендинга (7 вопросов) против полной сметы
import { readFileSync, writeFileSync } from 'node:fs';
import { estimate, parseCatalog } from '../docs/insales-service/calc/estimate.js';
import { quickBrief, quickEstimate } from '../docs/insales-service/calc/quick.js';

const dir = new URL('../docs/insales-service/', import.meta.url);
const csv = readFileSync(new URL('03-catalog.csv', dir), 'utf8');
const catalog = parseCatalog(csv);
const arg = process.argv.slice(2).find((a) => a !== '-v');
const argAfter = (flag) => process.argv[process.argv.indexOf(flag) + 1];

// Ответы формы лендинга для типовых клиентов — сверяем с полной сметой тех же SCENARIOS.
export const QUICK = {
  'Старт: бренд из соцсетей, 30 товаров': { channel: 'social', sku: '30', where: 'head' },
  'Магазин: офлайн-розница, 400 SKU в Excel, 2 доставки': { channel: 'offline', sku: '600', where: 'excel', variants: 'yes', carriers: '2' },
  'Селлер: бренд одежды на WB+Ozon, 150 SKU': { channel: 'mp', sku: '150', where: 'mp', variants: 'yes', carriers: '2' },
  'Офлайн + 1С: 2000 SKU, SEO (как Happy Animal)': { channel: 'offline', sku: '2000', where: '1c', variants: 'yes', carriers: '2' },
  'Переезд с Tilda: 120 товаров, трафик': { channel: 'site', sku: '150', where: 'site', carriers: '2' },
};

const rub = (n) => n.toLocaleString('ru-RU') + ' ₽';

function print(title, e, detail = false) {
  console.log(`\n${title}\n  пакет: ${e.packageName} · ${e.hours} ч (без коэф. ${e.rawHours}) · скидка ${e.discount * 100}% · цена ${rub(e.price)} · коридор ФИКС ${rub(e.fixCorridor[0])}–${rub(e.fixCorridor[1])} · ~${e.weeks} нед.`);
  if (e.coefficients.length) console.log('  коэффициенты: ' + e.coefficients.map(([n, v]) => `${n} ×${v}`).join('; '));
  console.log(`  платформа: тариф «${e.platform.tariff.name}» ${rub(e.platform.tariff.month)}/мес`);
  if (detail) for (const l of e.lines) console.log(`   ${l.inPkg ? ' ' : '+'} ${l.id.padEnd(10)} ${l.task.padEnd(42)} ×${String(l.qty).padEnd(4)} ${l.hours.toFixed(2).padStart(6)} ч ${l.role}`);
}

export const SCENARIOS = {
  'Старт: бренд из соцсетей, 30 товаров': { segment: 'social', sku: 30, categories: 6 },
  'Магазин: офлайн-розница, 400 SKU в Excel, 2 доставки': { segment: 'offline', sku: 400, categories: 25, variants: true, source: 'excel', carriers: 2, pickupCourier: 2, staff: 3, offlinePoints: 1 },
  'Селлер: бренд одежды на WB+Ozon, 150 SKU': { segment: 'seller', sku: 150, categories: 12, variants: true, apparel: true, source: 'marketplace', carriers: 2, marketplaces: 2 },
  'Офлайн + 1С: 2000 SKU, SEO (как Happy Animal)': { segment: 'offline', sku: 2000, categories: 60, variants: true, source: '1c', accounting: '1c', ordersToAccounting: true, carriers: 2, pickupCourier: 2, seo: 'semantic', seoClusters: 120, offlinePoints: 2, directFeed: true, staff: 3 },
  'Переезд с Tilda: 120 товаров, трафик': { segment: 'oldsite', sku: 120, categories: 10, source: 'oldsite', oldSiteUrls: 180, carriers: 2, migrateCustomers: true },
};

if (arg === '--html') {
  const core = readFileSync(new URL('calc/estimate.js', dir), 'utf8').replace(/^export /gm, '');
  const tpl = readFileSync(new URL('calc/calculator.template.html', dir), 'utf8');
  const html = tpl.replace('/*__CORE__*/', core).replace('"__CSV__"', JSON.stringify(csv));
  writeFileSync(new URL('calculator.html', dir), html);
  console.log('calculator.html собран');
} else if (arg === '--answers') {
  const b = quickBrief(JSON.parse(argAfter('--answers')));
  console.log('бриф для правки и КП:', JSON.stringify(b));
  print('Смета по ответам с лендинга', estimate(b, catalog), true);
} else if (arg === '--quick') {
  // Ориентир с сайта должен быть не выше полной сметы базовой части и не ниже минимума пакета.
  let bad = 0;
  for (const [t, a] of Object.entries(QUICK)) {
    const q = quickEstimate(a, catalog);
    const full = estimate(SCENARIOS[t], catalog);
    const flag = q.packageName !== full.packageName ? '  ← другой пакет' : '';
    if (flag) bad++;
    console.log(`${t}\n  форма: ${q.packageName} ${rub(q.from)}–${rub(q.to)}, ${q.weeks.join('–')} нед. · полная смета: ${full.packageName} ${rub(full.price)}${flag}`);
  }
  if (bad) process.exit(1);
} else if (arg) {
  print(arg, estimate(JSON.parse(readFileSync(arg, 'utf8')), catalog), true);
} else {
  for (const [t, b] of Object.entries(SCENARIOS)) print(t, estimate(b, catalog), process.argv.includes('-v'));
}
