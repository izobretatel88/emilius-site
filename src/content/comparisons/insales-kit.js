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
  // Заголовок раздела прилипает сразу под шапкой таблицы: высота шапки меняется с шириной экрана
  const head = scroll && scroll.querySelector('thead');
  if (head && 'ResizeObserver' in window) new ResizeObserver(() => scroll.style.setProperty('--thead-h', `${Math.round(head.getBoundingClientRect().height)}px`)).observe(head);
  const normalize = value => value.toLocaleLowerCase('ru').replaceAll('ё', 'е').replaceAll('1c', '1с');
  // Поиск по смыслу, а не по точной форме слова: «алиса» находит «Алисе», «рассрочка» — оплату частями
  const synonyms = {рассрочк: ['частями', 'сплит', 'долями'], кредит: ['частями', 'сплит'], бонус: ['лояльн'], кешбэк: ['бонус'], кэшбэк: ['бонус'], сертификат: ['подарочн'], склад: ['остатк'], выгрузк: ['экспорт'], сдэк: ['cdek'], cdek: ['сдэк'], чекаут: ['оформлени'], checkout: ['оформлени'], шаблон: ['тем'], дизайн: ['тем'], смартфон: ['мобильн'], телефон: ['мобильн']};
  const stem = term => term.length > 4 ? term.replace(/(ами|ями|ого|ему|ой|ей|ий|ый|ая|яя|ое|ее|ые|ие|ов|ев|ам|ям|ах|ях|ом|ем|ы|и|а|я|е|у|ю|о|ь)$/, '') : term;
  const variants = term => { const base = stem(term); return [base, ...(synonyms[base] || [])]; };
  let mode = 'all';
  rows.forEach(row => { row.searchText = normalize(row.dataset.search); });

  function update(writeURL = true, preserveHash = false) {
    const terms = normalize(search.value.trim()).split(/\s+/).filter(Boolean).map(variants);
    let shown = 0;
    for (const section of sections) {
      let sectionCount = 0;
      for (const row of section.querySelectorAll('[data-feature]')) {
        const visible = (!group.value || section.dataset.group === group.value)
          && (mode === 'all' || row.dataset[mode] === 'true')
          && terms.every(alts => alts.some(term => row.searchText.includes(term)));
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
    count.textContent = shown === rows.length ? `Показаны все ${rows.length} функций` : `Показано ${shown} из ${rows.length} функций`;
    empty.hidden = shown !== 0;
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
      // На телефоне у таблицы своя прокрутка: показываем таблицу с шапкой, а строку ставим под шапкой и заголовком раздела
      if (scroll.scrollHeight > scroll.clientHeight + 1) {
        scroll.scrollIntoView({block: 'start', behavior: 'instant'});
        const section = target.closest('tbody').querySelector('.section-row');
        scroll.scrollBy({top: target.getBoundingClientRect().top - scroll.querySelector('thead th').getBoundingClientRect().bottom - (section ? section.getBoundingClientRect().height : 0), behavior: 'instant'});
      } else {
        target.scrollIntoView({block: 'start'});
      }
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
  // «Источник» с ответом KIT в строке ведёт к блоку ответов; оттуда — ссылка обратно к той же строке
  const back = document.querySelector('.kit-answers-back');
  if (back) {
    const backLink = back.querySelector('a');
    document.querySelectorAll('tr[data-feature] a[href="#kit-answers"]').forEach(link => link.addEventListener('click', () => {
      const row = link.closest('tr[data-feature]');
      backLink.hash = row.id;
      backLink.querySelector('span').textContent = `«${row.querySelector('.feature-link').firstChild.textContent}»`;
      back.hidden = false;
    }));
    backLink.addEventListener('click', () => { requestAnimationFrame(() => document.getElementById(backLink.hash.slice(1))?.querySelector('.feature-link')?.focus({preventScroll: true})); });
  }
  // При печати раскрываем свёрнутые темы, иначе они не попадут в PDF; после печати возвращаем как было
  let openedForPrint = [];
  window.addEventListener('beforeprint', () => { openedForPrint = [...document.querySelectorAll('.platform-comparison details:not([open])')]; openedForPrint.forEach(d => { d.open = true; }); });
  window.addEventListener('afterprint', () => { openedForPrint.forEach(d => { d.open = false; }); openedForPrint = []; });
  readURL();
})();
