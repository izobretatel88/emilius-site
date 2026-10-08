// Эталонные проекты: по ним калибруются цены пакетов (node estimate.mjs --calibrate).
// endorphine и happyanimal — реальные проекты Emilius (упрощённо), остальные — типовые клиенты сегментов.

export const PRESETS = {
  start: { name: 'Старт: 40 товаров в нашей таблице', brief: {
    sku: 40, categories: 6, variants: 'none', source: 'table', photosReady: true, descriptionsReady: true,
    banners: 2 } },
  endorphine: { name: 'Эндорфин (цветы, 20 карточек, MVP)', brief: {
    sku: 20, categories: 5, source: 'manual', photosReady: true, descriptionsReady: false, extraPages: 1 } },
  social: { name: 'Бренд из соцсетей: 80 товаров, варианты, без описаний', brief: {
    sku: 80, categories: 10, variants: 'some', source: 'manual', photosReady: false, descriptionsReady: false,
    banners: 3, email: true, sizeTable: true, ecommerce: true } },
  shop: { name: 'Магазин: 300 товаров из таблицы', brief: {
    sku: 300, categories: 30, variants: 'some', source: 'table', photosReady: true, descriptionsReady: true,
    payments: 2, deliveries: 2, banners: 3, extraPages: 1, cssFixes: 3, customBlocks: 1, ecommerce: true,
    promo: true, sizeTable: true } },
  seller: { name: 'Селлер WB+Ozon: 200 SKU, импорт с МП, синхронизация 2 площадок', brief: {
    stage0: true, sku: 200, categories: 20, variants: 'all', source: 'mp', photosReady: true, descriptionsReady: true,
    marketplaces: 2, payments: 1, deliveries: 2, banners: 3, cssFixes: 2, ecommerce: true, ads: true, emailTriggers: true } },
  sellerMs: { name: 'Селлер на МойСклад: 500 SKU, МС + 2 площадки', brief: {
    stage0: true, sku: 500, categories: 40, variants: 'all', source: 'moysklad', accounting: 'moysklad',
    photosReady: true, descriptionsReady: true, marketplaces: 2, deliveries: 2, banners: 3, cssFixes: 3,
    customBlocks: 1, ecommerce: true, ads: true } },
  happyanimal: { name: 'Happy Animal: 2000 SKU, 1С, 2 точки, локальное SEO', brief: {
    stage0: true, sku: 2000, categories: 80, variants: 'some', source: '1c', accounting: '1c',
    photosReady: true, descriptionsReady: true, warehouses: 2, deliveries: 2, banners: 4, cssFixes: 4,
    ecommerce: true, offline: true, seo: 'semantic', local: true, promo: true } },
  migration: { name: 'Переезд с Tilda: 150 товаров, 40 страниц в индексе', brief: {
    sku: 150, categories: 15, variants: 'some', source: 'oldsite', migration: true, oldUrls: 200, oldPages: 10,
    oldCustomers: true, photosReady: true, descriptionsReady: true, banners: 2, ecommerce: true } },
};
