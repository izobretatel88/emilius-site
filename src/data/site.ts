// Сайт — продукт в работе. Номер итерации показывается в футере.
// Старый сайт на Tilda дошёл до итерации 4, этот сайт продолжает счёт.
export const ITERATION = { current: 5, total: 15 };

export const MISSION = 'Помогать великолепным людям создавать великолепные продукты!';

export const LINKS = {
  channel: 'https://t.me/EmiliusAgency',
  direct: 'https://t.me/emillively',
  arda: 'https://arda.digital/',
};

// Голосовой ассистент Эми (Millis AI) — тот же виджет, что на текущем сайте.
export const EMI_WIDGET_SRC =
  'https://app.millis.ai/agents/embedded?id=-Or5e2l2n8R7drrR-yId&k=fEG4QMFDR2LxTbNwFA0ZLKGvNENPTmcC&c=eJxlj8FKAzEURX8lRAodmBknxaKdLv0NN5nJmxhMk5JkrFgK0nXBhV%2Fgwr10o6t%2BQ%2BaPfLGFIj4eWZybe7lvTYMKGjyt17S1xkAblJG0pvE97ofX%2BDXsyrKkOVVCQ8Jv8RD38TC8xO9hO%2BxQcb0xJ88HSp%2FDNkl0gx5M%2FJ8ceKPB1cIGf87trusVf4TOusWfSOQL1RZec3%2BfIps%2BBGtuPcbShrcP0tneiEItuISaaGWAu0I6LhSYMGZsKkDmxMlmzCoym6W9JKyqRtmRHtEvvZmMsmx%2BZxrrBPYjbPlEvNVKpI98PJlOc3J%2BqnJylc2xa6p87HPR%2Fg6yc7OEu9Og4NUzXstYldPguPGtU8tA645rD3g2SGUNWqAvVuAD3fwA9FqQoQ%3D%3D';

// Годовой цикл: 52 недели, 4 этапа по 13 недель. Порядок важен — это логика колеса.
export const SECTORS = [
  { id: 'custdev', name: 'касдев', from: 1, to: 13, c1: '#b0703c', c2: '#7a5a3a', pastel: '#fff1e8', text: 'Исследуем клиентов и находим настоящую проблему' },
  { id: 'design', name: 'дизайн', from: 14, to: 26, c1: '#20a88e', c2: '#2468b8', pastel: '#e8f6ff', text: 'Проектируем опыт и интерфейс' },
  { id: 'dev', name: 'разработка', from: 27, to: 39, c1: '#9cc43c', c2: '#30b04c', pastel: '#f0ffe6', text: 'Собираем и интегрируем продукт' },
  { id: 'marketing', name: 'маркетинг', from: 40, to: 52, c1: '#3c9c5a', c2: '#7c9040', pastel: '#effff4', text: 'Приводим людей — и снова к касдеву' },
] as const;
