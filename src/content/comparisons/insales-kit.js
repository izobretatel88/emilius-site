(() => {
  'use strict';
  const form = document.querySelector('#filters');
  const search = document.querySelector('#search');
  const group = document.querySelector('#group');
  const buttons = [...document.querySelectorAll('[data-mode]')];
  const sections = [...document.querySelectorAll('tbody[data-group]')];
  const rows = [...document.querySelectorAll('[data-feature]')];
  const count = document.querySelector('#count');
  const empty = document.querySelector('#empty');
  const scroll = document.querySelector('.scroll');
  const normalize = value => value.toLocaleLowerCase('ru').replaceAll('ё', 'е').replaceAll('1c', '1с');
  // Запрос, набранный не в той раскладке («jcnfnrb» → «остатки»), и привычные написания («сдек», «cdek», «сео»):
  // раньше они давали пустой список, хотя функции есть (think-different, итерация 45).
  const ALIASES = { сдек: 'сдэк', cdek: 'сдэк', сео: 'seo', срм: 'crm', апи: 'api', озон: 'ozon', вб: 'wb', moysklad: 'мойсклад' };
  const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`", RU = 'йцукенгшщзхъфывапролджэячсмитьбюё';
  const swapLayout = value => [...value.toLowerCase()].map(c => { const i = EN.indexOf(c); return i < 0 ? c : RU[i]; }).join('');
  const termsOf = value => normalize(value.trim()).replace(/мой\s+склад/g, 'мойсклад').split(/\s+/).filter(Boolean).map(t => ALIASES[t] ?? t);
  const anyMatch = terms => rows.some(row => terms.every(term => row.searchText.includes(term)));
  let mode = 'all';
  rows.forEach(row => { row.searchText = normalize(row.dataset.search); });

  function update(writeURL = true, preserveHash = false) {
    let terms = termsOf(search.value), swapped = '';
    if (terms.length && /[a-z]/i.test(search.value) && !anyMatch(terms)) {
      const alt = termsOf(swapLayout(search.value));
      if (anyMatch(alt)) { terms = alt; swapped = alt.join(' '); }
    }
    let shown = 0;
    for (const section of sections) {
      let sectionCount = 0;
      for (const row of section.querySelectorAll('[data-feature]')) {
        const visible = (!group.value || section.dataset.group === group.value)
          && (mode === 'all' || row.dataset[mode] === 'true')
          && terms.every(term => row.searchText.includes(term));
        row.hidden = !visible;
        const noteRow = row.nextElementSibling;
        if (noteRow?.matches('[data-note-for]')) noteRow.hidden = !visible;
        if (visible) sectionCount++;
      }
      section.hidden = sectionCount === 0;
      section.querySelector('[data-group-count]').textContent = sectionCount;
      shown += sectionCount;
    }
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    count.textContent = shown === rows.length ? `Показаны все ${rows.length} пунктов` : `Показано ${shown} из ${rows.length} пунктов`;
    if (swapped) count.textContent += ` по запросу «${swapped}»`;
    empty.hidden = shown !== 0;
    // Пустой поиск — не тупик: вопрос уходит в Telegram с тем, что человек искал (think-different, итерация 46)
    const ask = empty.querySelector('[data-empty-ask]');
    if (ask && shown === 0) {
      const q = search.value.trim().slice(0, 100);
      const text = q ? `В сравнении inSales и Яндекс KIT не нашлось «${q}». Есть это на какой-нибудь из платформ?` : 'В сравнении inSales и Яндекс KIT не нашлось нужной функции. Подскажете, есть ли она?';
      ask.href = `https://t.me/emillively?text=${encodeURIComponent(text)}`;
    }
    scroll.querySelector('table').hidden = shown === 0;
    document.querySelector('.mobile-hint').hidden = shown === 0;
    if (writeURL) {
      const url = new URL(location.href);
      for (const [key, value] of [['q', search.value.trim()], ['group', group.value], ['mode', mode === 'all' ? '' : mode]]) {
        if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
      }
      if (!preserveHash) url.hash = '';
      history.replaceState(null, '', url);
    }
  }
  function reset(preserveHash = false) {
    search.value = '';
    group.value = '';
    mode = 'all';
    update(true, preserveHash);
  }
  function readURL() {
    const params = new URL(location.href).searchParams;
    search.value = params.get('q') || '';
    group.value = [...group.options].some(option => option.value === params.get('group')) ? params.get('group') : '';
    mode = buttons.some(button => button.dataset.mode === params.get('mode')) ? params.get('mode') : 'all';
    update(false);
    revealAnchor();
  }
  function revealAnchor() {
    const target = rows.find(row => `#${row.id}` === location.hash);
    if (!target) return;
    if (target.hidden || target.closest('tbody').hidden) reset(true);
    requestAnimationFrame(() => {
      scroll.scrollLeft = 0;
      target.scrollIntoView({block: 'start'});
    });
  }
  form.hidden = false;
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', event => { event.preventDefault(); reset(); search.focus(); });
  search.addEventListener('input', () => { update(); });
  group.addEventListener('change', () => { update(); });
  buttons.forEach(button => button.addEventListener('click', () => { mode = button.dataset.mode; update(); }));
  document.querySelector('#empty-reset').addEventListener('click', () => { reset(); search.focus(); });
  window.addEventListener('popstate', readURL);
  window.addEventListener('hashchange', revealAnchor);
  window.addEventListener('load', revealAnchor, {once: true});
  document.querySelectorAll('.feature-link').forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const url = new URL(location.href);
    url.hash = link.hash;
    history.pushState(null, '', url);
    revealAnchor();
  }));
  readURL();
})();
