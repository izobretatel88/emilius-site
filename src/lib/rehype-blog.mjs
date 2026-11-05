// Доводка HTML статьи блога после разбора markdown. Подключается в astro.config.mjs.
//  - корневые адреса картинок и ссылок (/blog/…) получают BASE_PATH: на превью сайт лежит в подпапке;
//  - у картинок из public/ берём размеры из самого файла WebP и включаем ленивую загрузку:
//    без размеров страница прыгает, когда картинки догружаются;
//  - таблицы оборачиваем в блок с горизонтальной прокруткой для узких экранов;
//  - внешние ссылки получают rel="noopener";
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
          } else if (isRoot(props.href)) props.href = base + props.href;
          else if (isExternal(props.href)) props.rel = 'noopener';
        }
        if (/^h[2-4]$/.test(child.tagName)) heading = textOf(child).replace(/\s+/g, ' ').trim();
        if (child.tagName !== 'code' && child.tagName !== 'pre') walk(child);
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
          // tabindex: широкую таблицу можно листать стрелками, не только мышью и пальцем
          return { type: 'element', tagName: 'div', properties: { className: ['table-wrap'], tabIndex: 0, role: 'region', ariaLabel: tableLabel() }, children: [child] };
        }
      }
      return child;
    });
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

  return (tree) => {
    heading = '';
    used.clear();
    walk(tree);
    wrapImages(tree);
  };
}
