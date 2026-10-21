// Калибровка норм по факту: таблицы задач проектов (из `insales-kp.mjs --tasks`, колонка факт_ч заполнена).
//   node scripts/insales-calibrate.mjs проект1.csv проект2.csv …   — файлы в хронологическом порядке
// Печатает строку для журнала калибровки (11-improvement.md) по каждому проекту и работы,
// где факт отклонялся больше чем на 25% в одну сторону 3 проекта подряд — их норму пора править в 03-catalog.csv.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Укажите CSV задач проектов с заполненной колонкой факт_ч');
  process.exit(1);
}
const num = (s) => parseFloat(String(s ?? '').replace(',', '.'));
const hist = new Map(); // id → [{ project, plan, fact }]

for (const f of files) {
  const [head, ...rows] = readFileSync(f, 'utf8').trim().split(/\r?\n/).map((l) => l.split(';'));
  const ix = (n) => head.indexOf(n);
  let plan = 0, fact = 0, missing = 0;
  const off = [];
  for (const r of rows) {
    const id = r[ix('задача')].split(' ')[0];
    const p = num(r[ix('план_ч')]), x = num(r[ix('факт_ч')]);
    if (Number.isNaN(x)) { missing++; continue; }
    plan += p; fact += x;
    (hist.get(id) || hist.set(id, []).get(id)).push({ project: basename(f), plan: p, fact: x });
    if (p > 0 && Math.abs(x / p - 1) > 0.25) off.push(`${id} ${p}→${x}`);
  }
  const dev = plan ? Math.round((fact / plan - 1) * 100) : 0;
  console.log(`| ${basename(f, '.csv')} | | | ${plan.toFixed(1)} | ${fact.toFixed(1)} | ${dev > 0 ? '+' : ''}${dev}% | ${off.join(', ') || '—'} | |`
    + (missing ? `   ← без факта: ${missing} задач` : ''));
}

console.log('\nПоправить норму (3 проекта подряд больше 25% в одну сторону):');
let any = false;
for (const [id, h] of hist) {
  const last = h.slice(-3);
  if (last.length < 3) continue;
  const ratios = last.map((x) => (x.plan ? x.fact / x.plan : 1));
  const up = ratios.every((r) => r > 1.25), down = ratios.every((r) => r < 0.75);
  if (!up && !down) continue;
  any = true;
  const k = ratios.reduce((a, b) => a + b, 0) / 3;
  console.log(`  ${id}: факт/план ${ratios.map((r) => r.toFixed(2)).join(', ')} → умножить часы_база и часы_за_ед на ${k.toFixed(2)}`);
}
if (!any) console.log('  нет');
