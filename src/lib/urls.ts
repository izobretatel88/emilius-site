import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Снимки и видео галереи переснимают под тем же именем, а браузер и GitHub Pages держат старый файл в кэше.
// К их адресу добавляем метку из содержимого файла: пересняли — адрес новый, все сразу видят новую версию.
const VERSIONED = /^(cases|video)\/gallery\//;
const versions = new Map<string, string>();
const version = (path: string) => {
  if (!versions.has(path)) {
    let tag = '';
    try { tag = createHash('md5').update(readFileSync(`public/${path}`)).digest('hex').slice(0, 8); } catch {}
    versions.set(path, tag);
  }
  return versions.get(path);
};

export const href = (path = '') => {
  const clean = path.replace(/^\//, '');
  const tag = VERSIONED.test(clean) ? version(clean) : '';
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${clean}${tag ? `?v=${tag}` : ''}`;
};
