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
