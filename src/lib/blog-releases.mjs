// Явный список выпусков применяется только к управляемой продакшен-сборке.
export function readBlogReleases(value = process.env.BLOG_RELEASES) {
  if (value === undefined) return null;
  const releases = JSON.parse(value);
  if (!releases || typeof releases !== 'object' || Array.isArray(releases)) {
    throw new Error('BLOG_RELEASES: нужен объект «адрес статьи → время публикации»');
  }
  for (const [id, date] of Object.entries(releases)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ||
        typeof date !== 'string' || Number.isNaN(Date.parse(date)) ||
        new Date(date).toISOString() !== date) {
      throw new Error(`BLOG_RELEASES: неверная запись для ${id}`);
    }
  }
  return new Map(Object.entries(releases));
}
