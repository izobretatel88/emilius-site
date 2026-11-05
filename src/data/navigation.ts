import { SERVICES } from './services';
import { SECTORS } from './site';

export const DIRECTIONS = ['custdev', 'design', 'dev', 'marketing'].map(id => ({
  id, title: SERVICES[id].title, description: SECTORS.find(sector=>sector.id===id)!.text, href: `services/${id}/`,
}));
export const MATERIALS = [
  { title: 'Какую платформу выбрать для магазина', description: 'Восемь платформ: сценарии, ограничения и стоимость. Данные на 30 октября 2026.', href: 'compare/ecommerce-platforms/', label: 'Сравнение' },
  { title: 'InSales и Яндекс KIT: функции подробно', description: '348 пунктов, 19 разделов, способы подключения и официальные источники. Данные на 31 октября 2026.', href: 'compare/insales-vs-yandex-kit/', label: 'Сравнение' },
  { title: 'Калькулятор магазина на InSales', description: 'Семь вопросов о каталоге и интеграциях — ориентир по бюджету и сроку запуска.', href: 'tools/insales-calculator/', label: 'Инструмент' },
];
export const RELATED: Record<string, {title: string; description: string; href: string}[]> = {
  custdev: [
    {title:'Спроектировать решение',description:'Когда потребности пользователей уже понятны.',href:'services/design/'},
    {title:'Проверить гипотезы продвижения',description:'Когда вопрос в спросе и каналах привлечения.',href:'services/marketing/'},
  ],
  design: [
    {title:'Исследовать потребности',description:'Когда ещё неясно, какую задачу решает интерфейс.',href:'services/custdev/'},
    {title:'Реализовать интерфейс',description:'Когда макеты готовы к разработке.',href:'services/dev/'},
  ],
  dev: [
    {title:'Спроектировать интерфейс',description:'Когда нужны свои сценарии и дизайн.',href:'services/design/'},
    {title:'Выбрать платформу магазина',description:'Сравнить возможности и ограничения.',href:'compare/ecommerce-platforms/'},
    {title:'Продавцам WB и Ozon',description:'Свой сайт рядом с маркетплейсами.',href:'services/insales-shop/seller/'},
    {title:'Развивать продукт после запуска',description:'Привлечение, аналитика и следующие улучшения.',href:'services/marketing/'},
  ],
  marketing: [
    {title:'Понять причины отказов',description:'Исследовать опыт клиентов и барьеры покупки.',href:'services/custdev/'},
    {title:'Улучшить путь к покупке',description:'Когда проблема в сценариях и интерфейсе.',href:'services/design/'},
  ],
};
