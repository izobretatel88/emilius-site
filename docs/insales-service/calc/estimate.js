// Калькулятор услуги «Магазин на шаблоне InSales».
// Чистые функции без зависимостей: работают и в Node (scripts/insales-calc.mjs), и в браузере (calculator.html).
// Источник норм — 03-catalog.csv. Здесь только правила «ответ брифа → работы» и формула цены.

export const RATES = {
  NC: 2400,  // ноукод-сборщик InSales (прайс агентства)
  CNT: 1500, // контент-менеджер — новая роль, решение владельца (см. 04-estimation.md)
  DSN: 2400, // дизайнер
  SEO: 2400, // SEO-специалист
  INT: 3000, // интегратор (прайс: интеграции 3000 ₽/ч)
  DEV: 3500, // разработчик Liquid
  QA: 2400,  // тестовые заказы выполняет сборщик; внутреннее QA агентства не тарифицируется
};

// Скидки за объём из «Введения в бизнес-процесс Emilius» (пакеты часов).
export const VOLUME_DISCOUNTS = [
  [160, 0.2], [120, 0.15], [80, 0.1], [40, 0.05],
];

export const PACKAGES = {
  // min — публичная цена «от»: смета ниже неё не опускается (решение 06.10.2026, 04-estimation.md §5).
  S: { name: 'Старт', min: 75000, note: 'до 50 товаров вручную, 1 оплата, самовывоз/курьер + 1 служба доставки' },
  M: { name: 'Магазин', min: 95000, note: 'импорт каталога, фильтры и варианты, 2 службы доставки, e-commerce аналитика' },
  P: { name: 'Селлер', min: 100000, note: 'всё из «Магазина» + карточки с WB/Ozon и единые остатки сайт ↔ площадки' },
};

// Значения брифа по умолчанию — типичный «Старт».
export const DEFAULT_BRIEF = {
  segment: 'seller',       // seller | social | offline | oldsite | new
  sku: 30,                 // число товаров на старте
  categories: 8,
  variants: false,         // есть размеры/цвета с разными остатками
  apparel: false,          // одежда/обувь → размерные сетки
  source: 'manual',        // manual | excel | marketplace | 1c | moysklad | oldsite
  dataQuality: 'ok',       // good | ok | bad
  photos: 'ready',         // ready | mixed (нужна обработка)
  descriptions: 'have',    // have | write
  payments: 1,             // число платёжных сервисов
  extraPayments: 0,        // счёт юрлицам, долями, сплит
  pickupCourier: 1,        // самовывоз/курьер: число способов
  carriers: 1,             // СДЭК, Почта, Boxberry, Яндекс
  marketplaces: 0,         // сколько площадок связать (WB, Ozon, ЯМ)
  pushCardsToMp: 0,        // сколько сотен карточек выгрузить с сайта на площадки
  accounting: 'none',      // none | 1c | moysklad
  ordersToAccounting: false,
  crm: false,
  telephony: false,
  oldSiteUrls: 0,          // URL со старого сайта, которые надо сохранить в поиске
  migrateCustomers: false,
  seo: 'basic',            // basic | semantic
  seoClusters: 0,
  seoTexts: 0,             // тексты категорий
  offlinePoints: 0,
  directFeed: false,
  vkAds: false,
  email: false,
  extraPages: 0,
  blogPosts: 0,
  homeBlocks: 6,
  banners: 0,
  customBlocks: 0,         // блоков вне шаблона (макет + код)
  smallEdits: 0,           // мелких правок кодом
  customFeatures: 0,       // нестандартных функций
  staff: 1,
  mailOnDomain: false,
  rknNotice: false,
  clientPace: 'normal',    // fast | normal | slow
  urgent: false,           // запуск быстрее 2 недель
};

// Бриф → список работ { id, qty }.
export function briefToWorks(b) {
  const w = [];
  const add = (id, qty = 1) => { if (qty > 0) w.push({ id, qty }); };
  const hundreds = (n) => Math.max(1, Math.ceil(n / 100));
  const big = b.sku > 50;

  // Ядро — есть в любом проекте.
  ['ORG-02', 'ORG-03', 'PLT-01', 'DSN-01', 'DSN-02', 'DSN-03', 'DSN-06', 'CAT-04', 'CAT-06',
   'PAY-02', 'LEG-01', 'LEG-02', 'NTF-01', 'ANL-01', 'SEO-01', 'CRM-03', 'QA-01', 'LCH-01', 'LCH-02', 'SUP-01']
    .forEach((id) => add(id));
  add('PLT-02', 1);
  add('DSN-04', b.homeBlocks);
  add('CAT-01', b.categories);
  add('PAY-01', b.payments);
  add('DLV-01', b.pickupCourier);
  add('DLV-02', b.carriers);
  add('PAG-01', big ? 5 : 4);

  if (big || b.variants) add('CAT-02', 5);
  if (b.variants) add('CAT-03');
  if (b.apparel) add('CAT-05', Math.min(b.categories, 4));
  if (b.sku > 100) add('CAT-07');
  if (b.carriers > 0 && (big || b.carriers > 1)) add('DLV-03');
  if (b.carriers >= 3) add('DLV-04');
  if (b.extraPayments) add('PAY-03', b.extraPayments);
  if (big) add('NTF-02');
  if (b.staff > 1) add('PLT-04', b.staff);
  if (b.mailOnDomain) add('PLT-03');
  if (b.rknNotice) add('LEG-03');

  // Каталог: откуда берём товары.
  if (b.source === '1c' || b.source === 'moysklad') {
    // товары придут из учётной системы, см. блок «Учёт»
  } else if (b.source === 'manual' || (b.sku <= 50 && b.source === 'excel')) {
    add('CNT-01', b.sku);
  } else if (b.source === 'marketplace') {
    add('IMP-04', hundreds(b.sku));
  } else if (b.source === 'oldsite') {
    add('MIG-01');
    add('IMP-01'); add('IMP-03', hundreds(b.sku));
  } else if (b.source === 'excel') {
    add('IMP-01'); add('IMP-03', hundreds(b.sku)); add('IMP-05', hundreds(b.sku));
  }
  // 1С и МойСклад сами приносят товары, импорт по файлу не нужен.
  if (b.dataQuality === 'bad' && b.source !== 'manual') add('IMP-02', hundreds(b.sku));
  if (b.photos === 'mixed') add('CNT-02', b.sku * 3);
  if (b.descriptions === 'write') add('CNT-03', b.sku);

  // Учёт.
  if (b.accounting === '1c') {
    add('INT-1C-01'); add('INT-1C-02'); add('INT-1C-03');
    if (b.ordersToAccounting) add('INT-1C-04');
    add('INT-1C-05'); add('QA-02');
  }
  if (b.accounting === 'moysklad') {
    add('INT-MS-01');
    if (b.ordersToAccounting) add('INT-MS-02');
    add('QA-02');
  }

  // Маркетплейсы.
  if (b.marketplaces > 0) {
    add('INT-MP-01', b.marketplaces);
    add('INT-MP-02');
    add('QA-02');
  }
  add('INT-MP-03', b.pushCardsToMp);

  if (b.crm) { add('CRM-01'); add('QA-02'); }
  if (b.telephony) add('CRM-02');
  if (b.email) add('EML-01');

  // Перенос и SEO.
  if (b.migrateCustomers) add('MIG-02');
  if (b.oldSiteUrls > 0) add('SEO-05', hundreds(b.oldSiteUrls));
  if (b.seo === 'semantic') {
    add('SEO-02', b.seoClusters || 50);
    add('SEO-03', b.categories + 5);
  }
  add('CNT-04', b.seoTexts);
  add('SEO-04', b.offlinePoints);
  if (b.directFeed) { add('ANL-02'); add('ANL-04'); }
  else if (big) add('ANL-02');
  if (b.vkAds) add('ANL-03');

  add('PAG-02', b.extraPages);
  if (b.blogPosts) add('PAG-03', b.blogPosts);
  add('DSN-05', b.banners);
  if (b.customBlocks) { add('DSN-07', b.customBlocks); add('MOD-02', b.customBlocks); }
  add('MOD-01', b.smallEdits);
  add('MOD-03', b.customFeatures);

  // QA-02 может прийти от нескольких интеграций — считаем каждую.
  return mergeQa(w);
}

function mergeQa(w) {
  const out = []; let qa = 0;
  for (const x of w) { if (x.id === 'QA-02') qa += x.qty; else out.push(x); }
  if (qa) out.push({ id: 'QA-02', qty: qa });
  return out;
}

export function pickPackage(b) {
  if (b.marketplaces > 0 || b.source === 'marketplace') return 'P';
  if (b.sku > 50 || b.variants || b.carriers > 1 || b.source !== 'manual' || b.accounting !== 'none') return 'M';
  return 'S';
}

// Коэффициенты риска. Применяются к часам, а не к ставке, чтобы смета оставалась прозрачной.
export function coefficients(b) {
  const k = [];
  if (b.clientPace === 'slow') k.push(['Клиент медленно отвечает и собирает материалы', 1.15]);
  if (b.clientPace === 'fast') k.push(['Материалы готовы, один ЛПР на связи', 0.95]);
  if (b.dataQuality === 'bad') k.push(['Грязные данные о товарах', 1.1]);
  if (b.customFeatures > 0 || b.customBlocks > 2) k.push(['Доработки кодом: неопределённость', 1.1]);
  if (b.urgent) k.push(['Срочный запуск быстрее 2 недель', 1.25]);
  return k;
}

// catalog: Map id → { id, module, task, base, per, role, unit, packages }
export function estimate(brief, catalog) {
  const b = { ...DEFAULT_BRIEF, ...brief };
  const works = briefToWorks(b);
  const pkg = pickPackage(b);
  const k = coefficients(b);
  const kTotal = k.reduce((a, [, v]) => a * v, 1);

  const lines = works.map(({ id, qty }) => {
    const c = catalog.get(id);
    if (!c) throw new Error(`Нет работы ${id} в каталоге`);
    const hours = c.base + c.per * qty;
    const inPkg = c.packages.split(',').some((p) => p.trim().startsWith(pkg));
    return { id, module: c.module, task: c.task, qty, unit: c.unit, role: c.role, hours, inPkg,
             cost: hours * RATES[c.role] };
  }).filter((l) => l.hours > 0);

  const rawHours = sum(lines.map((l) => l.hours));
  const hours = rawHours * kTotal;
  const rawCost = sum(lines.map((l) => l.cost)) * kTotal;
  const disc = (VOLUME_DISCOUNTS.find(([h]) => hours >= h) || [0, 0])[1];
  const price = Math.max(PACKAGES[pkg].min, roundTo(rawCost * (1 - disc), 1000));

  // Срок: 4 продуктивных часа в день у исполнителя (норма агентства) + ожидание клиента.
  const workDays = Math.ceil(hours / 4);
  const waitDays = b.clientPace === 'slow' ? 10 : b.clientPace === 'fast' ? 3 : 5;
  const integrations = (b.accounting !== 'none' ? 1 : 0) + (b.marketplaces > 0 ? 1 : 0) + (b.crm ? 1 : 0);
  const calendarDays = workDays + waitDays + integrations * 3;

  return {
    package: pkg, packageName: PACKAGES[pkg].name, lines, coefficients: k, kTotal,
    rawHours: round1(rawHours), hours: round1(hours), discount: disc, price,
    fixCorridor: [Math.max(PACKAGES[pkg].min, roundTo(price * 0.7, 1000)), roundTo(price * 1.3, 1000)],
    calendarDays, weeks: Math.ceil(calendarDays / 5),
    platform: platformCosts(b),
  };
}

// Расходы клиента вне цены работ — показываем отдельно (тарифы InSales на 2026, проверять перед КП).
export function platformCosts(b) {
  const seller = b.marketplaces > 0 || b.source === 'marketplace';
  // Сверка 06.10.2026 (сниппеты insales.ru, сайт закрыт прокси — проверить в браузере перед КП):
  // «Селлер» 4 800 ₽ — только кабинет маркетплейсов, без витрины. Сайт + площадки — «Комбо» 6 600 ₽.
  // Лимит товаров расширяется на любом тарифе: +1 000 товаров за 100 ₽/мес. Базовый лимит
  // «Интернет-магазина» в источниках 1 000 или 5 000 — берём 1 000, чтобы не занизить расходы клиента.
  const base = seller ? { name: 'Комбо', month: 6600 } : { name: 'Интернет-магазин', month: 2700 };
  const extraK = Math.max(0, Math.ceil((b.sku - TARIFF_SKU_LIMIT) / 1000));
  const tariff = { name: base.name + (extraK ? ` + ${extraK} тыс. товаров` : ''), month: base.month + extraK * 100 };
  return {
    tariff,
    year: tariff.month * 12 * 0.85, // скидка 15% при оплате за год
    theme: [0, 25000], // платные темы под нишу 5–25 тыс. ₽, см. templates/theme-shortlist.md
    notes: 'Эквайринг 2–3,5% с оборота, касса/ОФД, доставка, реклама — договоры клиента.'
      + (b.accounting === 'moysklad' ? ' Интеграция МойСклад — InSales: 5 000 ₽/мес на стороне МоегоСклада.' : '')
      + (b.sku > 10000 || b.staff > 2 ? ' Проверить «Профессиональный» 14 800 ₽: больше пользователей и API.' : ''),
  };
}
export const TARIFF_SKU_LIMIT = 1000;

const sum = (a) => a.reduce((x, y) => x + y, 0);
const round1 = (x) => Math.round(x * 10) / 10;
const roundTo = (x, s) => Math.round(x / s) * s;

export function parseCatalog(csvText) {
  const [head, ...rows] = csvText.trim().split(/\r?\n/).map((l) => l.split(';'));
  const ix = Object.fromEntries(head.map((h, i) => [h, i]));
  const m = new Map();
  for (const r of rows) {
    m.set(r[ix.id], {
      id: r[ix.id], module: r[ix['модуль']], task: r[ix['задача']], unit: r[ix['единица']],
      base: parseFloat(r[ix['часы_база']]) || 0, per: parseFloat(r[ix['часы_за_ед']]) || 0,
      role: r[ix['роль']], packages: r[ix['пакеты']],
    });
  }
  return m;
}
