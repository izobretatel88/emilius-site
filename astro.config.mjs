import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Один и тот же код собирается под два адреса:
//  - превью на GitHub Pages: SITE_URL=https://<логин>.github.io  BASE_PATH=/emilius-site  PREVIEW=1
//  - продакшен (Бегет):      SITE_URL=https://emilius.agency      BASE_PATH=/
// PREVIEW=1 закрывает сборку от поисковиков, чтобы превью не спорило с основным доменом.
export default defineConfig({
  site: process.env.SITE_URL || 'https://emilius.agency',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
});
