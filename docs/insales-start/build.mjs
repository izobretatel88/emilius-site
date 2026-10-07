// Пересобирает 03-constructor.md и сметы примеров из works.csv и calc.mjs.
// Запуск: node docs/insales-start/build.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorks, estimate, toMarkdown, RATES } from './calc.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const works = Object.values(loadWorks());
const lvl = { 1: 'низкая', 2: 'средняя', 3: 'высокая' };
const out = [
  '# Конструктор услуги: перечень типовых работ',
  '',
  'Сгенерировано из `works.csv` командой `node docs/insales-start/build.mjs`. Править — только `works.csv`.',
  '',
  'Часы — чистое время исполнителя (как в Weeek). Норма часов = база + за единицу × количество. Менеджер и тестировщик входят в ставку.',
  '',
  'Роли и ставки: ' + Object.entries(RATES).map(([r, v]) => `${r} — ${v} ₽/ч`).join(', ') + '. NC — ноукод InSales, DEV — разработчик, DS — дизайнер, AN — аналитика/SEO, CO — контент-оператор, PR — продюсер/основатель.',
  '',
];
let mod = '';
for (const w of works) {
  if (w.модуль !== mod) {
    mod = w.модуль;
    out.push('', `## ${mod}`, '', '| ID | Работа | Вариант | Когда | Вход → результат | Роль | Часы | Сложн. | Зависит | Риски |', '|---|---|---|---|---|---|---|---|---|---|');
  }
  const hrs = w.единица === 'проект' ? `${w.база_ч}` : `${w.база_ч} + ${w.за_ед_ч}/${w.единица}`;
  out.push(`| ${w.id} | ${w.задача} | ${w.вариант} | ${w.когда_нужна} | ${w.вход} → ${w.результат} | ${w.роль} | ${hrs} | ${lvl[w.сложность]} | ${w.зависит} | ${w.риски} |`);
}
writeFileSync(join(here, '03-constructor.md'), out.join('\n') + '\n');

for (const f of readdirSync(join(here, 'examples')).filter((f) => f.endsWith('.json'))) {
  const a = JSON.parse(readFileSync(join(here, 'examples', f), 'utf8'));
  writeFileSync(join(here, 'examples', f.replace('.json', '.md')), toMarkdown(a, estimate(a)) + '\n');
}
console.log('ok');
