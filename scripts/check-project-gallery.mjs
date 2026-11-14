// Проверка реальных данных собранной галереи без браузера, сети и отправки форм.
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {projectInquiry, inquiryMessage} from '../src/lib/project-inquiry.ts';

assert.equal(projectInquiry('unknown'), null);
assert.equal(projectInquiry('__proto__'), null);
assert.equal(projectInquiry('<script>alert(1)</script>'), null);
assert.equal(projectInquiry(null), null);
assert.equal(projectInquiry('duman').name, 'Duman');
assert.equal(inquiryMessage('', 'duman'), 'Хочу похожий магазин, как Duman.\n\n');
assert.equal(inquiryMessage('Уже описал свою задачу', 'duman'), 'Уже описал свою задачу');
assert.equal(inquiryMessage('', 'unknown'), '');
assert.match(inquiryMessage('', 'navalishenskoe'), /^Хочу похожий сайт/);

const html = readFileSync('dist/projects/index.html', 'utf8');
const serialized = html.match(/<script\b[^>]*id="project-media"[^>]*>([\s\S]*?)<\/script>/)?.[1];
assert(serialized, 'project-media manifest missing');
const projects = JSON.parse(serialized);
// 6 исходных + 5 из карточки партнёра inSales (13.11.2026). Mansen не показываем: сайт ушёл с inSales.
assert.equal(Object.keys(projects).length, 11);
assert(!projects.mansen);
let screens = 0;
for (const [id, project] of Object.entries(projects)) {
  assert.equal(projectInquiry(id).name, project.name);
  const inquiry = new URL(project.inquiry, 'https://emilius.agency');
  assert.equal(inquiry.pathname, '/');
  assert.equal(inquiry.searchParams.get('project'), id);
  assert.equal(inquiry.hash, '#feedback');
  assert(project.screens.some(screen => screen.device === 'desktop'));
  const keys = new Set();
  for (const screen of project.screens) {
    assert(['desktop', 'phone'].includes(screen.device));
    assert(screen.label && screen.width > 0 && screen.height > 0);
    assert(existsSync(`dist${screen.src}`), `missing: ${screen.src}`);
    const key = `${screen.device}/${screen.label}`;
    assert(!keys.has(key), `duplicate screen: ${id}/${key}`);
    keys.add(key);
    screens += 1;
  }
}
// Этот сохранённый снимок показывает «Вкусдом», а проект — LimeMart.
assert(!projects.wizzu.screens.some(screen => screen.src.includes('/mobile/wizzu')));
assert(projects.duman.screens.some(screen => screen.device === 'phone' && screen.label === 'Каталог'));
console.log(`Gallery passed: ${Object.keys(projects).length} projects, ${screens} real screens, contextual links and safe inquiry prefilling.`);
