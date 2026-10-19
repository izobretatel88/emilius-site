// Быстрый расчёт для лендинга: 7 ответов клиента → полный бриф → ориентир по estimate().
// Те же нормы, что у менеджера, поэтому ориентир на сайте не расходится со сметой и КП.
// Проверка: node scripts/insales-calc.mjs --quick
import { estimate } from './estimate.js';

// Вопросы формы. Значение первого варианта — по умолчанию.
export const QUICK_QUESTIONS = {
  channel: ['Где продаёте сейчас', [['mp', 'WB или Ozon'], ['social', 'Соцсети и мессенджеры'], ['offline', 'Офлайн-магазин'], ['site', 'Есть сайт'], ['none', 'Пока нигде']]],
  sku: ['Сколько товаров на старте', [['30', 'До 50'], ['150', '50–300'], ['600', '300–1 000'], ['2000', 'Больше 1 000']]],
  where: ['Где сейчас список товаров', [['head', 'Нигде, заведём с нуля'], ['excel', 'Таблица Excel'], ['mp', 'Кабинет WB или Ozon'], ['1c', '1С'], ['moysklad', 'МойСклад'], ['site', 'Старый сайт']]],
  variants: ['Есть размеры или цвета с разными остатками', [['no', 'Нет'], ['yes', 'Да']]],
  carriers: ['Сколько служб доставки', [['1', 'Одна'], ['2', 'Две'], ['3', 'Три и больше']]],
  photos: ['Фото товаров', [['ready', 'Готовы'], ['mixed', 'Нужно обработать']]],
  crm: ['Нужна CRM (amoCRM, Битрикс24)', [['no', 'Нет'], ['yes', 'Да']]],
};

export function quickBrief(a) {
  const sku = Number(a.sku) || 30;
  const where = a.where || 'head';
  const source = { head: 'manual', excel: 'excel', mp: 'marketplace', '1c': '1c', moysklad: 'moysklad', site: 'oldsite' }[where] || 'manual';
  const accounting = where === '1c' || where === 'moysklad' ? where : 'none';
  return {
    segment: { mp: 'seller', social: 'social', offline: 'offline', site: 'oldsite', none: 'new' }[a.channel] || 'new',
    sku,
    // Категорий обычно около корня из числа товаров: 30 → 5, 150 → 12, 600 → 24, 2000 → 40.
    categories: Math.min(40, Math.max(5, Math.round(Math.sqrt(sku)))),
    variants: a.variants === 'yes',
    source,
    accounting,
    ordersToAccounting: accounting !== 'none',
    // Селлеру связываем остатки с площадкой, даже если товары заводим из Excel.
    marketplaces: a.channel === 'mp' || where === 'mp' ? 1 : 0,
    carriers: Number(a.carriers) || 1,
    photos: a.photos === 'mixed' ? 'mixed' : 'ready',
    crm: a.crm === 'yes',
    // Старый сайт: сохраняем в поиске страницы товаров и категорий.
    oldSiteUrls: source === 'oldsite' ? sku + 50 : 0,
  };
}

// Ориентир, а не смета: верх — +20% на то, что всплывёт на диагностике (склады, грязные данные, доработки).
export function quickEstimate(answers, catalog) {
  const e = estimate(quickBrief(answers), catalog);
  const to5 = (x) => Math.round(x / 5000) * 5000;
  return {
    packageName: e.packageName,
    from: e.price,
    to: Math.max(e.price + 5000, to5(e.price * 1.2)),
    weeks: [e.weeks, e.weeks + 1],
    tariff: e.platform.tariff,
    hours: e.hours,
  };
}
