// Доводка HTML статьи блога после разбора markdown. Подключается в astro.config.mjs.
//  - корневые адреса картинок и ссылок (/blog/…) получают BASE_PATH: на превью сайт лежит в подпапке;
//  - у картинок из public/ берём размеры из самого файла WebP и включаем ленивую загрузку:
//    без размеров страница прыгает, когда картинки догружаются;
//  - таблицы оборачиваем в блок с горизонтальной прокруткой для узких экранов;
//  - внешние ссылки получают rel="noopener".
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

const isRoot = (url) => typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');
const isExternal = (url) => typeof url === 'string' && /^https?:\/\//.test(url);

export function rehypeBlog(options = {}) {
  const base = (options.base || '/').replace(/\/$/, ''); // '' для корня, '/emilius-site' для превью

  const walk = (node) => {
    if (!node.children) return;
    node.children = node.children.map((child) => {
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
        walk(child);
        if (child.tagName === 'table') {
          // tabindex: широкую таблицу можно листать стрелками, не только мышью и пальцем
          return { type: 'element', tagName: 'div', properties: { className: ['table-wrap'], tabIndex: 0, role: 'region', ariaLabel: 'Таблица' }, children: [child] };
        }
      }
      return child;
    });
  };

  return (tree) => walk(tree);
}
