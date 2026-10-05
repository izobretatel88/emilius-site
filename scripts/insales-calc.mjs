// Оценка проекта «Магазин на шаблоне InSales» по брифу.
//   node scripts/insales-calc.mjs                 — типовые сценарии (проверка норм)
//   node scripts/insales-calc.mjs brief.json      — смета по брифу
//   node scripts/insales-calc.mjs --html          — пересобрать docs/insales-service/calculator.html
import { readFileSync, writeFileSync } from 'node:fs';
import { estimate, parseCatalog } from '../docs/insales-service/calc/estimate.js';

const dir = new URL('../docs/insales-service/', import.meta.url);
const csv = readFileSync(new URL('03-catalog.csv', dir), 'utf8');
const catalog = parseCatalog(csv);
const arg = process.argv.slice(2).find((a) => a !== '-v');

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
} else if (arg) {
  print(arg, estimate(JSON.parse(readFileSync(arg, 'utf8')), catalog), true);
} else {
  for (const [t, b] of Object.entries(SCENARIOS)) print(t, estimate(b, catalog), process.argv.includes('-v'));
}
