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

// Пробел между разрядами числа, перед ₽ или % и перед тире — неразрывный: тире не начинает строку. Код в <code>/<pre> не трогаем.
const NBSP = '\u00a0';
const glueNumbers = (text) => {
  let out = text;
  for (let prev = ''; prev !== out; ) {
    prev = out;
    out = out.replace(/(\d) (\d{3})(?!\d)/g, `$1${NBSP}$2`);
  }
  return out.replace(/(\d) ([₽%])/g, `$1${NBSP}$2`).replace(/ —/g, `${NBSP}—`);
};

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
          if (isRoot(props.href)) props.href = base + props.href;
          else if (isExternal(props.href)) props.rel = 'noopener';
        }
        if (/^h[2-4]$/.test(child.tagName)) heading = textOf(child).replace(/\s+/g, ' ').trim();
        if (child.tagName !== 'code' && child.tagName !== 'pre') walk(child);
        if (child.tagName === 'table') {
          // tabindex: широкую таблицу можно листать стрелками, не только мышью и пальцем
          return { type: 'element', tagName: 'div', properties: { className: ['table-wrap'], tabIndex: 0, role: 'region', ariaLabel: tableLabel() }, children: [child] };
        }
      }
      return child;
    });
  };

  return (tree) => {
    heading = '';
    used.clear();
    walk(tree);
  };
}
