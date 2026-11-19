// Дата изменения страниц для карты сайта (<lastmod>): по ней поисковики понимают, что появилось и что обновилось.
// Статьи — поле updated (или date) из Markdown, список блога — самая свежая из них.
// Остальные страницы — дата последнего коммита их исходного файла. Нет git или файла — дату не ставим.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const BLOG_DIR = './src/content/blog';

function gitDate(file) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out ? new Date(out).toISOString() : undefined;
  } catch {
    return undefined;
  }
}

function postDate(slug) {
  const file = `${BLOG_DIR}/${slug}.md`;
  if (!existsSync(file)) return undefined;
  const front = readFileSync(file, 'utf8').split(/^---\s*$/m)[1] ?? '';
  const raw = (front.match(/^updated:\s*"?([0-9-]{10})/m) ?? front.match(/^date:\s*"?([0-9-]{10})/m))?.[1];
  return raw ? new Date(`${raw}T00:00:00+03:00`).toISOString() : undefined;
}

// Текст страниц часто живёт в компонентах и данных (InsalesLanding, src/data/…), поэтому дата страницы —
// самая свежая из её файла и прямых импортов. Общий каркас (макеты, шапка, подвал, кнопки) не учитываем:
// иначе любая правка шапки «обновляла» бы все страницы разом.
const SHELL = /\/(layouts\/(Base|Directory|Article)\.astro|components\/(SiteNav|Footer|WriteButton|CookieNotice|Breadcrumbs|Intro|IterationRuler)\.astro|lib\/urls)/;

// Импорты файла: относительные пути, без ?raw и прочих суффиксов, только существующие файлы.
function imports(file) {
  if (!/\.(astro|ts|mjs|js)$/.test(file)) return [];
  const dir = file.split('/').slice(0, -1).join('/');
  return [...readFileSync(file, 'utf8').matchAll(/from\s+['"](\.{1,2}\/[^'"?]+)(?:\?[^'"]*)?['"]/g)]
    .map((m) => new URL(m[1], `file:///${dir}/`).pathname.slice(1))
    .flatMap((p) => [p, `${p}.ts`, `${p}.mjs`, `${p}.js`, `${p}.json`].filter((f) => existsSync(f) && !/\/$/.test(f)).slice(0, 1))
    .filter((f) => !SHELL.test(`/${f}`));
}

// Файл страницы, его импорты и импорты импортов (страница → макет сравнения → HTML с таблицей).
function sourceDate(file) {
  const files = new Set([file]);
  for (let depth = 0, level = [file]; depth < 2; depth++) {
    level = level.flatMap(imports).filter((f) => !files.has(f) && files.add(f));
  }
  return [...files].map(gitDate).filter(Boolean).sort().at(-1);
}

// Исходник страницы по пути без base: services/dev/ → src/pages/services/[id].astro и т. п.
function pageFile(path) {
  const p = path.replace(/^\/+|\/+$/g, '');
  const candidates = p ? [`src/pages/${p}.astro`, `src/pages/${p}/index.astro`] : ['src/pages/index.astro'];
  const parent = p.split('/').slice(0, -1).join('/');
  candidates.push(`src/pages/${parent ? parent + '/' : ''}[id].astro`, `src/pages/${parent ? parent + '/' : ''}[...slug].astro`);
  return candidates.find((f) => existsSync(f));
}

/** @param {string} base — BASE_PATH сборки, @param {Map<string,string>|null} published — опубликованные статьи */
export function lastmodFor(base, published) {
  const prefix = base.replace(/\/+$/, '');
  const slugs = published ? [...published.keys()] : readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  const blogLatest = slugs.map(postDate).filter(Boolean).sort().at(-1);
  return (url) => {
    const path = new URL(url).pathname.slice(prefix.length) || '/';
    const post = path.match(/^\/blog\/([^/]+)\/?$/);
    if (post) return postDate(post[1]);
    if (/^\/blog\/?$/.test(path)) return blogLatest;
    const file = pageFile(path);
    return file ? sourceDate(file) : undefined;
  };
}
