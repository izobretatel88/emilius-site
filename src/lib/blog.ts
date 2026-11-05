// Список статей блога. Черновики (draft: true) видны только при разработке и в превью;
// продакшен-сборка их не выпускает, поэтому неготовая статья не уйдёт на сайт случайно.
import { getCollection, type CollectionEntry } from 'astro:content';
import { readBlogReleases } from './blog-releases.mjs';

export type Post = CollectionEntry<'blog'>;

const showDrafts = import.meta.env.DEV || process.env.PREVIEW === '1';

export async function getPosts(): Promise<Post[]> {
  const releases = showDrafts ? null : readBlogReleases();
  const all = await getCollection('blog');
  const posts = releases
    ? [...releases].map(([id, date]) => {
        const post = all.find((entry) => entry.id === id);
        if (!post) throw new Error(`В очереди публикаций нет исходника для ${id}`);
        const published = new Date(date);
        const updated = post.data.updated;
        return { ...post, data: { ...post.data, draft: false, date: published,
          updated: updated && updated > published ? updated : undefined } };
      })
    : all.filter(({ data }) => showDrafts || !data.draft);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

const publicationDate = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow',
});

export function ruDate(date: Date): string {
  return publicationDate.format(date).replace(/\sг\.$/, '');
}
