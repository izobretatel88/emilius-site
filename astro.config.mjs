import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { rehypeBlog } from './src/lib/rehype-blog.mjs';
import { readBlogReleases } from './src/lib/blog-releases.mjs';
import { readdirSync, readFileSync } from 'node:fs';

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

// Один и тот же код собирается под два адреса:
//  - превью на GitHub Pages: SITE_URL=https://<логин>.github.io  BASE_PATH=/emilius-site  PREVIEW=1
//  - продакшен (Бегет):      SITE_URL=https://emilius.agency      BASE_PATH=/
// PREVIEW=1 закрывает сборку от поисковиков, чтобы превью не спорило с основным доменом.
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
  integrations: [sitemap({ filter: (page) => !page.includes('/404') && !page.includes('/os/') && !page.includes('/experiments/') && !page.includes('/styleguide/') })],
});
