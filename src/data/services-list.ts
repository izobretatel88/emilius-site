// Блок «Услуги» на главной: строки в стиле настроек iPhone. Новые услуги — новой строкой сюда.
// Цена «от» берётся из калькулятора услуги, чтобы не расходиться с лендингом и сметой.
import { PACKAGES } from '../../docs/insales-service/calc/estimate.js';

export type ServiceRow = { id: string; title: string; note: string; href: string; icon: 'cart' };

export const SERVICE_ROWS: ServiceRow[] = [
  {
    id: 'insales-shop',
    title: 'Магазин на шаблоне InSales',
    note: `За 3–5 недель · от\u00a0${(PACKAGES.S.min / 1000).toLocaleString('ru-RU')}\u00a0000\u00a0₽`,
    href: 'services/insales-shop/',
    icon: 'cart',
  },
];
