// Недельный разбор листа лидов: кому писать сегодня, воронка по каналам и сегментам, стоимость оплаченного проекта.
//   node scripts/insales-funnel.mjs лиды.csv
//   node scripts/insales-funnel.mjs лиды.csv --today 2026-11-30 --since 2026-10-05
//   node scripts/insales-funnel.mjs лиды.csv --spend директ=15000,биржа=2400
// Лист — в формате docs/insales-service/leads-template.csv (разделитель «;»). Словарь статусов и правила — 10-sales.md §5.
// --today   дата, на которую считать касания (по умолчанию сегодня)
// --since   учитывать в воронке только лиды с «датой» не раньше этой (когорта теста)
// --spend   деньги, потраченные на канал за период, ₽: канал=сумма через запятую. Время менеджера сюда не входит.
import { readFileSync } from 'node:fs';
import { LIMITS } from './insales-unit.mjs';

// Лестница статусов: лид проходит её снизу вверх, в «статусе» пишем самую дальнюю ступень.
// Отказ и пауза пишутся с ступенью, на которой остановились: «отказ: диагностика», «пауза: ответил».
export const STAGES = ['новый', 'написали', 'ответил', 'квалифицирован', 'диагностика', 'смета', 'предоплата', 'запуск', 'первый заказ'];
const CLOSED = ['отказ', 'пауза', 'нет ответа', 'не наш'];

// Ритм касаний после «касания 1» (09-outreach.md «Правила», templates/hot-replies.md): дни от первого касания.
const CADENCE = { cold: [3, 8], hot: [1, 3] };
const HOT = new Set(['биржа', 'партнёры', 'директ', 'сайт', 'рекомендация']);
// Предел за единицу канала — из insales-unit.mjs (порядок CHANNELS там: Директ, партнёры, биржа, письмо).
const UNIT_LIMIT = Object.fromEntries(['директ', 'партнёры', 'биржа', 'письмо'].map((k, i) => [k, LIMITS.cac * LIMITS.channels[i].conv]));

// Пороги-гипотезы v1 (10-sales.md §5, 13-economics.md §1). Сравниваем факт, когда в знаменателе от 10 лидов.
const MIN_N = 10;
const THRESHOLDS = [
  { from: 'написали', to: 'ответил', min: 0.05, label: 'ответ на первое касание', only: 'cold' },
  { from: 'ответил', to: 'квалифицирован', min: 0.4, label: 'квалифицированы из ответивших', only: 'cold' },
  { from: 'квалифицирован', to: 'диагностика', min: 0.4, label: 'квал. лид → диагностика' },
  { from: 'диагностика', to: 'предоплата', min: 0.35, label: 'диагностика → предоплата' },
];

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ';') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const day = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00Z') : null);
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const iso = (d) => d.toISOString().slice(0, 10);

// Канал лида: явная колонка «канал лида»; у строк проспектинга (сегменты A1–E) без неё — «письмо».
export function channelOf(l) {
  const c = (l['канал лида'] || '').toLowerCase();
  if (c) return c;
  return /^(A1|A2|B|C|D|E)$/i.test(l['сегмент']) ? 'письмо' : 'не указан';
}

// Самая дальняя ступень лестницы и закрыт ли лид.
export function stageOf(l) {
  const s = (l['статус'] || 'новый').toLowerCase();
  const closed = CLOSED.find((c) => s.startsWith(c));
  let rest = closed ? s.slice(closed.length).replace(/^[\s:—-]+/, '') : s;
  let idx = STAGES.findIndex((st) => rest.startsWith(st));
  if (idx < 0) {
    // «отказ» без ступени: восстанавливаем по заполненным полям.
    const q = Number((l['балл квалификации'] || '').replace(',', '.'));
    idx = l['сумма сделки'] ? STAGES.indexOf('смета') : q >= 2 ? STAGES.indexOf('квалифицирован') : l['балл квалификации'] || l['причина отказа'] ? STAGES.indexOf('ответил') : l['касание 1'] ? 1 : 0;
    if (closed === 'нет ответа') idx = 1;
  }
  return { idx, closed: closed || null };
}

// Кому писать сегодня: следующее касание по ритму канала, «напомнить» и просроченные шаги после диагностики.
export function dueToday(leads, today) {
  const out = [];
  for (const l of leads) {
    const { idx, closed } = stageOf(l);
    const name = l['компания/бренд'] || '(без имени)';
    const remind = day(l['напомнить']);
    if (remind && remind <= today && closed !== 'отказ' && closed !== 'не наш') {
      out.push({ name, what: `напомнить (${l['напомнить']})${closed === 'пауза' ? ' — пауза кончилась, нужен новый повод' : ''}`, late: Math.round((today - remind) / 864e5) });
      continue;
    }
    if (closed) continue;
    const ch = channelOf(l);
    if (idx === 1) {
      const t1 = day(l['касание 1']);
      if (!t1) { out.push({ name, what: 'статус «написали», но нет даты касания 1 — заполнить', late: 0 }); continue; }
      const [d2, d3] = CADENCE[HOT.has(ch) ? 'hot' : 'cold'];
      const t2 = l['касание 2'], t3 = l['касание 3'];
      if (!t2 && addDays(t1, d2) <= today) out.push({ name, what: `касание 2 (день ${d2}, ${ch})`, late: Math.round((today - addDays(t1, d2)) / 864e5) });
      else if (t2 && !t3 && addDays(t1, d3) <= today) out.push({ name, what: `касание 3 (день ${d3}, ${ch}) — последнее`, late: Math.round((today - addDays(t1, d3)) / 864e5) });
      else if (t3 && addDays(day(t3) || t1, 3) <= today) out.push({ name, what: 'три касания без ответа → статус «нет ответа», через 60 дней — один повод', late: 0 });
    }
    if (idx === 0 && l['повод для письма']) out.push({ name, what: `первое касание: ${l['повод для письма']}`, late: -1 });
    if (idx === STAGES.indexOf('смета') && !remind) out.push({ name, what: 'смета отправлена, нет даты в «напомнить» — поставить день 2/5/10 (10-sales.md §1)', late: 0 });
  }
  return out.sort((a, b) => b.late - a.late);
}

// Сколько лидов дошло до каждой ступени (дошедший до «смета» прошёл и «диагностику»).
export function funnel(leads) {
  const reached = STAGES.map(() => 0);
  for (const l of leads) {
    const { idx } = stageOf(l);
    for (let i = 0; i <= idx; i++) reached[i]++;
  }
  return reached;
}

const pct = (x) => (Number.isFinite(x) ? Math.round(x * 100) + '%' : '—');
const rub = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';

function main() {
  const args = process.argv.slice(2);
  const file = args.find((x, i) => !x.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
  if (!file) {
    console.error('Укажите лист лидов: node scripts/insales-funnel.mjs лиды.csv [--today ГГГГ-ММ-ДД] [--since ГГГГ-ММ-ДД] [--spend канал=₽,…]');
    process.exit(1);
  }
  const opt = (k) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
  const today = day(opt('today') || iso(new Date()));
  const since = day(opt('since') || '1970-01-01');
  const spend = Object.fromEntries((opt('spend') || '').split(',').filter(Boolean).map((p) => p.split('=')).map(([k, v]) => [k.trim().toLowerCase(), Number(v)]));

  const all = parseCsv(readFileSync(file, 'utf8')).filter((l) => !/^пример/i.test(l['компания/бренд'] || ''));
  const bad = all.filter((l) => { const s = (l['статус'] || '').toLowerCase(); return s && !CLOSED.some((c) => s.startsWith(c)) && !STAGES.some((st) => s.startsWith(st)); });
  const leads = all.filter((l) => (day(l['дата']) || today) >= since && stageOf(l).closed !== 'не наш');

  console.log(`Лист: ${all.length} лидов, в воронке ${leads.length}${opt('since') ? ` (с ${opt('since')})` : ''}, на дату ${iso(today)}\n`);

  // 1. Сегодня
  const due = dueToday(all, today);
  const touches = due.filter((d) => d.late >= 0), firsts = due.filter((d) => d.late < 0);
  console.log(`Сегодня: ${touches.length} касаний и задач, ${firsts.length} новых с поводом`);
  for (const d of touches) console.log(`  ${d.late > 0 ? `просрочено ${d.late} дн. ` : ''}${d.name} — ${d.what}`);
  if (firsts.length) console.log(`  + первые сообщения: ${firsts.slice(0, 5).map((d) => d.name).join(', ')}${firsts.length > 5 ? ` и ещё ${firsts.length - 5}` : ''} (лимит — 20 в день, 08-lead-gen.md §6)`);

  // 2. Воронка: всего и по каналам
  const groups = new Map([['всего', leads]]);
  for (const l of leads) {
    const k = channelOf(l);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(l);
  }
  const cols = ['написали', 'ответил', 'квалифицирован', 'диагностика', 'смета', 'предоплата', 'запуск', 'первый заказ'];
  const short = ['писали', 'ответ', 'квал', 'диагн', 'смета', 'предопл', 'запуск', '1-й заказ'];
  console.log(`\nВоронка (дошли до ступени):\n  ${'канал'.padEnd(14)}${short.map((c) => c.padStart(10)).join('')}`);
  for (const [k, ls] of groups) {
    const f = funnel(ls);
    console.log(`  ${k.padEnd(14)}${cols.map((c) => String(f[STAGES.indexOf(c)]).padStart(10)).join('')}`);
  }

  // 3. Конверсии против порогов v1
  console.log('\nКонверсии против порогов v1 (10-sales.md §5):');
  const cold = leads.filter((l) => !HOT.has(channelOf(l)));
  for (const t of THRESHOLDS) {
    const f = funnel(t.only === 'cold' ? cold : leads);
    const n = f[STAGES.indexOf(t.from)], m = f[STAGES.indexOf(t.to)];
    const v = m / n;
    const verdict = n < MIN_N ? `мало данных (нужно от ${MIN_N})` : v >= t.min ? 'держится' : 'ниже порога';
    console.log(`  ${t.label.padEnd(32)} ${String(m).padStart(3)} из ${String(n).padEnd(4)} ${pct(v).padStart(4)}  порог ${pct(t.min)} — ${verdict}`);
  }
  const deals = leads.filter((l) => stageOf(l).idx >= STAGES.indexOf('предоплата'));
  const sums = deals.map((l) => Number((l['сумма сделки'] || '').replace(/[^\d]/g, ''))).filter(Boolean);
  if (sums.length) {
    const avg = sums.reduce((s, x) => s + x, 0) / sums.length;
    console.log(`  средний чек: ${rub(avg)} по ${sums.length} сделкам — порог 90 000 ₽, ${avg >= 90000 ? 'держится' : 'ниже порога'}`);
  }

  // 4. Стоимость оплаченного проекта по каналу против предела из 13-economics.md
  // Строки «не наш» тоже стоили денег — цену заявки считаем по всем строкам канала в когорте.
  const paid = Object.keys(spend);
  if (paid.length) {
    console.log(`\nСтоимость оплаченного проекта (предел на привлечение — ${rub(LIMITS.cac)}, 13-economics.md §3):`);
    for (const k of paid) {
      const ls = all.filter((l) => channelOf(l) === k && (day(l['дата']) || today) >= since);
      const n = ls.length, d = ls.filter((l) => stageOf(l).idx >= STAGES.indexOf('предоплата')).length;
      const cpl = spend[k] / n, cpp = spend[k] / d, lim = UNIT_LIMIT[k];
      const lead = n ? `лид ${rub(cpl)}${lim ? ` при пределе ${rub(lim)}${cpl > lim ? ' — дороже' : ''}` : ''}` : 'лидов нет';
      const verdict = d ? `${rub(cpp)} за проект — ${cpp <= LIMITS.cac ? 'в пределе' : 'дороже предела: закрыть или переписать'}` : `проектов нет; ${lead}`;
      console.log(`  ${k.padEnd(14)} ${rub(spend[k]).padStart(10)} · лидов ${n} · проектов ${d} · ${verdict}`);
    }
  }

  // 5. Причины отказов — данные для гипотез исследования (01-research.md)
  const reasons = new Map();
  for (const l of leads) {
    if (stageOf(l).closed !== 'отказ') continue;
    const r = (l['причина отказа'] || 'не спросили').toLowerCase();
    reasons.set(r, (reasons.get(r) || 0) + 1);
  }
  if (reasons.size) {
    console.log('\nПричины отказов:');
    for (const [r, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${r}`);
  }

  if (bad.length) console.log(`\n✗ Статусы не из словаря (10-sales.md §5), посчитаны как «новый»: ${bad.map((l) => `${l['компания/бренд']} «${l['статус']}»`).join('; ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
