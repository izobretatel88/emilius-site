// Знак-молния: переносимые SVG из исходника Figma (source-figma.svg).
// Figma хранит угловой градиент как HTML внутри SVG (foreignObject) — это видит только
// браузер. Здесь тот же градиент пересобран из клиньев обычного SVG и обрезан по форме знака.
//
//   node design/logo-bolt/build.mjs  →  bolt-master.svg, bolt-small.svg, bolt-line.svg, bolt-line-small.svg
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(DIR, 'source-figma.svg'), 'utf8');
const OUTLINE = src.match(/<clipPath[^>]*><path d="([^"]+)"/)[1]; // контур знака как в Figma

// Градиент из Figma: conic-gradient(from 90deg, …) в системе координат,
// заданной matrix(a b c d e f) у foreignObject.
const [a, b, c, d, e, f] = [-0.0961242, 0.0894614, -0.0588516, -0.14612, 165.176, 138.932];
const STOPS = [
  [0, '#ffd835'], [95.625, '#35ff61'], [174.375, '#3591ff'],
  [234.375, '#35ff61'], [288.75, '#35ff9e'], [360, '#ff354d'],
];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (v) => '#' + v.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
function colorAt(deg) {
  deg = ((deg % 360) + 360) % 360;
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [p0, c0] = STOPS[i];
    const [p1, c1] = STOPS[i + 1];
    if (deg >= p0 && deg <= p1) {
      const t = (deg - p0) / (p1 - p0);
      const A = hex(c0), B = hex(c1);
      return toHex(A.map((v, k) => v + (B[k] - v) * t));
    }
  }
  return STOPS[0][1];
}
const r2 = (v) => +v.toFixed(2);

// Веер клиньев в локальных координатах градиента, переведённый в координаты знака.
// Линейное преобразование переводит треугольник в треугольник, поэтому раскладка цвета точная.
function wedges(n = 240, R = 4000) {
  const map = (x, y) => [a * x + c * y + e, b * x + d * y + f];
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * 360, t1 = ((i + 1.15) / n) * 360;
    // CSS conic: 0° — вверх, по часовой; «from 90deg» сдвигает начало вправо
    const dir = (t) => { const r = ((t + 90) * Math.PI) / 180; return [Math.sin(r) * R, -Math.cos(r) * R]; };
    const [x0, y0] = map(...dir(t0));
    const [x1, y1] = map(...dir(t1));
    out.push(`<path d="M${r2(e)} ${r2(f)}L${r2(x0)} ${r2(y0)}L${r2(x1)} ${r2(y1)}Z" fill="${colorAt((t0 + t1) / 2)}"/>`);
  }
  return out.join('');
}

// Внутренняя тень из Figma: blur 10.5, чёрный 26%.
const innerShadow = (id) =>
  `<filter id="${id}" x="0" y="0" width="215" height="326" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
  `<feFlood flood-opacity="0" result="bg"/><feBlend in="SourceGraphic" in2="bg" result="shape"/>` +
  `<feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha"/>` +
  `<feGaussianBlur stdDeviation="10.477"/><feComposite in2="ha" operator="arithmetic" k2="-1" k3="1"/>` +
  `<feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.26 0"/><feBlend in2="shape"/></filter>`;

// 1. Мастер: геометрия Figma один в один. Для размеров от ~64 px.
const master =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 215 326" width="215" height="326">` +
  `<defs><clipPath id="bolt"><path d="${OUTLINE}"/></clipPath>${innerShadow('ish')}</defs>` +
  `<g filter="url(#ish)"><g clip-path="url(#bolt)">${wedges()}</g></g></svg>`;
writeFileSync(join(DIR, 'bolt-master.svg'), master);

// 2. Мелкая версия для 16–48 px: та же фигура по средней линии, но линия в два раза толще,
//    просвет между горизонталями шире, углы скруглены. Внутренняя тень убрана — в мелком
//    размере она только грязнит цвет.
const SMALL_PATH = 'M14 124 L201 124 L150 15 L72 186 L152 186 L80 311 Z';
const small =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 223 334" width="223" height="334">` +
  `<defs><mask id="line" maskUnits="userSpaceOnUse" x="-4" y="-4" width="223" height="334">` +
  `<path d="${SMALL_PATH}" fill="none" stroke="#fff" stroke-width="24" stroke-linejoin="round" stroke-linecap="round"/></mask></defs>` +
  `<g mask="url(#line)">${wedges(120)}</g></svg>`;
writeFileSync(join(DIR, 'bolt-small.svg'), small);

// 3. Знак с плавным цветом (выбран 24.09.2026): геометрия исходника Figma по средней линии,
//    родные пропорции. Цвет — плавный вертикальный переход вместо кусков углового градиента.
//    Линия 20 — основная (близко к весу надписи «Эмилиус Эдженси» в таблетке),
//    24 — для иконок 16–24 px. Обычный линейный градиент — переносим без ухищрений.
const LINE_PATH = 'M6.5 131 L208 131 L152.6 8.6 L76.3 171 L150 171 L76.5 316.5 Z';
const line = (width, id) => {
  const pad = Math.ceil(width / 2) + 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${215 + pad * 2} ${326 + pad * 2}" width="${215 + pad * 2}" height="${326 + pad * 2}">` +
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="326" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#35d890"/><stop offset=".3" stop-color="#3591ff"/><stop offset=".5" stop-color="#b4e43c"/>` +
    `<stop offset=".75" stop-color="#ffd835"/><stop offset="1" stop-color="#ff354d"/></linearGradient></defs>` +
    `<path d="${LINE_PATH}" fill="none" stroke="url(#${id})" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/></svg>`
  );
};
writeFileSync(join(DIR, 'bolt-line.svg'), line(20, 'boltLine'));
writeFileSync(join(DIR, 'bolt-line-small.svg'), line(24, 'boltLineS'));

console.log('bolt-master.svg, bolt-small.svg, bolt-line.svg, bolt-line-small.svg готовы');
