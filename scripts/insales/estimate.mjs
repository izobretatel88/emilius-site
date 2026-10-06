// Смета проекта по брифу. Запуск:
//   node scripts/insales/estimate.mjs scripts/insales/examples/seller.json
// Без аргумента считает три пакета.
import { readFileSync } from 'node:fs';
import { WORKS, RATES, PACKAGES, BLOCKS } from './works.mjs';

const byId = Object.fromEntries(WORKS.map((w) => [w.id, w]));

// Скидки за объём — из «Введения в бизнес-процесс Emilius» (пакеты часов).
export const PACKAGE_DISCOUNT = 0.1;
const VOLUME_DISCOUNT = [[160, 0.2], [120, 0.15], [80, 0.1], [40, 0.05]];

// Коэффициенты неопределённости. Применяются к часам, а не к цене:
// так их видно в смете и они честно попадают в правило «ФИКС ±30%».
export const COEF = {
  materials: { ready: 1, partial: 1.15, none: 1.3 }, // готовность фото, текстов, таблицы товаров
  dirtyData: { clean: 1, some: 1.2, messy: 1.4 }, // только к блоку «Каталог»
  urgent: { no: 1, yes: 1.25 }, // запуск быстрее 2 недель
  deciders: { one: 1, many: 1.1 }, // больше одного человека согласует
};

export function hoursOf(w, brief) {
  if (!w.per) return w.h;
  const [driver, size, perH] = w.per;
  const n = Number(brief[driver] || 0);
  const steps = Math.ceil(n / size);
  if (w.scale) return steps * perH;
  return w.h + steps * perH;
}

// Бриф → список работ. Правила здесь — та же логика, что в анкете (04-otsenka.md).
export function selectWorks(b) {
  // Маленький каталог без интеграций собирается от «Экспресса», остальное — от «Старта».
  const lite = (b.sku || 0) <= 50 && !b.accounting && !b.mp && !b.crm;
  const ids = new Set(lite ? PACKAGES.express.works : PACKAGES.start.works);
  const add = (...xs) => xs.forEach((x) => ids.add(x));
  const del = (...xs) => xs.forEach((x) => ids.delete(x));

  if (b.hasChannels && !lite) add('D02');
  if (!lite) add('D03');
  // источник товаров
  del('C04', 'C05');
  if (b.source === 'file') add('C04', 'C05');
  if (b.source === 'mp') add('C06');
  if (b.source === 'site') add('C07');
  if (b.source === 'none') add('C08');
  if (b.source === '1c') { /* товары придут из 1С — I1C2 */ }
  if (b.variants > 0 && (b.source === 'mp')) add('C10');
  if (!b.variants) del('C03');
  if (b.photos > 0) add('C11');
  if (b.texts > 0) add('C12');
  // витрина
  if (b.banners) add('T05');
  if (b.mockups) add('T09');
  if (b.mockupScreens > 0) for (let i = 0; i < b.mockupScreens; i++) add('M06');
  if (!b.logo) add('T10');
  (b.mods || []).forEach((m) => add(m));
  // оплата, доставка
  if (b.payExtra > 0) add('PAY2');
  if (b.courier) add('DLV2');
  if (b.dlvExtra > 0) add('DLV5');
  if (!b.pickups) del('DLV1');
  if (b.pages > 0) add('L06');
  // учёт и каналы
  if (b.accounting === '1c') { add('I1C1', 'I1C2', 'I1C3', 'I1C5'); if (b.ordersToAccounting) add('I1C4'); }
  if (b.accounting === 'moysklad') add('IMS1', 'IMS2', 'IMS3');
  if (b.mp > 0) add('IMP1', 'IMP2', 'IMP3');
  if (b.crm) add('CRM1', 'CRM2');
  if (b.telephony) add('CRM4');
  // продвижение
  if (b.seo === 'basic' || b.seo === 'core') add('S02');
  if (b.seo === 'core') add('S03');
  if (b.catTexts > 0) add('S05');
  if (b.urls > 0) add('S04');
  if (b.offline) add('S06');
  if (b.domainMail) add('P04');
  if (b.utm) add('A05');
  if (b.vk) add('A06');
  if (b.feed) add('MKT1');
  if (b.bonuses) add('MKT2');
  if (b.email) add('MKT3', 'MKT4');
  if (b.insert) add('MKT5');
  return [...ids];
}

export function estimate(brief, ids = selectWorks(brief)) {
  const k = brief.k || {};
  const kAll = (COEF.materials[k.materials || 'ready']) * (COEF.urgent[k.urgent || 'no']) * (COEF.deciders[k.deciders || 'one']);
  const kCat = COEF.dirtyData[k.dirtyData || 'clean'];

  const lines = [];
  for (const id of ids) {
    const w = byId[id];
    if (!w) throw new Error(`Нет работы ${id}`);
    if (w.pct) continue;
    // M06 может повторяться — считаем количество
    const qty = id === 'M06' ? Math.max(1, brief.mockupScreens || 1) : 1;
    let h = hoursOf(w, brief) * qty * kAll * (w.block === 'C' ? kCat : 1);
    if (h > 0) lines.push({ ...w, qty, hours: round2(h) });
  }
  for (const id of ids) {
    const w = byId[id];
    if (w.pct) {
      const base = lines.filter((l) => l.role === 'NC').reduce((s, l) => s + l.hours, 0);
      lines.push({ ...w, qty: 1, hours: round2(base * w.pct) });
    }
  }
  lines.forEach((l) => (l.cost = Math.round(l.hours * RATES[l.role].rate)));

  const hours = round2(lines.reduce((s, l) => s + l.hours, 0));
  const gross = lines.reduce((s, l) => s + l.cost, 0);
  const disc = (VOLUME_DISCOUNT.find(([h]) => hours >= h) || [0, 0])[1];
  const total = Math.round((gross * (1 - disc)) / 100) * 100;

  const byRole = {};
  lines.forEach((l) => (byRole[l.role] = round2((byRole[l.role] || 0) + l.hours)));

  // Срок: 20 продуктивных часов исполнителя в неделю (4 ч/день), роли работают
  // параллельно; плюс ожидание клиента: эквайринг 1 нед. перекрывается сборкой.
  const critical = Math.max(...Object.values(byRole));
  const weeks = Math.max(2, Math.ceil(critical / 20) + 1);

  return { lines, hours, gross, disc, total, byRole, weeks, kAll: round2(kAll), kCat };
}

const round2 = (x) => Math.round(x * 100) / 100;

export function packagePrice(key) {
  const p = PACKAGES[key];
  const e = estimate(p.brief, p.works);
  // Пакет — повторяемая работа по чек-листам, поэтому вместо скидки за объём
  // действует пакетная скидка 10%. Цена округляется вверх до тысячи — это цена «ФИКС».
  const packed = Math.round(e.gross * (1 - PACKAGE_DISCOUNT));
  return { ...e, disc: PACKAGE_DISCOUNT, total: packed, price: Math.ceil(packed / 1000) * 1000 };
}

function printEstimate(title, e) {
  const fmt = (n) => n.toLocaleString('ru-RU');
  console.log(`\n## ${title}\n`);
  let block = '';
  for (const l of e.lines.sort((a, b) => Object.keys(BLOCKS).indexOf(a.block) - Object.keys(BLOCKS).indexOf(b.block))) {
    if (l.block !== block) { block = l.block; console.log(`\n${BLOCKS[block]}`); }
    console.log(`  ${l.id.padEnd(5)} ${l.name.padEnd(58).slice(0, 58)} ${String(l.hours).padStart(6)} ч  ${l.role.padEnd(3)} ${fmt(l.cost).padStart(8)} ₽`);
  }
  console.log(`\nЧасы: ${e.hours} (${Object.entries(e.byRole).map(([r, h]) => `${r} ${h}`).join(', ')})`);
  console.log(`Коэффициенты: общий ×${e.kAll}, каталог ×${e.kCat}`);
  console.log(`Без скидки: ${fmt(e.gross)} ₽, скидка ${e.disc * 100}%, итого: ${fmt(e.total)} ₽`);
  console.log(`Срок: ~${e.weeks} нед.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (file) {
    const brief = JSON.parse(readFileSync(file, 'utf8'));
    printEstimate(brief.title || file, estimate(brief));
  } else {
    for (const key of Object.keys(PACKAGES)) {
      const e = packagePrice(key);
      printEstimate(`Пакет «${PACKAGES[key].name}» — ${e.price.toLocaleString('ru-RU')} ₽`, e);
    }
  }
}
