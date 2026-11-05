const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const moscow = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Moscow',
});

export function renderPanel({ articles, state, preview, csrf, busy, failure, error, changed, live }) {
  const rows = [...articles].sort(([a, titleA], [b, titleB]) => {
    const group = (id) => state.scheduled[id] ? 0 : state.published[id] ? 2 : 1;
    return group(a) - group(b)
      || (state.scheduled[a] ?? '').localeCompare(state.scheduled[b] ?? '')
      || titleA.localeCompare(titleB, 'ru');
  }).map(([id, title]) => {
    const scheduled = state.scheduled[id];
    const published = state.published[id];
    const due = scheduled && Date.parse(scheduled) <= Date.now();
    const status = published ? 'Опубликована' : due ? 'В очереди на выкладку' : scheduled ? 'Запланирована' : 'Черновик';
    const date = published || scheduled;
    const input = scheduled && !due
      ? new Date(Date.parse(scheduled) + 3 * 3600_000).toISOString().slice(0, 16) : '';
    return `<li class="article">
      <div class="article-text">
        <p class="status">${status}${date ? ` · <time datetime="${escape(date)}">${escape(moscow.format(new Date(date)))}</time>` : ''}</p>
        <h2>${escape(title)}</h2>
        <a href="${escape(preview)}blog/${id}/">Превью</a>
        ${published ? `<a class="public-link" href="https://emilius.agency/blog/${id}/">На сайте</a>` : ''}
      </div>
      ${published ? '' : `<form method="post" action="/">
        <input type="hidden" name="csrf" value="${csrf}">
        <input type="hidden" name="id" value="${id}">
        <input type="hidden" name="previous" value="${escape(scheduled ?? '')}">
        <label for="time-${id}">Дата и время по Москве</label>
        <div class="schedule">
          <input type="datetime-local" id="time-${id}" name="time" value="${input}" required ${busy ? 'disabled' : ''}>
          <button class="primary" name="action" value="schedule" ${busy ? 'disabled' : ''}>${scheduled ? 'Перенести' : 'Запланировать'}</button>
        </div>
        <div class="actions">
          ${live ? `<button name="action" value="now" formnovalidate ${busy ? 'disabled' : ''}>Опубликовать сейчас</button>` : ''}
          ${scheduled ? `<button name="action" value="cancel" formnovalidate ${busy ? 'disabled' : ''}>Снять с очереди</button>` : ''}
        </div>
      </form>`}
    </li>`;
  }).join('');
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Публикации · Эмилиус</title>
  <link rel="stylesheet" href="/fonts.css">
  <link rel="stylesheet" href="/tokens.css">
  <link rel="stylesheet" href="/panel.css">
</head>
<body>
  <main>
    <header>
      <img src="/brand/logo.png" width="24" height="36" alt="">
      <h1>Публикации</h1>
      <a class="refresh" href="/">Обновить статус</a>
    </header>
    <p class="intro">${live ? 'Статьи выходят по очереди. Время указано по Москве.' : 'Тестовый режим. Очередь сохраняется, выкладка отключена.'}</p>
    ${error || failure ? `<p class="notice" role="alert">${escape(error || failure)}</p>` : ''}
    ${busy || changed ? `<p class="notice" role="status">${busy ? 'Выкладка идёт. Обновите статус через несколько минут.' : 'Очередь сохранена.'}</p>` : ''}
    ${rows ? `<ul aria-label="Статьи блога">${rows}</ul>` : '<p>Статей пока нет. Добавьте Markdown-файл в блог и перезапустите панель.</p>'}
  </main>
</body>
</html>`;
}
