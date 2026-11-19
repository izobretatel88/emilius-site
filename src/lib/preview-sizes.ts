import { href } from './urls';

// Атрибут sizes у превью проекта — по замеру ширины снимка в карточке (19.11.2026), чтобы браузер выбирал
// из 800w/1600w по настоящей ширине. Поля страницы: 16 px до 400, 20 px до 760, дальше 24 px; контейнер до 1190 px.
// Карточка съедает 24 px (поле 10 + рамка 2 с каждой стороны), на телефоне — 20. Колонки — через 28 px.
// Поменялась раскладка — перемерить и поправить здесь.
const PHONE = '(max-width: 400px) calc(100vw - 52px), (max-width: 700px) calc(100vw - 60px)';

export const PREVIEW_SIZES = {
  // Крупная карточка галереи — на всю ширину
  featured: `${PHONE}, (max-width: 760px) calc(100vw - 64px), (max-width: 1238px) calc(100vw - 72px), 1166px`,
  // Галерея: две колонки уже с 701 px
  gallery: `${PHONE}, (max-width: 760px) calc((100vw - 116px) / 2), (max-width: 1238px) calc((100vw - 124px) / 2), 557px`,
  // Главная и направления: одна колонка до 760 px, дальше две
  section: `${PHONE}, (max-width: 760px) calc(100vw - 64px), (max-width: 1238px) calc((100vw - 124px) / 2), 557px`,
};

// Снимки галереи (первый кадр записи) — три ширины: 800 (телефон, обычные экраны), 1200 (сетка на Retina), 1600 (крупная карточка, окно)
export const previewSrcset = (id: string) =>
  [800, 1200, 1600].map((w) => `${href(`cases/gallery/${id}-${w}.webp`)} ${w}w`).join(', ');
