// Знак «Эмилиус Эдженси» (версия сентября 2026): скруглённый треугольник
// со спектральной обводкой и серым сердцем внутри.
//
// Цвет обводки зависит от угла вокруг центра знака — как на исходном макете:
// зелёный на вершине, красный справа сверху, жёлтый внизу, синий слева.
// SVG не умеет конический градиент по обводке, поэтому контур собирается
// из коротких отрезков, каждый своего цвета.
//
// Один генератор используется и для логотипа на сайте, и для иконок (scripts/build-brand.mjs).

// Координаты в единицах viewBox 0 0 181 174 (снято с макета 1138×303).
const VIEW = { w: 181, h: 174 };
const R = 20; // радиус скругления углов (по средней линии обводки)
const STROKE = 5.4;
const CENTERS = [
  [90.5, 23], // вершина
  [158, 151], // правый нижний угол
  [23, 151], // левый нижний угол
];
const HUB = [90.5, 107.9]; // центр, от которого считается угол цвета

// Цвет обводки через каждые 10° (0° — вверх, по часовой стрелке).
const SPECTRUM = [
  '#35fe63', '#87af5b', '#fd374d', '#fd364d', '#aa8a57', '#87ae5b', '#5fd55e', '#4ee55f', '#41f461',
  '#36ff62', '#37ff61', '#49fc5e', '#79f252', '#a3ea49', '#c0e443', '#dadf3d', '#f3db38', '#fed835',
  '#f0db3e', '#d3e04b', '#b6e65b', '#97ec6b', '#48fb94', '#35ff9e', '#35fba2', '#35f4a8', '#35f0ab',
  '#35ebb1', '#35e6b5', '#35e0ba', '#35d9bf', '#36c0d7', '#35abe9', '#3592fe', '#3593fe', '#35f176',
];

const HEART_COLOR = '#9a9fa0'; // плотнее прежнего #a7a7a7: читается на пастельной заливке и на 16 px
// Сердце: контур Material Icons (поле 24×24), растянутый в прямоугольник 67×57 с левым верхним углом (56, 80).
const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
const HEART_TRANSFORM = 'matrix(3.35 0 0 3.106 49.3 70.68)';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function colorAt(deg) {
  // центры корзин — на 5°, 15°, 25°…
  const pos = (((deg - 5) % 360) + 360) % 360 / 10;
  const i = Math.floor(pos);
  const t = pos - i;
  const a = hex(SPECTRUM[i % SPECTRUM.length]);
  const b = hex(SPECTRUM[(i + 1) % SPECTRUM.length]);
  return toHex(a.map((v, k) => v + (b[k] - v) * t));
}

// Точки средней линии контура по часовой стрелке: дуга у каждого угла + прямая до следующего.
function outline(step = 2) {
  const pts = [];
  const n = CENTERS.length;
  const normals = CENTERS.map((p, i) => {
    const q = CENTERS[(i + 1) % n];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    return [dy / len, -dx / len]; // внешняя нормаль ребра p→q (обход по часовой, ось y вниз)
  });
  for (let i = 0; i < n; i++) {
    const c = CENTERS[i];
    const nIn = normals[(i + n - 1) % n];
    const nOut = normals[i];
    let a0 = Math.atan2(nIn[1], nIn[0]);
    let a1 = Math.atan2(nOut[1], nOut[0]);
    while (a1 < a0) a1 += Math.PI * 2;
    const arcSteps = Math.max(2, Math.ceil(((a1 - a0) * R) / step));
    for (let k = 0; k <= arcSteps; k++) {
      const a = a0 + ((a1 - a0) * k) / arcSteps;
      pts.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)]);
    }
    const next = CENTERS[(i + 1) % n];
    const p0 = [c[0] + R * nOut[0], c[1] + R * nOut[1]];
    const p1 = [next[0] + R * nOut[0], next[1] + R * nOut[1]];
    const lineSteps = Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / step);
    for (let k = 1; k < lineSteps; k++) {
      pts.push([p0[0] + ((p1[0] - p0[0]) * k) / lineSteps, p0[1] + ((p1[1] - p0[1]) * k) / lineSteps]);
    }
  }
  return pts;
}

const f = (v) => +v.toFixed(2);

// Пастельный оттенок цвета обводки: доля цвета поверх белого.
const tint = (hexColor, amount) => toHex(hex(hexColor).map((v) => 255 + (v - 255) * amount));

/**
 * Внутренности SVG знака (без обёртки <svg>).
 * fill      — пастельная заливка внутри: тот же спектр по кругу, почти белый
 *             (как стеклянный диск колеса). Для крупных размеров.
 * heartColor — цвет сердца.
 * idPrefix  — префикс id для clipPath/filter, если на странице несколько знаков.
 */
export function markInner({ step = 2.5, heart = true, stroke = STROKE, fill = false, fillAmount = 0.12, heartColor = HEART_COLOR, idPrefix = 'm' } = {}) {
  const pts = outline(step);
  const angleOf = (p, q) => {
    const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    return ((Math.atan2(mid[1] - HUB[1], mid[0] - HUB[0]) * 180) / Math.PI + 90 + 360) % 360;
  };
  const segs = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return `<path d="M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}" stroke="${colorAt(angleOf(p, q))}"/>`;
  });
  // Заливка — веер треугольников от центра к контуру, каждый своего оттенка.
  // Обводка того же цвета закрывает щели сглаживания между соседними клиньями.
  let fillEl = '';
  if (fill) {
    const wedges = pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const c = tint(colorAt(angleOf(p, q)), fillAmount);
      return `<path d="M${f(HUB[0])} ${f(HUB[1])}L${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}Z" fill="${c}" stroke="${c}" stroke-width="0.8"/>`;
    });
    // Размытие убирает «лучи» между клиньями; контур ограничивает заливку формой знака.
    const poly = pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');
    fillEl =
      `<defs><clipPath id="${idPrefix}clip"><polygon points="${poly}"/></clipPath>` +
      `<filter id="${idPrefix}soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter></defs>` +
      `<g class="mark-fill" clip-path="url(#${idPrefix}clip)"><g filter="url(#${idPrefix}soft)">${wedges.join('')}</g></g>`;
  }
  const heartEl = heart ? `<path d="${HEART_PATH}" transform="${HEART_TRANSFORM}" fill="${heartColor}"/>` : '';
  return `${fillEl}<g fill="none" stroke-width="${stroke}" stroke-linecap="round">${segs.join('')}</g>${heartEl}`;
}

/** Готовый SVG знака. padding — поля вокруг в единицах viewBox (для квадратных иконок). */
export function markSvg({ square = false, padding = 0, ...opts } = {}) {
  let { w, h } = VIEW;
  let x = -padding;
  let y = -padding;
  w += padding * 2;
  h += padding * 2;
  if (square) {
    const side = Math.max(w, h);
    x -= (side - w) / 2;
    y -= (side - h) / 2;
    w = h = side;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x)} ${f(y)} ${f(w)} ${f(h)}">${markInner(opts)}</svg>`;
}

export const MARK_VIEWBOX = `0 0 ${VIEW.w} ${VIEW.h}`;
export const MARK_RATIO = VIEW.w / VIEW.h;
