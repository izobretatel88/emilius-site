import type { APIRoute } from 'astro';

// Превью закрыто от индексации целиком, продакшен открыт и отдаёт карту сайта.
export const GET: APIRoute = ({ site }) => {
  const preview = process.env.PREVIEW === '1';
  const sitemap = new URL(`${import.meta.env.BASE_URL.replace(/\/?$/, '/')}sitemap-index.xml`, site);
  const body = preview
    ? ['User-agent: *', 'Disallow: /', ''].join('\n')
    : ['User-agent: *', 'Allow: /', '', `Sitemap: ${sitemap}`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
