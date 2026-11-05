import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createServer } from 'node:http';
import { load } from 'js-yaml';
import { readBlogReleases } from '../../src/lib/blog-releases.mjs';
import { renderPanel } from './panel.mjs';

const host = '127.0.0.1:4323';
const origin = `http://${host}`;
const csrf = randomBytes(32).toString('hex');
const {
  BLOG_PUBLISHING_STATE: stateFile,
  BLOG_PUBLISHING_DEPLOY: release,
  BLOG_PUBLISHING_PASSWORD: password,
} = process.env;
if (release && (!password || password.length < 24)) {
  throw new Error('Для выкладки задайте BLOG_PUBLISHING_PASSWORD длиной от 24 символов');
}
const digest = (value) => createHash('sha256').update(value).digest();
const credentials = password ? digest('Basic ' + Buffer.from('editor:' + password).toString('base64')) : null;
if (!stateFile || !isAbsolute(stateFile)) {
  throw new Error('Укажите абсолютный путь BLOG_PUBLISHING_STATE вне репозитория');
}
const previewUrl = new URL(process.env.BLOG_PREVIEW_URL ?? 'https://izobretatel88.github.io/emilius-site/dev/');
if (previewUrl.search || previewUrl.hash || previewUrl.username || previewUrl.password ||
    !(previewUrl.protocol === 'https:' || (previewUrl.protocol === 'http:' && previewUrl.hostname === '127.0.0.1'))) {
  throw new Error('BLOG_PREVIEW_URL: нужен базовый адрес HTTPS или локальный Astro');
}
const preview = previewUrl.href.replace(/\/?$/, '/');

const contentDir = 'src/content/blog';
const articles = new Map();
for (const file of await readdir(contentDir)) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(file)) continue;
  const source = await readFile(join(contentDir, file), 'utf8');
  const metadata = load(source.match(/^---\r?\n([\s\S]+?)\r?\n---(?:\r?\n|$)/)?.[1] ?? '');
  if (typeof metadata?.h1 !== 'string') throw new Error(`Нет заголовка у ${file}`);
  articles.set(file.slice(0, -3), metadata.h1);
}

function checkRelease() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(release) || git('rev-parse', 'HEAD') !== release ||
      git('rev-parse', 'origin/main') !== release || git('status', '--porcelain', '--untracked-files=normal')) {
    throw new Error('Для выкладки нужна чистая копия утверждённого коммита origin/main');
  }
  if (!process.env.BEGET_KEY || !process.env.BEGET_SSH || !process.env.BEGET_DIR) {
    throw new Error('Задайте BEGET_KEY, BEGET_SSH и BEGET_DIR для выкладки');
  }
}
if (release) checkRelease();

function assertOutsideCheckout(path) {
  const location = relative(process.cwd(), path);
  if (location !== '..' && !location.startsWith('../')) {
    throw new Error('Файл состояния должен находиться вне рабочей копии');
  }
}
assertOutsideCheckout(resolve(stateFile));
await mkdir(dirname(stateFile), { recursive: true, mode: 0o700 });
assertOutsideCheckout(await realpath(dirname(stateFile)));
let state = { scheduled: {}, published: {} };
try {
  assertOutsideCheckout(await realpath(stateFile));
  state = JSON.parse(await readFile(stateFile, 'utf8'));
  for (const entries of [state.scheduled, state.published]) {
    if (!entries) throw new Error('В состоянии отсутствует очередь или список выпусков');
    const parsed = readBlogReleases(JSON.stringify(entries));
    for (const id of parsed.keys()) {
      if (!articles.has(id)) throw new Error(`Статья из состояния отсутствует в релизе: ${id}`);
    }
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  if (release) throw new Error('Перед первой выкладкой создайте файл состояния со списком уже опубликованных статей');
}

async function save(next) {
  const temporary = `${stateFile}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(temporary, stateFile);
  state = next;
}

let busy = false;
let stopping = false;
let failure = '';
async function publishDue() {
  if (!release || busy || stopping) return;
  const due = Object.entries(state.scheduled).filter(([, time]) => Date.parse(time) <= Date.now())
    .sort(([, a], [, b]) => a.localeCompare(b))[0];
  if (!due) return;
  busy = true;
  const [id] = due;
  const published = { ...state.published, [id]: new Date().toISOString() };
  try {
    checkRelease();
    const env = { ...process.env, BLOG_RELEASES: JSON.stringify(published) };
    delete env.BLOG_PUBLISHING_PASSWORD;
    await new Promise((resolve, reject) => {
      const deploy = spawn('npm', ['run', 'deploy:prod'], {
        stdio: 'inherit',
        env,
      });
      deploy.once('error', reject);
      deploy.once('close', (code) => code === 0 ? resolve() : reject(new Error(`Код выкладки: ${code}`)));
    });
    const scheduled = { ...state.scheduled };
    delete scheduled[id];
    await save({ scheduled, published });
    failure = '';
  } catch (error) {
    console.error(error);
    failure = 'Выкладка не подтверждена. Запись осталась в очереди, повторная попытка через минуту.';
  } finally {
    busy = false;
  }
}

function respond(res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  });
  res.end(body);
}

function panel(res, status = 200, error = '', changed = false) {
  respond(res, status, renderPanel({ articles, state, preview, csrf, busy, failure, error, changed, live: !!release }));
}

const assets = new Map([
  ['/panel.css', ['scripts/blog-publishing/panel.css', 'text/css']],
  ['/tokens.css', ['src/styles/tokens.css', 'text/css']],
  ['/fonts.css', ['src/styles/fonts.css', 'text/css']],
  ['/fonts/glober-400.woff2', ['src/styles/fonts/glober-400.woff2', 'font/woff2']],
  ['/fonts/glober-600.woff2', ['src/styles/fonts/glober-600.woff2', 'font/woff2']],
  ['/brand/logo.png', ['public/brand/logo.png', 'image/png']],
]);
const server = createServer(async (req, res) => {
  try {
    if (req.headers.host !== host) return respond(res, 403, 'Панель доступна по адресу ' + origin);
    if (credentials && !timingSafeEqual(credentials, digest(req.headers.authorization ?? ''))) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Emilius Publishing", charset="UTF-8"');
      return respond(res, 401, 'Введите имя editor и пароль панели.');
    }
    const url = new URL(req.url, origin);
    if (req.method === 'GET' && assets.has(url.pathname)) {
      const [file, type] = assets.get(url.pathname);
      return respond(res, 200, await readFile(file), type);
    }
    if (url.pathname !== '/') return respond(res, 404, 'Страница не найдена');
    if (req.method === 'GET') return panel(res, 200, '', url.searchParams.has('saved'));
    if (req.method !== 'POST' || req.headers.origin !== origin ||
        req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') {
      return panel(res, 403, 'Запрос отклонён. Откройте панель в новой вкладке.');
    }
    let body = '';
    for await (const chunk of req) {
      body += chunk.toString();
      if (body.length > 4096) return panel(res, 413, 'Запрос слишком большой.');
    }
    const form = new URLSearchParams(body);
    const id = form.get('id');
    const action = form.get('action');
    if (form.get('csrf') !== csrf || !articles.has(id) || !['schedule', 'cancel', 'now'].includes(action)) {
      return panel(res, 400, 'Запрос устарел. Обновите панель и повторите действие.');
    }
    if (stopping || busy || state.published[id] || (state.scheduled[id] ?? '') !== form.get('previous')) {
      return panel(res, 409, 'Очередь изменилась. Проверьте текущий статус статьи.');
    }
    const scheduled = { ...state.scheduled };
    if (action === 'cancel') delete scheduled[id];
    if (action === 'now') scheduled[id] = new Date().toISOString();
    if (action === 'schedule') {
      const value = form.get('time') ?? '';
      const date = new Date(value + ':00+03:00');
      const local = new Date(date.getTime() + 3 * 3600_000);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !(date > new Date()) ||
          local.toISOString().slice(0, 16) !== value) {
        return panel(res, 400, 'Укажите будущую дату и время по Москве.');
      }
      const timestamp = date.toISOString();
      if (Object.values(scheduled).includes(timestamp) && scheduled[id] !== timestamp) {
        return panel(res, 409, 'На это время уже запланирована статья. Выберите другое время.');
      }
      scheduled[id] = timestamp;
    }
    busy = true;
    try {
      await save({ ...state, scheduled });
      failure = '';
    } finally {
      busy = false;
    }
    res.writeHead(303, { Location: '/?saved=1' }).end();
    void publishDue();
  } catch (error) {
    console.error(error);
    panel(res, 500, 'Не удалось выполнить действие. Проверьте журнал панели.');
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    stopping = true;
    const drain = setInterval(() => {
      if (busy) return;
      clearInterval(drain);
      server.close(() => process.exit(0));
    }, 100);
  });
}

server.listen(4323, '127.0.0.1', () => {
  console.log(`Публикации — ${origin}${release ? '' : ' (без выкладки)'}`);
  setInterval(publishDue, 60_000);
  void publishDue();
});
