// Калькулятор услуги «Магазин на шаблоне InSales».
// Ответы брифа (JSON) → набор работ из works.csv → часы → стоимость с коридором.
// Запуск: node docs/insales-start/calc.mjs docs/insales-start/examples/start.json [--md]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// Ставки за чистый час исполнителя (₽). Менеджер и тестировщик входят в ставку — так устроен прайс агентства.
export const RATES = {
  NC: 2400, // ноукод-специалист InSales (команда «Амиго»)
  DEV: 3500, // разработчик InSales (команда «Шанхай»)
  DS: 2400, // дизайнер
  AN: 2400, // аналитика и SEO
  CO: 1500, // контент-оператор — ПРЕДЛОЖЕНИЕ, ставку утверждает владелец
  PR: 2400, // диагностика — продаётся фиксом, см. DIAGNOSTICS_PRICE
};
export const DIAGNOSTICS_PRICE = 15000; // этап 0, засчитывается в проект при старте в течение 30 дней
const MIN_PROJECT = 60000; // ниже не берём: не окупается запуск команды

// Коридор по сложности работы: оптимистичная и пессимистичная оценка от нормы.
const SPREAD = { 1: [0.85, 1.2], 2: [0.8, 1.4], 3: [0.75, 1.7] };
// Скидки пакетов часов из правил агентства.
const PACKS = [[160, 0.2], [120, 0.15], [80, 0.1], [40, 0.05]];

export function loadWorks() {
  const [head, ...rows] = readFileSync(join(here, 'works.csv'), 'utf8').trim().split('\n');
  const keys = head.split(';');
  return Object.fromEntries(
    rows.map((r) => {
      const o = Object.fromEntries(r.split(';').map((v, i) => [keys[i], v]));
      return [o.id, o];
    }),
  );
}

const per = (n, size) => Math.ceil(Math.max(0, n) / size);

// Правила: ответ брифа → {id работы: количество единиц}. Для «проект» — 1.
export function scope(a) {
  const s = {};
  const add = (id, units = 1) => (s[id] = (s[id] || 0) + units);
  const sku100 = per(a.sku, 100);

  // Обязательное ядро
  ['P01', 'P02', 'P03', 'P04', 'P06', 'T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'C12', 'L01', 'L02', 'L03',
    'DL1', 'A01', 'A02', 'A03', 'A04', 'Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06'].forEach((id) => add(id));
  add('C01', Math.max(0, per(a.categories, 10) - 2)); // база 20 категорий, сверх — за каждые 10
  add('C02', per(a.categories, 10));
  add('C03', Math.max(0, per(a.properties, 5) - 2));
  if (a.variants) add('C04');
  if (a.sizes_table) add('C13');

  // Каталог: источник
  const src = { mp: 'C06', table: 'C05', yml: 'C07', old_site: 'C07' }[a.source];
  if (src) {
    add(src, sku100);
    add('C11', sku100);
  } else add('C08', a.sku); // ручное заведение
  if (a.photos_to_process) add('C09', per(a.photos_to_process, 10));
  if (a.descriptions) add('C10', a.descriptions);

  // Дизайн и шаблон
  if (a.banners) add('T07', a.banners);
  if (a.design === 'figma') add('T11');
  if (a.mods_small) add('T08', a.mods_small);
  if (a.mods_medium) add('T09', a.mods_medium);
  if (a.mods_large) add('T10', a.mods_large);
  if (a.extra_pages) add('L04', a.extra_pages);
  if (a.blog) add('L05');
  if (a.domain_mail) add('P05');

  // Оплата и доставка
  if (a.online_payment !== false) {
    add('PAY1');
    add('PAY2');
  }
  if (a.extra_payments) add('PAY3', a.extra_payments);
  if (a.delivery_services) add('DL2', a.delivery_services);
  if (a.aggregator) add('DL3');
  if (a.delivery_services && a.weights_needed) add('DL4', sku100);

  // Учёт
  if (a.accounting === '1c') {
    ['I101', 'I102', 'I103', 'I104', 'I106'].forEach((id) => add(id));
    if (a.c1_customers) add('I105');
  }
  if (a.accounting === 'moysklad') {
    add('IMS1', sku100);
    ['IMS2', 'IMS3', 'IMS4'].forEach((id) => add(id));
  }

  // Маркетплейсы
  if (a.marketplaces > 0) {
    add('IMP1');
    add('IMP2', sku100);
    add('IMP3');
    if (a.marketplaces > 1) add('IMP4', a.marketplaces - 1);
  }

  // Прочие интеграции
  if (a.crm) ['ICR1', 'ICR2', 'ICR3'].forEach((id) => add(id));
  if (a.chat) add('ITL1');
  if (a.telephony) add('ITL2');
  if (a.email) add('IEM1');
  if (a.loyalty) add('ILO1');

  // Переезд
  if (a.migration) {
    add('M01');
    if (a.urls) {
      add('M02', per(a.urls, 100));
      add('M04');
    }
    if (a.migrate_customers) add('M03');
  }

  // Маркетинг
  if (a.seo_ext) add('A05');
  if (a.pixels) add('A06', a.pixels);
  if (a.dashboard) add('A07');
  return s;
}

export function estimate(a, works = loadWorks()) {
  const lines = [];
  for (const [id, units] of Object.entries(scope(a))) {
    const w = works[id];
    if (!w) throw new Error(`Нет работы ${id} в works.csv`);
    const hours = w.единица === 'проект' ? Number(w.база_ч) : Number(w.база_ч) + Number(w.за_ед_ч) * units;
    if (hours <= 0) continue;
    const [lo, hi] = SPREAD[w.сложность] || SPREAD[2];
    lines.push({ id, модуль: w.модуль, задача: w.задача, роль: w.роль, units, hours, lo: hours * lo, hi: hours * hi, rate: RATES[w.роль] });
  }

  // Коэффициенты проекта
  const k = [];
  if (a.materials_ready === 'partial') k.push(['материалы готовы частично', 1.1]);
  if (a.materials_ready === 'no') k.push(['материалов нет, собираем вместе', 1.2]);
  if (a.urgent) k.push(['срочный запуск (меньше 3 недель)', 1.25]);
  if (a.decision_makers > 1) k.push(['несколько согласующих', 1.1]);
  const K = k.reduce((m, [, v]) => m * v, 1);

  const sum = (f) => lines.reduce((t, l) => t + f(l), 0);
  const hours = sum((l) => l.hours) * K;
  const hoursLo = sum((l) => l.lo) * K;
  const hoursHi = sum((l) => l.hi) * K;
  const raw = sum((l) => l.hours * l.rate) * K;
  const discount = (PACKS.find(([h]) => hours >= h) || [0, 0])[1];
  const price = Math.max(MIN_PROJECT, roundTo(raw * (1 - discount), 1000));

  // Сроки: 4 чистых часа исполнителя в день + ожидания (банк, материалы клиента).
  const workDays = Math.ceil(hours / 4);
  const waitDays = (a.online_payment !== false ? 5 : 0) + (a.accounting === '1c' ? 5 : 0) + (a.materials_ready === 'no' ? 5 : 0);
  const weeks = Math.ceil((workDays + waitDays) / 5);

  return {
    lines, k, K, hours, hoursLo, hoursHi, discount, price,
    corridor: [roundTo(price * 0.7, 1000), roundTo(price * 1.3, 1000)],
    weeks,
    level: level(a, hours),
    thirdParty: thirdParty(a),
  };
}

// Уровень проекта — для квалификации и выбора пакета
function level(a, hours) {
  if (a.accounting === '1c' || a.migration || a.crm || a.mods_large) return 'Бизнес';
  if (a.marketplaces > 0 || a.accounting === 'moysklad' || a.sku > 150 || hours > 60) return 'Селлер';
  return 'Старт';
}

// Расходы клиента вне нашей сметы — показываем всегда, это снимает страх «скрытых платежей».
function thirdParty(a) {
  const t = [['Тариф InSales', a.marketplaces > 0 ? 'от 5 610 ₽/мес (тариф с каналами МП, сверить в день сметы)' : 'от 2 295 ₽/мес (сверить в день сметы)']];
  if (a.theme === 'paid') t.push(['Платная тема', '15–25 тыс. ₽ разово']);
  if (a.online_payment !== false) t.push(['Эквайринг и онлайн-касса', 'комиссия банка с оборота + касса/ОФД по тарифу провайдера']);
  if (a.delivery_services) t.push(['Доставка', 'по договорам со службами']);
  if (a.accounting === 'moysklad') t.push(['МойСклад', 'тариф МойСклад']);
  if (a.accounting === '1c') t.push(['Специалист 1С клиента', 'время на настройку обмена с их стороны']);
  t.push(['Домен', 'около 1 000 ₽/год, если нового нет']);
  return t;
}

const roundTo = (n, step) => Math.round(n / step) * step;
const rub = (n) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;
const h = (n) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

export function toMarkdown(a, e) {
  const out = [];
  out.push(`# Смета: ${a.name || 'проект'}`, '');
  out.push(`Уровень: **${e.level}**. Часы: **${h(e.hours)}** (коридор ${h(e.hoursLo)}–${h(e.hoursHi)}). Срок: **${e.weeks} нед.**`, '');
  out.push(`Стоимость работ: **${rub(e.price)}**${e.discount ? ` (скидка пакета ${e.discount * 100}%)` : ''}. Фикс с коридором ±30%: ${rub(e.corridor[0])}–${rub(e.corridor[1])}.`, '');
  out.push(`Этап 0 «План магазина» — ${rub(DIAGNOSTICS_PRICE)}, засчитывается в стоимость при старте в течение 30 дней.`, '');
  if (e.k.length) out.push('Коэффициенты: ' + e.k.map(([n, v]) => `${n} ×${v}`).join(', ') + '.', '');
  out.push('| Модуль | Работа | Ед. | Часы | Роль | Сумма |', '|---|---|---:|---:|---|---:|');
  for (const l of e.lines) out.push(`| ${l.модуль} | ${l.id} ${l.задача} | ${l.units} | ${h(l.hours)} | ${l.роль} | ${rub(l.hours * l.rate)} |`);
  out.push('', 'Итог = сумма строк × коэффициенты − скидка пакета, округление до 1 000 ₽, не меньше ' + rub(MIN_PROJECT) + '.');
  out.push('', '**Расходы клиента вне сметы**', '');
  for (const [n, v] of e.thirdParty) out.push(`- ${n}: ${v}`);
  return out.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('Укажите JSON с ответами брифа');
    process.exit(1);
  }
  const a = JSON.parse(readFileSync(file, 'utf8'));
  const e = estimate(a);
  if (process.argv.includes('--md')) console.log(toMarkdown(a, e));
  else console.log(`${a.name}: ${e.level}, ${h(e.hours)} ч, ${rub(e.price)} (${rub(e.corridor[0])}–${rub(e.corridor[1])}), ${e.weeks} нед.`);
}
