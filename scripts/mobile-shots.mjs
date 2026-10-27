// Мобильные версии для лендинга InSales: из макета «телефон на бежевом фоне» (1005×1986)
// вырезает телефон целиком, фон вокруг делает прозрачным, сохраняет webp в public/cases/mobile/.
// Экран не обрезается: рамка телефона — из самого макета.
// node scripts/mobile-shots.mjs <папка с макетами> id1 id2 ...  — макеты 1.jpg, 2.jpg… по порядку id.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const [dir, ...ids] = process.argv.slice(2);
const OUT = 'public/cases/mobile';
const WIDTH = 520;
const BG = [237, 236, 231]; // бежевый фон макета
const FRAME = [119, 118, 116]; // серая рамка телефона
const TOP = 300; // выше — название и подпись макета, их не берём

mkdirSync(OUT, { recursive: true });
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

for (const [n, id] of ids.entries()) {
  const { data, info } = await sharp(`${dir}/${n + 1}.jpg`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  // Заливка фона от краёв картинки: всё бежевое, до чего можно дойти снаружи, — прозрачное.
  const bg = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(TOP * w + x, (h - 1) * w + x);
  for (let y = TOP; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || dist(px(i), BG) > 12) continue;
    bg[i] = 1;
    const x = i % w, y = (i - x) / w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > TOP) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  // Сглаженный край рамки: полупрозрачный серый вместо смеси с бежевым, чтобы не было ореола на тёмной теме.
  const rgba = Buffer.alloc(w * h * 4);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = TOP; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = px(i);
      let a = 255;
      let out = c;
      if (bg[i]) a = 0;
      else if (bg[i - 1] || bg[i + 1] || bg[i - w] || bg[i + w]) {
        a = Math.round(255 * Math.min(1, dist(c, BG) / dist(FRAME, BG)));
        out = FRAME;
      }
      rgba.set([...out, a], i * 4);
      if (a) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
  }
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize({ width: WIDTH })
    .webp({ quality: 80, alphaQuality: 90 })
    .toFile(`${OUT}/${id}.webp`);
  console.log(id, `${x1 - x0 + 1}×${y1 - y0 + 1}`);
}
