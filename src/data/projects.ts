// Кейсы: «Платформа — ниша» → «что сделали, цифры» → домен ↗
export type Project = {
  id: string;
  name: string;
  logo: string; // путь относительно public/
  about: string;
  did: string;
  url: string;
  domain: string;
};

export const PROJECTS: Project[] = [
  {
    id: 'alohagaia',
    name: 'Aloha Gaia',
    logo: 'projects/alohagaia.svg',
    about: 'Интернет-магазин на inSales — ювелирные украшения с душой.',
    did: 'Фронтенд-разработка, тесная интеграция с inSales и собственные модули.',
    url: 'https://alohagaia.ru/',
    domain: 'alohagaia.ru',
  },
  {
    id: 'wizzu',
    name: 'LimeMart',
    logo: 'projects/wizzu.svg',
    about: 'Интернет-магазин на inSales, доставка продуктов в Чечне — стартап, выросший с 0 до 2000+ заказов в месяц.',
    did: 'Разработали техническую часть стартапа: сайт-витрину и интеграции.',
    url: 'https://limemart.wizzu.ru/',
    domain: 'wizzu.ru',
  },
  {
    id: 'duman',
    name: 'Duman',
    logo: 'projects/duman.svg',
    about: 'Интернет-магазин на inSales — дизайнерская женская одежда премиум-сегмента.',
    did: 'Фронтенд-разработка, сложная архитектура и выразительный UX/UI.',
    url: 'https://www.duman.store/',
    domain: 'duman.store',
  },
  {
    id: 'geekboards',
    name: 'Geekboards',
    logo: 'projects/geekboards.png',
    about: 'Интернет-магазин на inSales — премиальные клавиатуры, мыши и аксессуары, шоурум в Москве.',
    did: 'Развитие магазина на inSales и кастомизация фронтенда.',
    url: 'https://geekboards.ru/',
    domain: 'geekboards.ru',
  },
  {
    id: 'navalishenskoe',
    name: 'Навалишенское',
    logo: 'projects/navalishenskoe.png',
    about: 'Сайт компании на Tilda — одно из топовых мест отдыха в Сочи с уникальной природой и отличным сервисом.',
    did: 'Ежемесячное развитие сайта, SEO-продвижение.',
    url: 'https://navalishenskoe.ru/',
    domain: 'navalishenskoe.ru',
  },
];
