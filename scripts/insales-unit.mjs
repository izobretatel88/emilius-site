// Экономика услуги для агентства: что остаётся с проекта, сколько можно платить за клиента и сколько контактов нужно на план.
//   node scripts/insales-unit.mjs                       — 5 типовых сценариев + пределы по каналам + обратная воронка на план
//   node scripts/insales-unit.mjs --plan 600000         — план выручки в месяц, ₽ (по умолчанию 500 000)
//   node scripts/insales-unit.mjs --letters 20         — сколько холодных писем в рабочий день уже в плане (08-lead-gen.md §6)
//   node scripts/insales-unit.mjs --pay 0.5 --overrun 1.3 --keep 0.2 --mgr 1000
// --pay      доля ставки клиента, которую получает исполнитель (по умолчанию 0,55 — гипотеза, заменить фактом выплат)
// --overrun  факт/смета по часам (1 — нормы v2 откалиброваны; 1,3 — верх коридора ФИКС, худший случай)
// --keep     доля цены проекта, которая должна остаться агентству после исполнителей, продаж и привлечения (0,2)
// --mgr      стоимость часа менеджера продаж, ₽ (1 000)
// Пороги конверсий — из 08-lead-gen.md §6 и 10-sales.md §5, это гипотезы v1. После 8 недель теста — заменить фактом.
import { readFileSync } from 'node:fs';
import { estimate, parseCatalog, RATES } from '../docs/insales-service/calc/estimate.js';
import { SCENARIOS } from './insales-calc.mjs';

const a = Object.fromEntries(process.argv.slice(2).reduce((r, x, i, arr) => (x.startsWith('--') ? [...r, [x.slice(2), Number(arr[i + 1])]] : r), []));
const letters = a.letters ?? 20;
const pay = a.pay ?? 0.55, overrun = a.overrun ?? 1, keep = a.keep ?? 0.2, mgr = a.mgr ?? 1000, plan = a.plan ?? 500000;
const catalog = parseCatalog(readFileSync(new URL('../docs/insales-service/03-catalog.csv', import.meta.url), 'utf8'));
const rub = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
const pct = (x) => Math.round(x * 100) + '%';

// Время менеджера на один оплаченный проект: квалификация 15 мин на каждый квалифицированный лид,
// диагностика 1,5 ч (ORG-01) и смета/КП 1 ч на каждую диагностику. Диагностика оплачена клиентом (5 000 ₽)
// и засчитывается в проект — у тех, кто не купил, она остаётся агентству.
const DIAG_FEE = 5000, QUAL_TO_DIAG = 0.4, DIAG_TO_DEAL = 0.35;
const diagPerDeal = 1 / DIAG_TO_DEAL, qualPerDeal = diagPerDeal / QUAL_TO_DIAG;
const salesHours = qualPerDeal * 0.25 + diagPerDeal * 2.5;
const salesCost = salesHours * mgr - (diagPerDeal - 1) * DIAG_FEE;

// Абонемент после запуска (12-retention.md): цель — 1 из 2 магазинов на «Рабочем» (22 000 ₽, 10 ч);
// средний срок 6 месяцев — гипотеза. Считаем отдельно: в предел привлечения не закладываем, это запас.
const ABON = { price: 22000, months: 6, share: 0.5 };
const abonMargin = ABON.price * (1 - pay) * ABON.months * ABON.share;

const rows = Object.entries(SCENARIOS).map(([title, brief]) => {
  const e = estimate(brief, catalog);
  // Себестоимость: часы по ролям × ставка роли × доля исполнителя × перерасход.
  const exec = e.lines.reduce((s, l) => s + l.hours * RATES[l.role], 0) * e.kTotal * pay * overrun;
  const gross = e.price - exec;
  const sales = Math.max(0, salesCost);
  const cacMax = gross - sales - keep * e.price;
  // Запас по перерасходу: во сколько раз факт может превысить смету, пока агентству остаётся keep без затрат на привлечение.
  const margin = (e.price * (1 - keep) - sales) / (exec / overrun);
  return { title, e, exec, gross, cacMax, margin };
});

console.log(`Допущения: исполнителю ${pct(pay)} ставки · факт/смета ×${overrun} · агентству остаётся не меньше ${pct(keep)} цены · час менеджера ${rub(mgr)}`);
console.log(`Продажи на 1 проект: ${qualPerDeal.toFixed(1).replace('.', ',')} квал. лида → ${diagPerDeal.toFixed(1).replace('.', ',')} диагностики → ${salesHours.toFixed(1).replace('.', ',')} ч менеджера = ${salesCost > 0 ? rub(salesCost) : '≈0 ₽: оплаченные диагностики тех, кто не купил, покрывают это время'}\n`);
for (const r of rows) {
  console.log(`${r.title}
  цена ${rub(r.e.price)} · ${r.e.hours} ч · исполнители ${rub(r.exec)} · валовая маржа ${rub(r.gross)} (${pct(r.gross / r.e.price)})
  можно потратить на привлечение одного клиента: ${r.cacMax > 0 ? rub(r.cacMax) : 'нечего — проект в минус при этих допущениях'}
  запас по перерасходу часов: до ×${r.margin.toFixed(2).replace('.', ',')} от сметы, дальше агентству меньше ${pct(keep)}`);
}
console.log(`\nАбонемент сверху (не закладываем в привлечение): ~${rub(abonMargin)} маржи на запущенный магазин`);

// Пределы по каналам — от типового проекта (медиана цены сценариев без 1С: крупный проект редок и задирает среднее).
const typical = [...rows].filter((r) => !/1С/.test(r.title)).sort((x, y) => x.e.price - y.e.price);
const mid = typical[Math.floor(typical.length / 2)];
const cac = mid.cacMax;
// Конверсия единицы канала в оплаченный проект. Гипотезы v1:
//  заявка с лендинга (Директ, карточка партнёра) — квалифицированная в 50% случаев → дальше общая воронка;
//  отклик на бирже — 1 из 4 отвечает, половина квалифицирована;
//  холодное письмо — 5% ответов, 40% ответивших квалифицированы (08-lead-gen.md §6: 800 писем → 5 проектов).
const dealPerQual = QUAL_TO_DIAG * DIAG_TO_DEAL;
const CHANNELS = [
  { name: 'Заявка из Директа', unit: 'заявку', conv: 0.5 * dealPerQual, note: 'стоп-правило теста 30 тыс. ₽ — ниже' },
  { name: 'Заявка из карточки партнёра InSales', unit: 'заявку', conv: 0.6 * dealPerQual, note: 'платим временем, денег нет' },
  { name: 'Отклик на бирже', unit: 'отклик', conv: 0.25 * 0.5 * dealPerQual, note: 'платный отклик + 15 мин менеджера' },
  { name: 'Холодное письмо A1/A2/D', unit: 'письмо', conv: 0.05 * 0.4 * dealPerQual, note: '≈3 мин менеджера на письмо с поводом' },
];
console.log(`\nПределы по каналам — от типового проекта «${mid.title}» (${rub(mid.e.price)}, на привлечение ${rub(cac)}):`);
for (const c of CHANNELS) {
  const max = cac * c.conv;
  console.log(`  ${c.name.padEnd(36)} 1 проект из ${Math.round(1 / c.conv)} · платить не больше ${rub(max)} за ${c.unit}  (${c.note})`);
}
const cplMax = cac * CHANNELS[0].conv;
console.log(`\nДирект, тест 30 000 ₽: после 15 000 ₽ — если заявка дороже ${rub(cplMax)}, остановить и переписать объявления; ` +
  `если дешевле ${rub(cplMax * 0.6)} — довести до 30 000 ₽ и считать проекты, а не заявки.`);

// Обратная воронка: от плана выручки к числу контактов и к загрузке сборщиков.
const avg = mid.e.price, deals = plan / avg, hours = deals * mid.e.hours * overrun;
const diag = deals * diagPerDeal, qual = diag / QUAL_TO_DIAG;
console.log(`\nПлан ${rub(plan)} в месяц при типовом проекте ${rub(avg)}:
  ${deals.toFixed(1).replace('.', ',')} проекта → ${Math.ceil(diag)} диагностик → ${Math.ceil(qual)} квалифицированных лидов
  только письмами: ${Math.ceil(qual / (0.05 * 0.4))} писем в месяц (${Math.ceil(qual / (0.05 * 0.4) / 21)} в рабочий день)
  только заявками с сайта: ${Math.ceil(qual / 0.5)} заявок
  смесь: ${letters} писем в день дают ${(letters * 21 * 0.05 * 0.4).toFixed(1).replace('.', ',')} квал. лида → ${(letters * 21 * 0.05 * 0.4 * dealPerQual).toFixed(1).replace('.', ',')} проекта; остальное — ${Math.max(0, Math.ceil((qual - letters * 21 * 0.05 * 0.4) / 0.5))} заявок с сайта, карточки партнёра и бирж
  производство: ${Math.round(hours)} ч по смете → ${(hours / 110).toFixed(1).replace('.', ',')} сборщика при ~110 ч в месяц (templates/onboarding.md)`);
