// Калькулятор сметы: бриф клиента (JSON) → список работ → часы → цена → срок.
//
//   node docs/insales-service/calculator/calc.mjs briefs/seller.json          # смета в markdown
//   node docs/insales-service/calculator/calc.mjs briefs/seller.json --json   # то же в JSON
//   node docs/insales-service/calculator/calc.mjs --csv > works.csv           # каталог работ для таблицы
//
// Правила цены — в PRICING ниже; поменяли ставку — поменяли здесь, документы ссылаются на калькулятор.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORKS, STAGES, DEFAULTS } from './catalog.mjs';

export const PRICING = {
  rate: { nc: 2400, dev: 3500, pm: 4200 }, // ₽/ч, ставка команды (включает менеджера и тестировщика)
  // Разброс оценки по сложности: [мин, макс] к типовой.
  spread: { 1: [0.85, 1.2], 2: [0.8, 1.35], 3: [0.75, 1.6] },
  // Скидки за объём заказа (как в прайсе агентства).
  volume: [[160, 0.2], [120, 0.15], [80, 0.1], [40, 0.05]],
  diagnosticsPrice: 15000, // этап 0 отдельно, засчитывается в проект при старте в течение 14 дней
  fixReserveShare: 0.08,   // резерв на исправления после теста — доля от часов настройки
  roundTo: 1000,
  // Работы, входящие в выбранный пакет, делаются по заготовкам (юр. страницы, письма, цели Метрики, чек-лист).
  // Гипотеза: −15% к часам. Проверить по таймеру на первых 3 проектах и поправить.
  standardK: 0.85,
  hoursPerWeek: 20,        // сколько часов исполнителя проект получает в неделю (4 продуктивных часа × 5 дней)
  clientWaitWeeks: 1,      // ожидание материалов и модерации платёжки — минимум
};

// Коэффициенты риска к часам производства (кроме этапа 0).
export function coefficients(b) {
  const k = [];
  if (b.urgent) k.push(['Срочно: срок меньше нормы, работа параллельно', 1.25]);
  if (b.deciders > 1) k.push([`Решение принимают ${b.deciders} человека: больше согласований`, 1 + 0.05 * Math.min(b.deciders - 1, 3)]);
  if (b.content === 'none') k.push(['Материалы собираем вместе с клиентом', 1.1]);
  if (b.firstSite) k.push(['Первый сайт у клиента: больше объяснений', 1.05]);
  return k;
}

// Нормализация брифа: значения по умолчанию и производные количества.
export function normalize(raw) {
  const b = {
    segment: 'A', sku: 50, categories: 8, variants: false, source: 'excel', dataQuality: 'clean',
    content: 'ready', design: 'template', domain: 'have', mail: false, staff: 1,
    payments: ['card'], delivery: ['cdek', 'pickup'], pickupPoints: 1, freeShipping: false, installments: false,
    marketplaces: [], mpPrices: false, mpOrders: false, yandexFeed: false,
    accounting: 'none', ordersTo1c: true, clientsTo1c: false,
    crm: 'none', phone: false, emailMarketing: false,
    analytics: 'basic', ads: false, dashboard: false,
    seo: 'base', migration: false, urls: 0, moveCustomers: false, moveOrders: false,
    b2b: false, repeat: false, loyalty: false, hasAudience: true,
    blogPosts: 0, cssFixes: 0, customBlocks: 0, customPages: 0, banners: DEFAULTS.banners,
    homeBlocks: DEFAULTS.homeBlocks, params: DEFAULTS.params, collections: DEFAULTS.collections,
    infoPages: DEFAULTS.infoPages, photosPerSku: 3, seoTexts: 0,
    urgent: false, deciders: 1, firstSite: false,
    ...raw,
  };
  // Каталог из учётной системы приходит через обмен (S10), а не через импорт таблицы.
  if (['1c', 'moysklad'].includes(b.accounting) && !raw.source) b.source = b.accounting;
  const carriers = b.delivery.filter((d) => !['pickup', 'courier'].includes(d)).length;
  const payProviders = b.payments.includes('card') || b.payments.includes('sbp') ? 1 + (b.payments.includes('second') ? 1 : 0) : 0;
  const offlinePay = ['cod', 'invoice'].filter((p) => b.payments.includes(p)).length;
  const deliveryWays = carriers + (b.delivery.includes('pickup') ? 1 : 0) + (b.delivery.includes('courier') ? 1 : 0);
  const payWays = payProviders + offlinePay;
  const q = {
    sku: b.sku, categories: b.categories, params: b.params, homeBlocks: b.homeBlocks, banners: b.banners,
    collections: b.collections, infoPages: b.infoPages, staff: b.staff, blogPosts: b.blogPosts,
    cssFixes: b.cssFixes, customBlocks: b.customBlocks, customPages: b.customPages,
    photos: b.sku * b.photosPerSku, skuToWrite: b.sku,
    payProviders, offlinePay, carriers, pickupPoints: b.delivery.includes('pickup') ? b.pickupPoints : 0,
    mps: b.marketplaces.length, mpSku: b.sku * b.marketplaces.length,
    urls: b.urls, seoTexts: b.seo === 'extended' ? (b.seoTexts || Math.min(b.categories, 15)) : 0,
    testCombos: Math.max(1, payWays) * Math.max(1, deliveryWays),
    fixReserve: 0, // считается после основного прохода
  };
  return { b, q };
}

// Какой пакет ближе всего к брифу — для подсказки продавцу.
// «Пилот» — MVP по образцу Endorphine: без обучения по видео, UTM, отзывов и разбора 30 дней.
export const PILOT_SKIP = ['S12.04', 'S8.09', 'S16.01', 'S17.01', 'S8.06'];

export function suggestPackage(b) {
  if (b.sku <= 20 && b.marketplaces.length === 0 && b.accounting === 'none' && !b.migration && b.source === 'none') return 'P';
  if (b.accounting !== 'none' || b.migration || b.sku > 1000) return 'L';
  if (b.marketplaces.length > 0 || b.sku > 100 || b.source === 'mp') return 'M';
  return 'S';
}

const r1 = (x) => Math.round(x * 10) / 10;

export function estimate(raw) {
  const { b, q } = normalize(raw);
  const pkg = suggestPackage(b);
  const lines = [];
  for (const w of WORKS) {
    if (!w.on(b, q)) continue;
    if (pkg === 'P' && PILOT_SKIP.includes(w.id)) continue;
    if (w.id === 'S15.03') continue;
    const units = w.unit ? q[w.unit] ?? 0 : 0;
    const hours = (w.h || 0) + (w.per || 0) * units;
    if (hours <= 0) continue;
    lines.push({ ...w, units, hours });
  }
  // Резерв на исправления — доля от настройки (без этапа 0 и пост-запуска).
  const setup = lines.filter((l) => !['S0', 'S17'].includes(l.stage)).reduce((s, l) => s + l.hours, 0);
  const fix = WORKS.find((w) => w.id === 'S15.03');
  lines.push({ ...fix, units: 1, hours: setup * PRICING.fixReserveShare });

  const coefs = coefficients(b);
  const kProd = coefs.reduce((m, [, k]) => m * k, 1);

  let hoursTyp = 0, hoursMin = 0, hoursMax = 0, priceRaw = 0;
  const byStage = {};
  for (const l of lines) {
    const std = l.pkg && l.pkg.includes(pkg === 'P' ? 'S' : pkg) ? PRICING.standardK : 1;
    const k = l.stage === 'S0' ? 1 : kProd * std;
    const [smin, smax] = PRICING.spread[l.lvl];
    l.hTyp = l.hours * k;
    l.hMin = l.hTyp * smin;
    l.hMax = l.hTyp * smax;
    l.price = l.hTyp * PRICING.rate[l.tier];
    hoursTyp += l.hTyp; hoursMin += l.hMin; hoursMax += l.hMax; priceRaw += l.price;
    const s = (byStage[l.stage] ||= { hours: 0, price: 0 });
    s.hours += l.hTyp; s.price += l.price;
  }

  const s0 = byStage.S0 || { hours: 0, price: 0 };
  const prodHours = hoursTyp - s0.hours;
  const prodPrice = priceRaw - s0.price;
  const disc = PRICING.volume.find(([h]) => prodHours >= h)?.[1] || 0;
  const round = (x) => Math.round(x / PRICING.roundTo) * PRICING.roundTo;
  const projectPrice = round(prodPrice * (1 - disc));
  const avgRate = prodPrice / Math.max(prodHours, 1);

  const weeks = Math.ceil(prodHours / PRICING.hoursPerWeek) + PRICING.clientWaitWeeks
    + (b.accounting === '1c' ? 1 : 0) + (b.migration ? 1 : 0);

  return {
    brief: b, quantities: q, lines, byStage, coefficients: coefs,
    hours: { typ: r1(hoursTyp), min: r1(hoursMin), max: r1(hoursMax), production: r1(prodHours), diagnostics: r1(s0.hours) },
    price: {
      diagnostics: PRICING.diagnosticsPrice,
      production: projectPrice,
      productionMin: round(hoursMinProd(lines, kProd) * avgRate * (1 - disc)),
      productionMax: round(hoursMaxProd(lines) * avgRate * (1 - disc)),
      volumeDiscount: disc,
      prepay: round(projectPrice * 0.5),
    },
    weeks,
    package: pkg,
  };
}

function hoursMinProd(lines) { return lines.filter((l) => l.stage !== 'S0').reduce((s, l) => s + l.hMin, 0); }
function hoursMaxProd(lines) { return lines.filter((l) => l.stage !== 'S0').reduce((s, l) => s + l.hMax, 0); }

const rub = (x) => `${Math.round(x).toLocaleString('ru-RU')} ₽`;
const PKG = { P: 'Пилот', S: 'Старт', M: 'Маркетплейс + сайт', L: 'Магазин с учётом' };

export function toMarkdown(e, title = 'Смета') {
  const out = [];
  out.push(`# ${title}`, '');
  out.push(`Ближайший пакет: **${PKG[e.package]}**. Срок: **${e.weeks} нед.** с момента получения материалов.`, '');
  out.push('| | |', '|---|---|');
  out.push(`| Этап 0 — диагностика и план | ${rub(e.price.diagnostics)} (засчитывается в проект) |`);
  out.push(`| Производство, типовая оценка | **${rub(e.price.production)}** — ${e.hours.production} ч |`);
  out.push(`| Коридор (по сложности работ) | ${rub(e.price.productionMin)} – ${rub(e.price.productionMax)} |`);
  if (e.price.volumeDiscount) out.push(`| Скидка за объём | ${e.price.volumeDiscount * 100}% (уже учтена) |`);
  out.push(`| Предоплата 50% | ${rub(e.price.prepay)} |`, '');
  if (e.coefficients.length) {
    out.push('Коэффициенты: ' + e.coefficients.map(([t, k]) => `${t} ×${k.toFixed(2)}`).join('; ') + '.', '');
  }
  out.push('| Этап | Часы | Стоимость |', '|---|---:|---:|');
  for (const [s, v] of Object.entries(e.byStage)) out.push(`| ${STAGES[s]} | ${r1(v.hours)} | ${rub(v.price)} |`);
  out.push('', '<details><summary>Все работы</summary>', '', '| ID | Работа | Кол-во | Часы | Кто |', '|---|---|---:|---:|---|');
  for (const l of e.lines) out.push(`| ${l.id} | ${l.task}: ${l.sub} | ${l.unit ? l.units : ''} | ${r1(l.hTyp)} | ${l.role} |`);
  out.push('', '</details>', '');
  out.push('Не входит в смету: подписка InSales и приложений, платный шаблон, комиссии оплаты и доставки, реклама, работы 1С-программиста на стороне клиента.');
  return out.join('\n');
}

export function catalogCsv() {
  const cols = ['id', 'этап', 'задача', 'подзадача', 'когда нужна', 'вход', 'результат', 'часы база', 'часы на ед.', 'единица', 'сложность', 'тариф', 'кто', 'пакеты', 'риски'];
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const rows = WORKS.map((w) => [w.id, STAGES[w.stage], w.task, w.sub, w.when, w.input, w.output, w.h ?? 0, w.per ?? '', w.unit ?? '', w.lvl, w.tier, w.role, w.pkg, w.risks]);
  return [cols, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

// CLI
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes('--csv')) {
    process.stdout.write(catalogCsv() + '\n');
  } else if (args[0]) {
    const path = resolve(process.cwd(), args[0]);
    const brief = JSON.parse(readFileSync(path, 'utf8'));
    const { title, ...raw } = brief;
    const e = estimate(raw);
    if (args.includes('--json')) {
      const { lines, ...rest } = e;
      process.stdout.write(JSON.stringify({ ...rest, lines: lines.map(({ on, ...l }) => l) }, null, 2) + '\n');
    } else {
      process.stdout.write(toMarkdown(e, title || 'Смета') + '\n');
    }
  } else {
    console.log('Использование: node calc.mjs <бриф.json> [--json] | --csv');
    console.log('Примеры брифов: ' + resolve(dirname(fileURLToPath(import.meta.url)), 'briefs'));
  }
}
