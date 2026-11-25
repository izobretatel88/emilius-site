import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { rehypeBlog } from './src/lib/rehype-blog.mjs';
import { readBlogReleases } from './src/lib/blog-releases.mjs';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glueHtml } from './src/lib/typograph.mjs';

// Опубликованные статьи для продакшен-сборки: очередь панели (BLOG_RELEASES), а без неё — все без draft: true.
// Ссылки из статей на неопубликованные rehypeBlog превращает в текст, чтобы на сайте не было битых ссылок.
function publishedPosts() {
  const fromQueue = readBlogReleases();
  if (fromQueue) return fromQueue;
  const dir = './src/content/blog';
  return new Map(readdirSync(dir).filter((f) => f.endsWith('.md'))
    .filter((f) => !/^draft:\s*true\b/m.test(readFileSync(`${dir}/${f}`, 'utf8').split(/^---\s*$/m)[1] ?? ''))
    .map((f) => [f.slice(0, -3), '']));
}

// lastmod в карте сайта — только там, где дата честная: у статей из `updated` (или `date`), у списка блога — самая свежая.
// Остальным страницам дату не ставим: их тексты собираются из данных и компонентов, и дата коммита страницы врала бы.
function blogLastmod() {
  const dir = './src/content/blog';
  const out = new Map();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const fm = readFileSync(`${dir}/${f}`, 'utf8').split(/^---\s*$/m)[1] ?? '';
    const d = (fm.match(/^updated:\s*"?(\d{4}-\d{2}-\d{2})/m) ?? fm.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})/m))?.[1];
    if (d) out.set(f.slice(0, -3), d);
  }
  return out;
}
const BLOG_LASTMOD = blogLastmod();
// Свежесть списка блога — по опубликованным статьям, черновики не в счёт
const PUBLISHED = publishedPosts();
const BLOG_INDEX_LASTMOD = [...BLOG_LASTMOD].filter(([id]) => PUBLISHED.has(id)).map(([, d]) => d).sort().at(-1);
function withLastmod(item) {
  const m = item.url.match(/\/blog\/(?:([^/]+)\/)?$/);
  if (!m) return item;
  const d = m[1] ? BLOG_LASTMOD.get(m[1]) : BLOG_INDEX_LASTMOD;
  return d ? { ...item, lastmod: new Date(`${d}T00:00:00Z`).toISOString() } : item;
}

// Один и тот же код собирается под два адреса:
//  - превью на GitHub Pages: SITE_URL=https://<логин>.github.io  BASE_PATH=/emilius-site  PREVIEW=1
//  - продакшен (Бегет):      SITE_URL=https://emilius.agency      BASE_PATH=/
// PREVIEW=1 закрывает сборку от поисковиков, чтобы превью не спорило с основным доменом.
// Типограф по готовым страницам: неразрывные пробелы в числах, датах, перед тире и после однобуквенных
// предлогов (src/lib/typograph.mjs). Один проход по всему HTML после сборки вместо glue() в каждом компоненте:
// политика, согласие, Meetings, подводки и подписи карточек иначе оставались без него.
// Код, скрипты, стили, поля ввода и атрибуты не трогаем.
const typograph = {
  name: 'emilius-typograph',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const root = fileURLToPath(dir);
      for (const file of readdirSync(root, { recursive: true })) {
        if (!String(file).endsWith('.html')) continue;
        const path = join(root, String(file));
        const html = readFileSync(path, 'utf8');
        const glued = glueHtml(html);
        if (glued !== html) writeFileSync(path, glued);
      }
    },
  },
};

export default defineConfig({
  site: process.env.SITE_URL || 'https://emilius.agency',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  // Весь CSS сайта ~6 КБ — встраиваем в страницу, чтобы не ждать отдельных файлов перед отрисовкой
  build: { format: 'directory', inlineStylesheets: 'always' },
  // /os/ — эксперимент «Emilius как операционная система» (docs/concept), в карту сайта не попадает
  // Markdown используется только в блоге (src/content/blog): подсветку кода не подключаем, блок кода оформляем сами,
  // а плагин rehypeBlog докручивает картинки, ссылки и таблицы статьи (см. src/lib/rehype-blog.mjs).
  markdown: { syntaxHighlight: false, rehypePlugins: [[rehypeBlog, { base: process.env.BASE_PATH || '/', releases: process.env.PREVIEW === '1' ? null : publishedPosts() }]] },
  integrations: [typograph, sitemap({ filter: (page) => !page.includes('/404') && !page.includes('/os/') && !page.includes('/experiments/') && !page.includes('/styleguide/') && !page.includes('/insales-shop/v2'), serialize: withLastmod })],
});
