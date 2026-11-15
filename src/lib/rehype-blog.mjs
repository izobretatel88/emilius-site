// Доводка HTML статьи блога после разбора markdown. Подключается в astro.config.mjs.
//  - корневые адреса картинок и ссылок (/blog/…) получают BASE_PATH: на превью сайт лежит в подпапке;
//  - у картинок из public/ берём размеры из самого файла WebP и включаем ленивую загрузку:
//    без размеров страница прыгает, когда картинки догружаются;
//  - таблицы оборачиваем в блок с горизонтальной прокруткой для узких экранов;
//  - внешние ссылки открываются в новой вкладке (rel="noopener", стрелка ↗ и приписка для программ чтения экрана);
//  - в числах вида «1 000» и «990 ₽» пробел неразрывный: на телефоне в узкой ячейке таблицы
//    «1» и «000» иначе расходились по разным строкам.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glue } from './typograph.mjs';

// Размеры WebP читаем из заголовка файла: три варианта кодирования (VP8, VP8L, VP8X).
function webpSize(file) {
  try {
    const b = readFileSync(file).subarray(0, 40);
    if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') {
      const v = b.readUInt32LE(21);
      return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8X') {
      return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    }
  } catch {
    /* файла нет — размеры не ставим */
  }
  return null;
}

// Неразрывные пробелы в числах, перед ₽/%/тире и между числом и месяцем — src/lib/typograph.mjs. Код в <code>/<pre> не трогаем.
const glueNumbers = glue;

const isRoot = (url) => typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');
const isExternal = (url) => typeof url === 'string' && /^https?:\/\//.test(url);

export function rehypeBlog(options = {}) {
  const base = (options.base || '/').replace(/\/$/, ''); // '' для корня, '/emilius-site' для превью

  // Таблицы называем по ближайшему заголовку перед ними: в списке областей экранного диктора
  // «Таблица: Сколько стоит первый год» понятнее, чем четыре одинаковых «Таблица».
  const textOf = (node) => (node.type === 'text' ? node.value : (node.children || []).map(textOf).join(''));
  let heading = '';
  const used = new Map();
  const tableLabel = () => {
    if (!heading) return 'Таблица';
    const n = (used.get(heading) || 0) + 1;
    used.set(heading, n);
    return `Таблица: ${heading}${n > 1 ? ` (${n})` : ''}`;
  };

  // Якоря разделов латиницей (think-different, итерация 133): у кириллических ссылка на раздел превращалась
  // в «#%D0%BA%D0%BE…» на сотню знаков. Тот же перевод букв, что у вопросов лендинга (итерация 111).
  // Свой id ставим до Astro: его плагин заголовков существующий id не трогает.
  const TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
  const ids = new Set();
  const slug = (text) => {
    const base = [...text.toLowerCase()].map((c) => TR[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 6).join('-') || 'razdel';
    let id = base, n = 2;
    while (ids.has(id)) id = `${base}-${n++}`;
    ids.add(id);
    return id;
  };

  const walk = (node) => {
    if (!node.children) return;
    node.children = node.children.map((child) => {
      if (child.type === 'text') return { ...child, value: glueNumbers(child.value) };
      if (child.type === 'element') {
        const props = child.properties || (child.properties = {});
        if (child.tagName === 'img' && isRoot(props.src)) {
          const size = webpSize(join(process.cwd(), 'public', props.src));
          if (size) Object.assign(props, size);
          props.loading = 'lazy';
          props.decoding = 'async';
          props.src = base + props.src;
        }
        if (child.tagName === 'a') {
          const article = typeof props.href === 'string' && props.href.match(/^\/blog\/([a-z0-9-]+)\/?(?:[?#].*)?$/);
          if (article && options.releases && !options.releases.has(article[1])) {
            child.tagName = 'span';
            delete props.href;
            child.data = { ...(child.data || {}), unreleased: true };
          } else if (isRoot(props.href)) props.href = base + props.href;
          else if (isExternal(props.href)) {
            // Внешняя ссылка — в новой вкладке, как на всём сайте (think-different, итерация 126): раньше источник
            // или тариф inSales открывался вместо статьи, и с телефона читатель терял место. Стрелка ↗ — для глаз,
            // скрытая приписка — для программ чтения экрана. Неразрывный пробел не даёт стрелке уехать на новую строку.
            props.target = '_blank';
            props.rel = 'noopener';
            child.children = [
              ...(child.children || []),
              { type: 'text', value: '\u00a0' },
              { type: 'element', tagName: 'span', properties: { className: ['ext-arrow'], ariaHidden: 'true' }, children: [{ type: 'text', value: '↗' }] },
              { type: 'element', tagName: 'span', properties: { className: ['visually-hidden'] }, children: [{ type: 'text', value: ', откроется в новой вкладке' }] },
            ];
          }
        }
        if (/^h[2-4]$/.test(child.tagName)) {
          heading = textOf(child).replace(/\s+/g, ' ').trim();
          if (!props.id) props.id = slug(heading);
        }
        if (child.tagName !== 'code' && child.tagName !== 'pre') walk(child);
        // Пункт списка, который начинается со ссылки на ещё не вышедшую статью, убираем целиком
        // (think-different, итерация 71): в «Читайте также» он стоял серым текстом среди ссылок и не открывался.
        // Статья выйдет — пункт вернётся сам при следующей сборке.
        if (child.tagName === 'ul' || child.tagName === 'ol') {
          child.children = (child.children || []).filter((li) => {
            if (li.tagName !== 'li') return true;
            const first = (li.children || []).find((k) => !(k.type === 'text' && !k.value.trim()));
            return !(first && first.data && first.data.unreleased);
          });
          if (!child.children.some((k) => k.tagName === 'li')) return null;
        }
        // Подпись пишется в Markdown сразу под картинкой, без пустой строки: такой абзац становится
        // <figure> с <figcaption>. Абзац после пустой строки — обычный текст статьи, не подпись.
        if (child.tagName === 'p') {
          const kids = child.children || [];
          const first = kids.findIndex((k) => !(k.type === 'text' && !k.value.trim()));
          const rest = kids.slice(first + 1);
          if (first >= 0 && kids[first].tagName === 'img' && rest.some((k) => k.type !== 'text' || k.value.trim())) {
            if (rest[0] && rest[0].type === 'text') rest[0] = { ...rest[0], value: rest[0].value.replace(/^\s+/, '') };
            return { type: 'element', tagName: 'figure', properties: {}, children: [kids[first], { type: 'element', tagName: 'figcaption', properties: {}, children: rest }] };
          }
        }
        if (child.tagName === 'table') {
          // На телефоне таблица от трёх колонок складывается в карточки (think-different, итерация 69):
          // ячейке нужна подпись своей колонки — data-label из заголовка. Явные роли ARIA сохраняют
          // таблицу для экранного диктора, когда CSS меняет display у строк и ячеек.
          const els = (node) => (node.children || []).filter((k) => k.type === 'element');
          const role = { table: 'table', thead: 'rowgroup', tbody: 'rowgroup', tr: 'row', th: 'columnheader', td: 'cell' };
          let labels = [];
          const mark = (node) => {
            for (const el of els(node)) {
              const p = el.properties || (el.properties = {});
              if (role[el.tagName]) p.role = role[el.tagName];
              if (el.tagName === 'thead') labels = els(els(el)[0] || {}).map((th) => textOf(th).replace(/\s+/g, ' ').trim());
              if (el.tagName === 'tr' && !els(el).some((c) => c.tagName === 'th')) els(el).forEach((td, i) => { if (labels[i]) td.properties = { ...(td.properties || {}), dataLabel: labels[i] }; });
              mark(el);
            }
          };
          (child.properties ||= {}).role = 'table';
          mark(child);
          // tabindex: широкую таблицу можно листать стрелками, не только мышью и пальцем
          return { type: 'element', tagName: 'div', properties: { className: ['table-wrap'], tabIndex: 0, role: 'region', ariaLabel: tableLabel() }, children: [child] };
        }
      }
      return child;
    }).filter(Boolean);
  };

  // Схемы в статьях рисуются в 2400 px: на телефоне подписи на них мельче 6 px.
  // Картинка становится ссылкой на свой файл — открывается целиком, его можно увеличить пальцами.
  // Обёртку ставим после разбора подписей: там ищется <img> первым в абзаце.
  const wrapImages = (node) => {
    if (!node.children || node.tagName === 'a') return;
    node.children = node.children.map((child) => {
      if (child.type !== 'element') return child;
      if (child.tagName === 'img' && child.properties && typeof child.properties.src === 'string') {
        const alt = String(child.properties.alt || '').trim();
        return {
          type: 'element',
          tagName: 'a',
          properties: { className: ['img-open'], href: child.properties.src, ariaLabel: alt ? `Открыть крупнее: ${alt}` : 'Открыть картинку крупнее' },
          children: [child, { type: 'element', tagName: 'span', properties: { className: ['img-hint'], ariaHidden: 'true' }, children: [{ type: 'text', value: 'Открыть крупнее' }] }],
        };
      }
      wrapImages(child);
      return child;
    });
  };

  // Картинка, с которой статья начинается, — первый экран: её грузим сразу и раньше остального
  // (think-different, итерация 99). С loading="lazy" браузер ждал раскладки и брал её последней:
  // на телефоне обложка «Как выбрать платформу» появлялась через 1,3 с после текста.
  const eagerLead = (tree) => {
    const first = (tree.children || []).find((k) => k.type === 'element');
    if (!first || (first.tagName !== 'p' && first.tagName !== 'figure')) return;
    const img = (first.children || []).find((k) => k.type === 'element');
    if (!img || img.tagName !== 'img') return;
    delete img.properties.loading;
    img.properties.fetchPriority = 'high';
  };

  return (tree) => {
    heading = '';
    used.clear();
    ids.clear();
    walk(tree);
    eagerLead(tree);
    wrapImages(tree);
  };
}
