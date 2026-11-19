// Видео для превью галереи /projects/: плавная прокрутка сайта клиента сверху вниз.
// Запуск: node scripts/record-gallery.mjs [id ...]  (без id — все проекты)
//         node scripts/record-gallery.mjs --phone [id ...]  — мобильная версия (iPhone 13) для окна просмотра,
//         в public/video/gallery/phone/
// Нужны Google Chrome (через Playwright, отдельный пустой профиль) и ffmpeg.
// Всплывающие окна (cookie, выбор города, промокод) не нажимаем — скрываем на время записи.
// Текст на сайте клиента не подменяем.
import { chromium, devices } from 'playwright';
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
// Снимок галереи — первый кадр этой же записи (public/cases/gallery/{id}-1600.webp и -800.webp): превью и окно
// просмотра показывают его, а видео начинается с него же — переход «снимок → видео» без шва.
// Поэтому кадры снимаем сразу в 1600×1000 (масштаб 1600/1440), видео уменьшаем до 1280×800.
const STILL = 1600;
const FPS = 30;
const HOLD = 1.0; // секунд на первом экране
const SPEED = 330; // px в секунду
const MAX_SCROLL = 5600; // дальше не листаем: превью не длиннее ~18 с
const POPUP = /cookie|куки|адрес доставки|промокод|первую покупку|подписаться на рассылку|обработк\S* (персональных )?данных/i;

const args = process.argv.slice(2);
const PHONE = args.includes('--phone');
const picked = args.filter((a) => a !== '--phone');
const ids = picked.length ? picked : Object.keys(SITES);
// Телефон: iPhone 13: видимая часть 390×664 (без панелей Safari), снимаем и храним в 2× (780 px): в окне просмотра телефон шириной 390 px, на Retina — 780 точек
const SHOT = PHONE
  ? { view: { width: 390, height: 844 }, speed: 260, max: 4200, outDir: 'public/video/gallery/phone', scale: '780:-2', crf: '32' }
  : { view: VIEW, speed: SPEED, max: MAX_SCROLL, outDir: 'public/video/gallery', scale: `${OUT.width}:${OUT.height}`, crf: '30' };
mkdirSync(SHOT.outDir, { recursive: true });

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

async function record(browser, id) {
  const context = await browser.newContext({
    ...(PHONE ? { ...devices['iPhone 13'], deviceScaleFactor: 2 } : { viewport: VIEW, deviceScaleFactor: STILL / VIEW.width }),
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  });
  const page = await context.newPage();
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
  const dist = Math.max(0, Math.min(height - SHOT.view.height, SHOT.max));
  for (let y = 0; y <= dist + SHOT.view.height; y += 600) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(1500);
  }
  // Ждём картинки, до которых дошла прокрутка (не дольше 20 с)
  await page
    .waitForFunction(() => [...document.images].every((i) => i.complete || i.loading === 'lazy'), null, { timeout: 20000 })
    .catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(4000);
  // Видео на первом экране сайта (Zalina) после возврата наверх грузится заново — ждём, пока оно пойдёт
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('video')]
          .filter((v) => { const r = v.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 100; })
          .every((v) => v.readyState >= 3 && !v.paused),
      null,
      { timeout: 15000 },
    )
    .catch(() => {});
  // У Zalina ролик на первом экране начинается с заставки-титра (~1,5 с) — ждём, пока пойдёт само видео,
  // иначе первый кадр, а с ним и снимок галереи, — пустой белый экран
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('video')]
          .filter((v) => { const r = v.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 100; })
          .every((v) => v.currentTime >= 2),
      null,
      { timeout: 10000 },
    )
    .catch(() => {});
  await page.waitForTimeout(1500);
  await hide();

  const dir = mkdtempSync(join(tmpdir(), `rec-${id}-`));
  const scrollFrames = Math.round((dist / SHOT.speed) * FPS);
  const holdFrames = Math.round(HOLD * FPS);
  let n = 0;
  for (let i = 0; i < holdFrames + scrollFrames + holdFrames; i++) {
    const k = Math.min(Math.max(i - holdFrames, 0), scrollFrames);
    const y = scrollFrames ? Math.round(ease(k / scrollFrames) * dist) : 0;
    if (i % 30 === 0) await hide(); // окна, что всплывают с задержкой
    await page.evaluate((v) => window.scrollTo(0, v), y);
    const frame = join(dir, `${String(n++).padStart(5, '0')}.jpg`);
    // Первый кадр — одним снимком без потерь: из него и снимок галереи, и кадр 0 видео
    // (два снимка подряд расходятся — карусель на сайте успевает сдвинуться)
    if (i === 0 && !PHONE) {
      await page.screenshot({ path: join(dir, 'still.png') });
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(dir, 'still.png'), '-q:v', '2', frame]);
    } else await page.screenshot({ path: frame, type: 'jpeg', quality: 90 });
  }
  await context.close();
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', join(dir, '%05d.jpg'),
    '-vf', `scale=${SHOT.scale}:flags=lanczos`, '-an', '-c:v', 'libx264', '-profile:v', 'high',
    '-pix_fmt', 'yuv420p', '-crf', SHOT.crf, '-preset', 'slow', '-movflags', '+faststart',
    `${SHOT.outDir}/${id}.mp4`]);
  // Лёгкая копия 640 px для телефона и узких превью (src/lib/preview-video.ts); мобильной записи не нужна
  if (!PHONE) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `public/video/gallery/${id}.mp4`, '-an',
    '-vf', 'scale=640:-2:flags=lanczos', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-crf', '31', '-preset', 'slow', '-movflags', '+faststart', `public/video/gallery/${id}-640.mp4`]);
  // Постер мобильного видео — его первый кадр: в окне просмотра вместо пустого поля, пока видео грузится.
  // Мобильный снимок постером не годится: он часто с каталога, а видео начинается с главной — был бы скачок
  if (PHONE) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${SHOT.outDir}/${id}.mp4`, '-frames:v', '1',
    '-c:v', 'libwebp', '-quality', '75', `${SHOT.outDir}/${id}.webp`]);
  if (!PHONE) for (const w of [STILL, STILL / 2]) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(dir, 'still.png'),
    '-vf', `scale=${w}:-2:flags=lanczos`, '-c:v', 'libwebp', '-quality', '82', `public/cases/gallery/${id}-${w}.webp`]);
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
