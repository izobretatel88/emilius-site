#!/usr/bin/env node
// Проспектинг: по списку брендов или сайтов определяет сегмент и повод для письма (08-lead-gen.md, §5).
//
//   node scripts/insales-site-check.mjs список.txt > лиды.csv
//
// В списке по строке: домен (brand.ru), адрес сайта или название бренда латиницей.
// Для названия пробуются brand.ru, brand-shop.ru, brandshop.ru, brand.com, brand.store.
// Выход — CSV с колонками leads-template.csv (заполнены сайт, платформа, признак, повод, сегмент)
// и служебными колонками в конце. Строки без сайта — кандидаты A1: проверить вручную на WB/Ozon.

import { readFileSync } from 'node:fs';

const PLATFORMS = [
  ['Tilda', /tildacdn|data-tilda|tilda\.ws|Made on Tilda/i],
  ['InSales', /insales|myinsales|static\.insales-cdn/i],
  ['1С-Битрикс', /bitrix\/(js|templates|cache)|BX\.setCSSList/i],
  ['OpenCart', /catalog\/view\/theme|route=product|index\.php\?route=/i],
  ['WooCommerce', /woocommerce/i],
  ['WordPress', /wp-content|wp-includes/i],
  ['Shopify', /cdn\.shopify\.com/i],
  ['Ecwid', /ecwid/i],
  ['Taplink', /taplink/i],
  ['Wix', /wixstatic|wix\.com/i],
  ['Nethouse', /nethouse/i],
  ['UMI', /umi-cms|umicms/i],
  ['Craftum', /craftum/i],
];

export function analyze(html, url) {
  const platform = PLATFORMS.find(([, re]) => re.test(html))?.[0] || 'не определена';
  const wb = (html.match(/wildberries\.ru|wb\.ru\/catalog/gi) || []).length;
  const ozon = (html.match(/ozon\.ru\/(product|seller|brand)/gi) || []).length;
  const ym = (html.match(/market\.yandex\.ru/gi) || []).length;
  const cart = /\/cart\b|\/basket\b|корзин|add[-_]?to[-_]?cart|t-store__card|t706|data-product-id|ecwid/i.test(html);
  const checkout = /\/checkout|оформить заказ|оформление заказа/i.test(html);
  const tildaCards = (html.match(/t-store__card\b|js-product t-store/gi) || []).length;
  const filters = /t-store__filter|filter|фильтр/i.test(html);
  const metrika = /mc\.yandex\.ru\/metrika|ym\(\d+/i.test(html);
  const vkPixel = /vk\.com\/rtrg|top-fwz1\.mail\.ru/i.test(html);
  const year = Math.max(0, ...(html.match(/©\s*(?:\d{4}\s*[-–—]\s*)?(\d{4})/g) || []).map((m) => +m.match(/(\d{4})\D*$/)[1]));
  const title = (html.match(/<title[^>]*>([^<]*)/i)?.[1] || '').trim().replace(/\s+/g, ' ').slice(0, 80);

  let segment = '';
  let need = '';
  let hook = '';
  const mpLinks = wb + ozon + ym;
  if (mpLinks && !cart) {
    segment = 'A2';
    need = `сайт без корзины, ${mpLinks} ссыл. на площадки`;
    hook = 'Кнопка «Купить на WB» отдаёт покупателя площадке вместе с повторной покупкой';
  } else if (platform === 'Tilda' && cart) {
    segment = 'D';
    need = tildaCards ? `Tilda-магазин, на главной ${tildaCards} карточек${filters ? '' : ', фильтров нет'}` : 'Tilda-магазин';
    hook = tildaCards >= 30 && !filters ? `${tildaCards} товаров без фильтров — покупатель листает экранами` : 'Каталог растёт — Tilda упирается в фильтры, остатки и учёт';
  } else if (['OpenCart', 'UMI', 'Nethouse', 'WordPress', 'WooCommerce'].includes(platform) && cart) {
    segment = 'E';
    need = `магазин на ${platform}${year && year < 2024 ? `, © ${year}` : ''}`;
    hook = 'Переезд без потери позиций: сохраняем адреса страниц и заказы';
  } else if (platform === 'InSales') {
    segment = 'E';
    need = 'уже на InSales';
    hook = 'Аудит после запуска (QA-03) или доработка темы, не новый магазин';
  } else if (!cart && ['Taplink', 'Wix', 'не определена', 'Tilda'].includes(platform)) {
    segment = 'A2';
    need = `визитка на ${platform}, корзины нет`;
    hook = 'Заказы через переписку — показываем, как принимать их с оплатой на сайте';
  } else {
    need = cart ? `магазин на ${platform}` : platform;
  }
  if (!metrika) need += ', нет Метрики';
  return { url, platform, title, segment, need, hook, cart, checkout, wb, ozon, ym, tildaCards, metrika, vkPixel, year: year || '' };
}

function candidates(line) {
  const s = line.trim();
  if (/^https?:\/\//i.test(s)) return [s];
  if (/\.[a-zа-я]{2,}$/i.test(s)) return [`https://${s}`];
  const slug = s.toLowerCase().replace(/[^a-z0-9-]+/g, '');
  if (!slug) return [];
  return ['.ru', '-shop.ru', 'shop.ru', '.com', '.store'].map((z) => `https://${slug}${z}`);
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'Mozilla/5.0 (emilius prospecting)' } });
    if (!res.ok) return null;
    const html = await res.text();
    // Парковки и заглушки регистраторов — не сайт бренда
    if (/домен (продается|припаркован)|domain (is )?for sale|reg\.ru\/domain|parking/i.test(html) && html.length < 30000) return null;
    return { html, url: res.url };
  } catch {
    return null;
  }
}

const csv = (v) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Укажите список: node scripts/insales-site-check.mjs список.txt > лиды.csv');
    process.exit(1);
  }
  // Без сети все строки ушли бы в A1 «сайта нет» — проверяем доступ заранее
  if (!(await fetchHtml('https://ya.ru'))) {
    console.error('Нет доступа к ya.ru — проверьте сеть или прокси. Без сети результат был бы ложным.');
    process.exit(3);
  }
  const head = readFileSync(new URL('../docs/insales-service/leads-template.csv', import.meta.url), 'utf8').split('\n')[0].split(';');
  const extra = ['корзина', 'ссылок WB/Ozon/ЯМ', 'Метрика', '© год', 'заголовок'];
  console.log([...head, ...extra].join(';'));
  const today = new Date().toISOString().slice(0, 10);
  const lines = readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const line of lines) {
    let found = null;
    for (const url of candidates(line)) {
      found = await fetchHtml(url);
      if (found) break;
    }
    const r = found ? analyze(found.html, found.url) : { url: 'нет', platform: '—', segment: 'A1', need: 'сайт не найден по типовым адресам', hook: 'Брендовый запрос в Яндексе уходит площадке и перекупщикам', title: '' };
    const row = Object.fromEntries(head.map((h) => [h, '']));
    Object.assign(row, {
      'дата': today,
      'сегмент': r.segment,
      'компания/бренд': line,
      'сайт': r.url,
      'платформа сайта': r.platform,
      'признак потребности (что увидели)': r.need,
      'повод для письма': r.hook,
      'статус': r.segment ? 'новый' : 'не наш',
    });
    const tail = found ? [r.cart ? 'да' : 'нет', `${r.wb}/${r.ozon}/${r.ym}`, r.metrika ? 'да' : 'нет', r.year, r.title] : ['', '', '', '', ''];
    console.log([...head.map((h) => row[h]), ...tail].map(csv).join(';'));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
