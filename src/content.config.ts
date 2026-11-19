// Блог: статьи лежат в src/content/blog/<адрес-статьи>.md (или .mdx — со вставками компонентов).
// Как добавить статью, в том числе через редактор Pages CMS, — docs/BLOG.md.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Имя файла — адрес статьи. Редактор Pages CMS даёт задать его вручную, поэтому проверяем:
// только латиница в нижнем регистре, цифры и дефисы, иначе сборка остановится с понятной ошибкой.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const blog = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/blog',
    generateId: ({ entry }) => {
      const id = entry.replace(/\.mdx?$/, '');
      if (!SLUG.test(id)) throw new Error(`Блог: адрес статьи «${entry}» — только латиница a–z, цифры и дефисы, например edinye-ostatki-wb-ozon.md`);
      return id;
    },
  }),
  schema: z.object({
    title: z.string().max(70), // <title> и заголовок в выдаче: до ~60 знаков
    h1: z.string(), // заголовок на странице, может быть длиннее и живее
    description: z.string().min(80).max(200),
    date: z.coerce.date(), // дата публикации
    updated: z.coerce.date().optional(),
    draft: z.boolean().default(false), // черновики видны в dev и в превью, в продакшен-сборку не попадают
    reviewBy: z.coerce.date().optional(), // когда перепроверить цены и тарифы
    cover: z.string(), // обложка 1200×630: превью в списке и в соцсетях
    coverAlt: z.string(),
    readingMinutes: z.number().int().positive(),
    mainQuery: z.string().optional(),
    tags: z.array(z.string()).default([]),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]), // для разметки FAQPage
  }),
});

export const collections = { blog };
