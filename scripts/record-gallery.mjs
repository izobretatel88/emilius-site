// Видео для превью галереи /projects/: плавная прокрутка сайта клиента сверху вниз.
// Запуск: node scripts/record-gallery.mjs [id ...]  (без id — все проекты)
// Нужны Google Chrome (через Playwright, отдельный пустой профиль) и ffmpeg.
// Всплывающие окна (cookie, выбор города, промокод) не нажимаем — скрываем на время записи.
// Текст на сайте клиента не подменяем.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SITES = {
  alohagaia: 'https://alohagaia.ru/',
  happyanimal: 'https://happyanimal.pet/',
  duman: 'https://duman.store/',
  wizzu: 'https://limemart.wizzu.ru/',
  geekboards: 'https://geekboards.ru/',
  zalina: 'https://zalina.me/',
  mnogoles: 'https://xn--c1aercfgb0a.xn--p1ai/',
  almatennis: 'https://almatennis.ru/',
  'ss-sk': 'https://ss-sk.ru/',
  nsorganic: 'https://nsorganic.ru/',
  navalishenskoe: 'https://navalishenskoe.ru/',
};

const VIEW = { width: 1440, height: 900 }; // 8:5 — как снимки галереи
const OUT = { width: 1280, height: 800 };
const FPS = 30;
const HOLD = 1.0; // секунд на первом экране
const SPEED = 330; // px в секунду
const MAX_SCROLL = 5600; // дальше не листаем: превью не длиннее ~18 с
const POPUP = /cookie|куки|адрес доставки|промокод|первую покупку|подписаться на рассылку/i;

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SITES);
mkdirSync('public/video/gallery', { recursive: true });

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

async function record(browser, id) {
  const page = await browser.newPage({ viewport: VIEW, locale: 'ru-RU', timezoneId: 'Europe/Moscow' });
  await page.goto(SITES[id], { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);
  const hide = () =>
    page.evaluate((src) => {
      const re = new RegExp(src, 'i');
      for (const el of document.querySelectorAll('body *')) {
        const pos = getComputedStyle(el).position;
        if (pos !== 'fixed' && pos !== 'absolute') continue;
        const text = el.innerText || '';
        if (!text || text.length > 600 || !re.test(text)) continue;
        // Шапку и меню не трогаем: окно выбора города бывает вложено в шапку — скрываем само окно
        if (el.matches('header, nav') || el.querySelector('header, nav') || el.querySelectorAll('a').length > 4) continue;
        if (el.getBoundingClientRect().height > innerHeight * 0.8) continue;
        el.style.setProperty('display', 'none', 'important');
      }
      document.documentElement.style.scrollBehavior = 'auto';
    }, POPUP.source);
  await hide();
  // Прогреваем ленивую загрузку картинок: проходим страницу и возвращаемся наверх
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const dist = Math.max(0, Math.min(height - VIEW.height, MAX_SCROLL));
  for (let y = 0; y <= dist + VIEW.height; y += 600) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(1500);
  }
  // Ждём картинки, до которых дошла прокрутка (не дольше 20 с)
  await page
    .waitForFunction(() => [...document.images].every((i) => i.complete || i.loading === 'lazy'), null, { timeout: 20000 })
    .catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(4000);
  await hide();

  const dir = mkdtempSync(join(tmpdir(), `rec-${id}-`));
  const scrollFrames = Math.round((dist / SPEED) * FPS);
  const holdFrames = Math.round(HOLD * FPS);
  let n = 0;
  for (let i = 0; i < holdFrames + scrollFrames + holdFrames; i++) {
    const k = Math.min(Math.max(i - holdFrames, 0), scrollFrames);
    const y = scrollFrames ? Math.round(ease(k / scrollFrames) * dist) : 0;
    if (i % 30 === 0) await hide(); // окна, что всплывают с задержкой
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.screenshot({ path: join(dir, `${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 });
  }
  await page.close();
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', join(dir, '%05d.jpg'),
    '-vf', `scale=${OUT.width}:${OUT.height}:flags=lanczos`, '-an', '-c:v', 'libx264', '-profile:v', 'high',
    '-pix_fmt', 'yuv420p', '-crf', '30', '-preset', 'slow', '-movflags', '+faststart',
    `public/video/gallery/${id}.mp4`]);
  rmSync(dir, { recursive: true, force: true });
  console.log(id, `${(n / FPS).toFixed(1)} с, прокрутка ${dist}px`);
}

const browser = await chromium.launch({ channel: 'chrome' });
const queue = [...ids];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const id = queue.shift();
      try { await record(browser, id); } catch (e) { console.log(id, 'ошибка:', e.message.split('\n')[0]); }
    }
  }),
);
await browser.close();
