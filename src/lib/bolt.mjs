// Знак-молния — основной знак с 21.10.2026 (решение владельца).
// Исходники — design/logo-bolt/: bolt-master.svg (цвета участками, как в Figma) и bolt-small.svg
// (толстая линия для 16–48 px). Здесь только чтение и подготовка для сайта и картинок.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIR = resolve(import.meta.dirname, '../../design/logo-bolt');
const files = { master: 'bolt-master.svg', small: 'bolt-small.svg' };

/**
 * @param {{ small?: boolean, square?: boolean, padding?: number, idPrefix?: string }} [opts]
 *   small — версия для иконок; square — вписать в квадрат (favicon, заставка);
 *   idPrefix — чтобы два знака на одной странице не делили id градиентов и масок.
 */
export function boltSvg({ small = false, square = false, padding = 0, idPrefix = 'b' } = {}) {
  let svg = readFileSync(join(DIR, small ? files.small : files.master), 'utf8').trim();
  svg = svg.replace(/id="([^"]+)"/g, `id="${idPrefix}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#${idPrefix}-$1)`);
  if (!square) return svg;

  // Квадрат: исходный знак вложенным <svg> по центру
  const [vx, vy, vw, vh] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const side = Math.max(vw, vh) + padding * 2;
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const x = (side - vw) / 2;
  const y = (side - vh) / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}">` +
    `<svg x="${x}" y="${y}" width="${vw}" height="${vh}" viewBox="${vx} ${vy} ${vw} ${vh}">${inner}</svg></svg>`
  );
}
