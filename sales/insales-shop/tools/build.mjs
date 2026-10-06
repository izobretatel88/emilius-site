// Собирает из model.mjs: 03-каталог-работ.md, 04-расчёты-пакетов.md, calculator.html.
// Запуск: node sales/insales-shop/tools/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as M from './model.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const rub = (x) => Math.round(x).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
const hrs = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
const cell = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');

// ── 03-каталог-работ.md ────────────────────────────────────────────────────
const typical = M.defaults();
let md = `# Каталог типовых работ (конструктор услуги)

Сгенерировано из \`tools/model.mjs\` (версия ${M.VERSION}). Не править руками — менять модель и запускать \`node sales/insales-shop/tools/build.mjs\`.

Структура: **модуль → работа → норматив → роль → зависимости → результат → риски → варианты**. Часы — чистое время исполнителя; менеджер и тестировщик уже в командной ставке.

## Ставки

| Роль | Команда | ₽/ч |
|---|---|---|
${Object.values(M.ROLES).map((r) => `| ${r.name} | ${r.team} | ${rub(r.rate)} |`).join('\n')}

Скидка за объём (регламент): ${M.VOLUME_DISCOUNT.slice().reverse().map(([h, d]) => `от ${h} ч — ${d * 100} %`).join(', ')}.
Срочность: +${M.URGENCY.slice(1).map((x) => x * 100).join(' / +')} %. Риск (считается из брифа): +${M.RISK.slice(1).map((x) => x * 100).join(' / +')} %. Материалы не готовы до старта: +15 %.

Сложность: 1 — делает любой исполнитель по чек-листу; 2 — нужен опыт с InSales; 3 — неопределённость, нужен ведущий.

`;
for (const [mid, mname] of Object.entries(M.MODULES)) {
  const ws = M.WORKS.filter((w) => w.m === mid);
  md += `## ${mid}. ${mname.replace(/^Этап 0\. /, 'Этап 0: ')}\n\n`;
  md += `| ID | Работа | Когда | Норматив | Ч (типовой*) | Мин–макс | Роль | Сл. | Зависит от | Вход | Результат | Риски | Варианты |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const w of ws) {
    const h = typeof w.hours === 'function' ? w.hours(typical) : w.hours;
    const when = w.base ? '**база**' : 'опция';
    md += `| ${w.id} | ${cell(w.name)} | ${when} | ${cell(w.unit || 'фикс')} | ${hrs(h)} | ${hrs(h * w.spread[0])}–${hrs(h * w.spread[1])} | ${w.role} | ${w.cx} | ${w.deps.join(', ') || '—'} | ${cell(w.in)} | ${cell(w.out)} | ${cell(w.risks) || '—'} | ${cell(w.variants) || '—'} |\n`;
  }
  md += '\n';
}
md += `\\* Типовой — для брифа по умолчанию (80 товаров из WB/Ozon, 10 категорий, 1 оплата, 2 доставки). M16.2 считается как 8 % от остальных часов проекта.\n`;
writeFileSync(join(root, '03-каталог-работ.md'), md);

// ── 04-расчёты-пакетов.md ──────────────────────────────────────────────────
let pk = `# Расчёт пакетов и примеры смет

Сгенерировано из \`tools/model.mjs\` (версия ${M.VERSION}). Пакеты — это заранее заполненные брифы. Фиксированная цена пакета = расчёт модели, округлённый до тысячи. Если бриф клиента выходит за границы пакета — считаем в калькуляторе.

Платформа, приложения, эквайринг, касса и домен оплачиваются клиентом отдельно:

${M.PASS_THROUGH.map(([a, b]) => `- ${a}: ${b}`).join('\n')}

Этап 0 (диагностика и план): ${rub(M.STAGE0.price)}, засчитывается в проект, если договор подписан в течение ${M.STAGE0.validDays} дней.

`;
for (const [key, p] of Object.entries(M.PACKAGES)) {
  const e = M.estimate(p.brief);
  pk += `## «${p.name}» — ${rub(e.total)}, ${e.weeks} нед.\n\n${p.who}.\n\nЧасов: ${hrs(e.hours)} · скидка за объём ${e.disc * 100} % · риск ${e.risk} (+${e.riskK * 100} %) · коридор фикса ±30 %: ${rub(e.fixCorridor[0])}–${rub(e.fixCorridor[1])}\n\nПо ролям: ${Object.entries(e.byRole).map(([r, h]) => `${M.ROLES[r].name} — ${hrs(h)} ч`).join('; ')}.\n\n`;
  pk += `| Модуль | Работа | Ч | Стоимость до коэфф. |\n|---|---|---|---|\n`;
  for (const l of e.lines) pk += `| ${l.m} | ${cell(l.name)} | ${hrs(l.h)} | ${rub(l.cost)} |\n`;
  pk += `\nБриф пакета: \`${JSON.stringify(p.brief)}\`\n\n`;
}
writeFileSync(join(root, '04-расчёты-пакетов.md'), pk);

// ── calculator.html ────────────────────────────────────────────────────────
const tpl = readFileSync(join(here, 'calculator.template.html'), 'utf8');
const model = readFileSync(join(here, 'model.mjs'), 'utf8');
writeFileSync(join(root, 'calculator.html'), tpl.replace('/*MODEL*/', () => model));

console.log('ok:', Object.keys(M.PACKAGES).map((k) => `${k}=${M.estimate(M.PACKAGES[k].brief).total}`).join(' '));
