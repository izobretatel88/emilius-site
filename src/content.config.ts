// Блог: статьи лежат в src/content/blog/<адрес-статьи>.md. Как добавить статью — docs/BLOG.md.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
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
