// Список статей блога. Черновики (draft: true) видны только при разработке и в превью;
// продакшен-сборка их не выпускает, поэтому неготовая статья не уйдёт на сайт случайно.
import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

const showDrafts = import.meta.env.DEV || process.env.PREVIEW === '1';

export async function getPosts(): Promise<Post[]> {
  const all = await getCollection('blog', ({ data }) => showDrafts || !data.draft);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

// «28 октября 2026» — без зависимости от локали сервера сборки
export function ruDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
