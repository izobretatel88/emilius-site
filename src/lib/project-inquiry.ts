import { entryPoint } from '../data/entry-points';
// Принимаем только известный проект: текст из URL в форму не переносим.
const PROJECT_INQUIRIES: Record<string, {name: string; message: string}> = {
  happyanimal: {name: 'Happy Animal', message: 'Хочу похожий магазин, как Happy Animal.'},
  alohagaia: {name: 'Aloha Gaia', message: 'Хочу похожий магазин, как Aloha Gaia.'},
  duman: {name: 'Duman', message: 'Хочу похожий магазин, как Duman.'},
  wizzu: {name: 'LimeMart', message: 'Хочу похожий магазин, как LimeMart.'},
  geekboards: {name: 'Geekboards', message: 'Хочу похожий магазин, как Geekboards.'},
  zalina: {name: 'Zalina Verkhovskaya', message: 'Хочу похожий магазин, как Zalina Verkhovskaya.'},
  mnogoles: {name: 'Многолес', message: 'Хочу похожий магазин, как «Многолес».'},
  almatennis: {name: 'Almatennis', message: 'Хочу похожий магазин, как Almatennis.'},
  'ss-sk': {name: 'СС-СК', message: 'Хочу похожий магазин, как СС-СК.'},
  nsorganic: {name: 'NSOrganic', message: 'Хочу похожий магазин, как NSOrganic.'},
  navalishenskoe: {name: 'Навалишенское', message: 'Хочу похожий сайт, как «Навалишенское».'},
};

export function projectInquiry(id: string | null) {
  if (!id || !Object.hasOwn(PROJECT_INQUIRIES, id)) return null;
  return PROJECT_INQUIRIES[id];
}

// Сохранённый или набранный текст всегда важнее автозаполнения.
export function inquiryMessage(current: string, id: string | null) {
  const project = projectInquiry(id);
  return current.trim() || !project ? current : `${project.message}\n\n`;
}

// Ситуация из блока «С чего начнём?» (?start=<id>): то же поведение, что у проекта.
// Принимаем только известную ситуацию — текст из адреса в форму не переносим.
export function startInquiry(id: string | null) {
  const entry = entryPoint(id);
  return entry ? { name: entry.label, message: entry.message, ask: entry.ask } : null;
}

// Направление (?stage=<id>): «Обсудить задачу» со страницы этапа ведёт в форму главной,
// и форма помнит, откуда пришёл человек.
const STAGE_INQUIRIES: Record<string, {name: string; message: string}> = {
  custdev: {name: 'Касдев', message: 'Хочу обсудить касдев: исследование клиентов.'},
  design: {name: 'Дизайн', message: 'Хочу обсудить дизайн: путь клиента и интерфейс.'},
  dev: {name: 'Разработка', message: 'Хочу обсудить разработку.'},
  marketing: {name: 'Маркетинг', message: 'Хочу обсудить маркетинг: привлечение и аналитику.'},
};
export function stageInquiry(id: string | null) {
  if (!id || !Object.hasOwn(STAGE_INQUIRIES, id)) return null;
  return STAGE_INQUIRIES[id];
}

// Тема со страниц сравнений (?topic=<id>): «Помогите выбрать платформу» приходит в форму с первой строкой.
const TOPIC_INQUIRIES: Record<string, {name: string; message: string}> = {
  platform: {name: 'Выбор платформы', message: 'Помогите выбрать платформу для магазина.'},
  'insales-kit': {name: 'inSales или Яндекс KIT', message: 'Помогите выбрать между inSales и Яндекс KIT.'},
};
export function topicInquiry(id: string | null) {
  if (!id || !Object.hasOwn(TOPIC_INQUIRIES, id)) return null;
  return TOPIC_INQUIRIES[id];
}
