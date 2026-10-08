// Смета по брифу.
//   node estimate.mjs brief.json      — смета в markdown
//   node estimate.mjs --preset shop   — смета эталонного проекта
//   node estimate.mjs --calibrate     — все эталоны: часы, цена, худший случай (проверка цен пакетов)

import { readFileSync } from 'node:fs';
import { estimate, PACKAGES, RATES } from './rules.mjs';
import { MODULES } from './works.mjs';
import { PRESETS } from './presets.mjs';

const rub = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
const h = (n) => (+n.toFixed(1)).toLocaleString('ru-RU') + ' ч';

function report(name, b) {
  const e = estimate(b);
  const out = [`# Смета: ${name}`, ''];
  const mods = [...new Set(e.lines.map((l) => l.module))];
  for (const m of mods) {
    out.push(`## ${MODULES[m]}`, '', '| Код | Работа | Кол-во | Роль | Часы | Сумма |', '|---|---|---|---|---|---|');
    for (const l of e.lines.filter((x) => x.module === m)) {
      out.push(`| ${l.code} | ${l.name} | ${l.qty} × ${l.unit} | ${l.role} | ${h(l.hours)} | ${rub(l.cost)} |`);
    }
    out.push('');
  }
  out.push('## Итог', '',
    `- Производство: ${h(e.prodHours)}; управление: ${h(e.pmHours)}; всего ${h(e.hoursTotal)} (худший случай ${h(e.worstHours)})`,
    `- Сложность проекта: ${e.level}, резерв ${rub(e.risk)}`,
    `- **Цена по смете: ${rub(e.total)}**${b.urgent ? ' (срочно ×1,3)' : ''}`,
    `- Срок: ~${e.workDays} рабочих дней`,
    e.package
      ? `- **Предложение: пакет «${e.package.name}» ${rub(e.package.price)} + допработы ${rub(e.package.quote - e.package.price)} = ${rub(e.package.quote)}**\n` +
        e.package.extras.map((l) => `  - ${l.code} ${l.name}: ${+l.extraQty.toFixed(2)} × ${l.unit} — ${rub(l.extraCost)}`).join('\n')
      : '- Пакет не подходит: индивидуальная смета.',
    '', `Ставки: ${Object.entries(RATES).map(([k, v]) => `${k} ${v}`).join(', ')} ₽/ч.`);
  return { text: out.join('\n'), e };
}

const arg = process.argv[2];
if (arg === '--calibrate') {
  console.log('| Эталон | Часы | Худший случай, ч | Смета | Пакет | Пакет + допы | Предложение/смета |');
  console.log('|---|---|---|---|---|---|---|');
  for (const [id, p] of Object.entries(PRESETS)) {
    const { e } = report(p.name, p.brief);
    const pk = e.package;
    console.log(`| ${p.name} | ${h(e.hoursTotal)} | ${h(e.worstHours)} | ${rub(e.total)} | ${pk ? pk.name : '—'} | ${pk ? rub(pk.quote) : '—'} | ${pk ? (pk.quote / e.total).toFixed(2) : '—'} |`);
  }
} else if (arg === '--preset') {
  const p = PRESETS[process.argv[3]];
  console.log(report(p.name, p.brief).text);
} else if (arg) {
  console.log(report(arg, JSON.parse(readFileSync(arg, 'utf8'))).text);
} else {
  console.log('Использование: node estimate.mjs brief.json | --preset <id> | --calibrate');
  console.log('Эталоны:', Object.keys(PRESETS).join(', '));
  console.log('Пакеты:', PACKAGES.map((p) => `${p.name} ${p.price}`).join(', '));
}
