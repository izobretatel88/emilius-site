import { defineConfig } from 'astro/config';

// Один и тот же код собирается под два адреса:
//  - превью на GitHub Pages: SITE_URL=https://<логин>.github.io  BASE_PATH=/emilius-site
//  - продакшен (Бегет):      SITE_URL=https://emilius.agency      BASE_PATH=/
export default defineConfig({
  site: process.env.SITE_URL || 'https://emilius.agency',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
