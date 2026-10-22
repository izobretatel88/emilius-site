// Эксперимент «Emilius как операционная система агентства» (docs/concept/emilius-os-v0.1.md).
// Модель: направления → задачи → люди → проекты. Из неё собираются страницы раздела /os/.
//
// Данные:
//  - InSales — настоящие, обезличенные: docs/insales-service/data/orders-hours.csv
//    (заказы по проектам с кодами вместо названий, задачи, план/факт/полезные часы);
//  - остальные направления, лента и команда — демо (`demo: true`), пока нет выгрузки.
//    Репозиторий публичный: имён сотрудников, клиентов и сырых часов здесь нет.
import ordersCsv from '../../docs/insales-service/data/orders-hours.csv?raw';
import catalogCsv from '../../docs/insales-service/03-catalog.csv?raw';

export type Order = { project: string; order: string; tasks: number; plan: number; fact: number; useful: number };

export const ORDERS: Order[] = ordersCsv
  .trim()
  .split('\n')
  .slice(1)
  .map((line) => {
    const [project, order, tasks, plan, fact, useful] = line.split(';');
    return { project, order, tasks: +tasks, plan: +plan || 0, fact: +fact || 0, useful: +useful || 0 };
  });

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Сводка по InSales из реальных (обезличенных) заказов
const planned = ORDERS.filter((o) => o.plan > 0 && o.fact > 0);
export const INSALES = {
  orders: ORDERS.length,
  projects: new Set(ORDERS.map((o) => o.project)).size,
  tasks: sum(ORDERS.map((o) => o.tasks)),
  usefulHours: Math.round(sum(ORDERS.map((o) => o.useful))),
  factHours: Math.round(sum(ORDERS.map((o) => o.fact))),
  // Насколько факт совпадает с планом: медиана отношения факт/план по заказам с оценкой
  planFactMedian: +median(planned.map((o) => o.fact / o.plan)).toFixed(2),
  planned: planned.length,
  sumPlan: Math.round(sum(planned.map((o) => o.plan))),
  sumFact: Math.round(sum(planned.map((o) => o.fact))),
  medianOrderHours: +median(ORDERS.map((o) => o.useful)).toFixed(1),
  // Доля заказов, уложившихся в оценку с запасом ±25%
  withinQuarter: Math.round((planned.filter((o) => Math.abs(o.fact / o.plan - 1) <= 0.25).length / planned.length) * 100),
};

export type Direction = {
  id: string;
  name: string;
  line: string; // что делаем — одной строкой
  tasks: number;
  hours: number;
  projects: number;
  people: number;
  stack: string[];
  demo?: boolean;
  href?: string;
};

export const DIRECTIONS: Direction[] = [
  {
    id: 'insales',
    name: 'InSales',
    line: 'Магазины на шаблоне, кастомизация темы, импорт каталога, интеграции',
    tasks: INSALES.tasks,
    hours: INSALES.usefulHours,
    projects: INSALES.projects,
    people: 4,
    stack: ['Liquid', 'JS', 'API InSales', 'CSV-импорт'],
    href: 'os/insales/',
  },
  { id: 'frontend', name: 'Front-end', line: 'Интерфейсы, сложная вёрстка, собственные модули', tasks: 214, hours: 960, projects: 9, people: 3, stack: ['JS', 'TypeScript', 'Astro', 'Vue'], demo: true },
  { id: 'tilda', name: 'Tilda', line: 'Сайты и лендинги, Zero Block, развитие и SEO', tasks: 167, hours: 520, projects: 12, people: 2, stack: ['Zero Block', 'CSS', 'SEO'], demo: true },
  { id: 'design', name: 'Дизайн', line: 'Исследования, прототипы, интерфейсы', tasks: 96, hours: 410, projects: 8, people: 2, stack: ['Figma', 'Pencil', 'касдев'], demo: true },
  { id: 'nocode', name: 'No-code', line: 'Автоматизации, боты, интеграции без кода', tasks: 58, hours: 190, projects: 6, people: 2, stack: ['Make', 'n8n', 'Telegram'], demo: true },
];

// Лента: последние принятые заказы InSales — реальные, обезличенные (код проекта вместо названия)
// По одному последнему заказу на проект — лента не повторяет один и тот же код
const seen = new Set<string>();
export const FEED = [...ORDERS]
  .reverse()
  .filter((o) => o.useful > 0 && !seen.has(o.project) && seen.add(o.project))
  .slice(0, 6)
  .map((o) => ({ project: o.project, direction: 'InSales', tasks: o.tasks, hours: +o.useful.toFixed(1) }));

// Процесс — колесо продукта как модель работы
export const PROCESS = ['запрос', 'направление', 'задача', 'исполнитель', 'работа', 'проверка', 'результат', 'следующая итерация'];

// Команда — демо: роли без имён, цифры условные (публичные профили — после согласия сотрудников)
export type Person = { id: string; role: string; hours: number; tasks: number; projects: number; split: [string, number][]; stack: string[]; seed: number; since: string };
export const TEAM: Person[] = [
  { id: 'frontend', since: '2021', role: 'Фронтенд-разработчик', hours: 842, tasks: 164, projects: 11, split: [['InSales', 48], ['Front-end', 31], ['No-code', 14], ['Дизайн', 7]], stack: ['Liquid', 'JS', 'API'], seed: 3 },
  { id: 'builder', since: '2023', role: 'Сборщик магазинов InSales', hours: 615, tasks: 238, projects: 15, split: [['InSales', 82], ['Tilda', 12], ['No-code', 6]], stack: ['InSales', 'CSV', 'Метрика'], seed: 7 },
  { id: 'designer', since: '2022', role: 'Дизайнер интерфейсов', hours: 430, tasks: 91, projects: 9, split: [['Дизайн', 71], ['Tilda', 19], ['Front-end', 10]], stack: ['Figma', 'Pencil', 'касдев'], seed: 11 },
];

// Активность по 52 неделям — для графика вклада (демо, детерминированно от seed)
export const activity = (seed: number) =>
  Array.from({ length: 52 }, (_, i) => {
    const x = Math.sin(seed * 97 + i * 1.7) * 10000;
    return Math.max(0, Math.min(4, Math.floor((x - Math.floor(x)) * 5)));
  });

export const fmt = (n: number) => n.toLocaleString('ru-RU');

// Размеры заказов InSales по полезным часам — для гистограммы
export const ORDER_SIZES = [
  [0, 2, 'до 2 ч'],
  [2, 5, '2–5 ч'],
  [5, 10, '5–10 ч'],
  [10, 20, '10–20 ч'],
  [20, 50, '20–50 ч'],
  [50, Infinity, '50+ ч'],
].map(([lo, hi, label]) => ({
  label: label as string,
  count: ORDERS.filter((o) => o.useful >= (lo as number) && o.useful < (hi as number)).length,
}));

// Типовые работы InSales (docs/insales-service/03-catalog.csv): модуль → работы
export type Work = { id: string; module: string; title: string; hours: number; perUnit: number; unit: string };
export const WORKS: Work[] = catalogCsv
  .trim()
  .split('\n')
  .slice(1)
  .map((line) => {
    const c = line.split(';');
    return { id: c[0], module: c[1], title: c[2], hours: +c[8] || 0, perUnit: +c[9] || 0, unit: c[7] };
  })
  .filter((w) => w.id && w.module);
export const MODULES = [...new Set(WORKS.map((w) => w.module))].map((m) => ({
  name: m,
  works: WORKS.filter((w) => w.module === m),
  hours: +WORKS.filter((w) => w.module === m).reduce((a, w) => a + w.hours, 0).toFixed(1),
}));

// Последние задачи человека (демо): работы из каталога InSales и коды проектов из учёта —
// детерминированно от seed, без клиентов и реальных назначений
const MODULES_BY_ROLE: Record<string, string[]> = {
  frontend: ['Модификации', 'Дизайн', 'Каталог', '1С', 'Маркетплейсы'],
  builder: ['Каталог', 'Импорт', 'Контент', 'Оплата', 'Доставка', 'Тестирование'],
  designer: ['Дизайн', 'Страницы', 'Контент'],
};
const PROJECT_CODES = [...new Set(ORDERS.map((o) => o.project))];
export const recentTasks = (p: Person, n = 5) => {
  const pool = WORKS.filter((w) => (MODULES_BY_ROLE[p.id] ?? []).includes(w.module));
  return Array.from({ length: n }, (_, i) => {
    const w = pool[(p.seed * 7 + i * 5) % pool.length];
    const hours = Math.max(0.5, Math.round((w.hours || 1) * (0.8 + ((p.seed + i) % 5) * 0.15) * 2) / 2);
    return { title: w.title, module: w.module, project: PROJECT_CODES[(p.seed * 3 + i * 4) % PROJECT_CODES.length], hours };
  });
};

// Запас для «живой» ленты: последние 18 заказов с полезными часами, новые сверху
export const FEED_POOL = [...ORDERS]
  .reverse()
  .filter((o) => o.useful > 0)
  .slice(0, 18)
  .map((o) => ({ project: o.project, direction: 'InSales', tasks: o.tasks, hours: +o.useful.toFixed(1) }));
