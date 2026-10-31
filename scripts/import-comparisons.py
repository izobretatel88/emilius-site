"""Import the two approved local comparison artifacts into the site's visual system.
Usage: python3 scripts/import-comparisons.py /absolute/path/to/template-store
Generated files are committed; this script is not needed for normal site builds.
"""
import json
import re
import sys
from html import escape
from pathlib import Path

source = Path(sys.argv[1])
root = Path(__file__).resolve().parent.parent
out = root / 'src/content/comparisons'
out.mkdir(parents=True, exist_ok=True)


def scope_css(css, scope):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    result, pos = [], 0
    while pos < len(css):
        opening = css.find('{', pos)
        if opening < 0:
            break
        selector = css[pos:opening].strip()
        level, closing = 1, opening + 1
        while closing < len(css) and level:
            level += (css[closing] == '{') - (css[closing] == '}')
            closing += 1
        content = css[opening + 1:closing - 1]
        pos = closing
        if selector.startswith('@font-face') or ':root' in selector:
            continue
        if selector.startswith('@'):
            if selector.startswith(('@media', '@supports')):
                result.append(selector + '{' + scope_css(content, scope) + '}')
            continue
        selectors = []
        for item in selector.split(','):
            item = item.strip()
            if re.match(r'^(body|html)(?=[\s.:#\[]|$)', item):
                item = re.sub(r'^(body|html)', scope, item)
            else:
                item = scope + ' ' + item
            selectors.append(item)
        result.append(','.join(selectors) + '{' + content + '}')
    return '\n'.join(result)


for name, path in [('ecommerce-platforms', 'artifacts/7-sravnenie-platform/index.html'),
                   ('insales-kit', 'artifacts/8-insales-kit/index.html')]:
    original = (source / path).read_text()
    css = '\n'.join(re.findall(r'<style[^>]*>(.*?)</style>', original, re.S))
    body = re.search(r'<body[^>]*>(.*?)</body>', original, re.S).group(1)
    scripts = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', body, re.S))
    body = re.sub(r'<script[^>]*>.*?</script>', '', body, flags=re.S)
    body = re.sub(r'<noscript>.*?</noscript>', '', body, flags=re.S)
    body = body.replace('<main class="wrap">', '<div class="wrap">').replace('</main>', '</div>')
    body = re.sub(r'<a class="skip".*?</a>', '', body)
    body = re.sub(r'\s*·\s*<a href="\./vybor-platformy.html">.*?</a>', '', body)
    body = body.replace('href="./sources.md"', 'href="#comparison-sources"')
    if name == 'insales-kit':
        body = body.replace('Emilius Agency · данные на ', 'Данные на ')
        body = body.replace('InSales и Яндекс KIT.<br>Сравнение функций', 'InSales и Яндекс KIT: сравнение функций')
        body = body.replace('<form class="panel"', '<a class="table-jump" href="#comparison">Перейти к таблице 348 функций ↓</a><form class="panel"', 1)
        body = body.replace('<span>Ссылки на источники — в ячейках</span>', '<a href="#filters">Изменить поиск и фильтры ↑</a>')
        body = body.replace('<p class="mobile-hint">Прокрутите таблицу вправо → Название функции останется слева.</p>', '<p class="mobile-hint">На телефоне оговорки открываются под строкой функции.</p>')
        def mobile_note(match):
            row = match[0]
            note = re.search(r'<td class="note">(.*?)</td>', row, re.S)
            if note and 'Дополнительных оговорок нет' not in note[1]:
                row_id = re.search(r'id="(F\d+)"', row)[1]
                row += f'<tr class="mobile-note-row" data-note-for="{row_id}"><td colspan="4"><details><summary>Оговорки и различия</summary><p>{note[1]}</p></details></td></tr>'
            return row
        body = re.sub(r'<tr id="F\d+".*?</tr>', mobile_note, body, flags=re.S)
        body = body.replace('<span class="muted">Дополнительных оговорок нет</span>', '<span class="muted"><span class="sr-only">Дополнительных оговорок нет</span><span aria-hidden="true">—</span></span>')
        scripts = scripts.replace('row.hidden = !visible;', "row.hidden = !visible;\n        const noteRow = row.nextElementSibling;\n        if (noteRow?.matches('[data-note-for]')) noteRow.hidden = !visible;")
    else:
        body = body.replace('Emilius Agency · проверено ', 'Данные на ')
        body = body.replace('<div class="panel">', '<a class="table-jump" href="#comparison">Перейти к таблице платформ ↓</a><div class="panel">', 1)
        body = body.replace('<section class="card" aria-label="Сравнение платформ по параметрам">', '<section id="comparison" class="card" aria-label="Сравнение платформ по параметрам">')
    if name == 'ecommerce-platforms':
        # Reconcile the older overview with the subsequently audited feature registry.
        body = body.replace('7 шаблонов, свои блоки нельзя', 'Редактор и кастомные HTML/CSS/Handlebars-секции; полный код темы не подтверждён')
        body = body.replace('заказы с сайта на маркетплейс не уходят', 'обратный обмен и управление заказами площадок не подтверждены')
        body = body.replace('Яндекс Доставка, СДЭК, Почта', 'Яндекс Доставка и СДЭК; Почту России уточнить')
        body = body.replace('Яндекс Пэй, СБП, Сплит', 'Яндекс Пэй/Сплит, CloudPayments; другие способы уточнить')
        body = body.replace('Нет<span class="sub">только порог одной скидки</span>', 'Через RetailCRM<span class="sub">штатный накопительный сценарий не подтверждён</span>')
        body = body.replace('до ~1\u00a0000', 'лимит уточняется')
        body = body.replace('Жёлтым помечены редакционные оценки.', 'Редакционные оценки помечены пояснениями.')
        body = body.replace('«Вывод»', '«Ориентир»')
        scripts = scripts.replace('const BEST = "InSales";', 'const BEST = null;')
        scripts = scripts.replace(' { id: "f-design", label: "Нужен свой дизайн", out: { "Яндекс KIT": "7 шаблонов, свои блоки нельзя" } },', ' { id: "f-design", label: "Нужен свой дизайн", out: {} },')
        scripts = scripts.replace(', "Яндекс KIT": "нет оптовых цен"', '')
        scripts = re.sub(r'site: \["Вывод",.*?\],', 'site: ["Как выбирать", "Сопоставьте каталог, процессы и ограничения платформы. Затраты включают запуск, подписку и внешние сервисы; одного тарифа для решения недостаточно. Неизвестные возможности уточняйте у платформы."],', scripts)
        scripts = re.sub(r'mp: \["Вывод для селлера",.*?\],', 'mp: ["Для продавцов маркетплейсов", "InSales заявляет обмен остатками между площадками. У KIT подтверждён импорт товаров и остатков; обратный обмен и состав обработки заказов нужно уточнить. Итоговая стоимость зависит от выбранной связки и состава интеграций."],', scripts)
        body = body.replace('<div class="wrap">', '<div class="wrap"><p class="foot">Обзор от 30 октября; сведения о KIT уточнены по исследованию 31 октября 2026. Полный состав функций — в детальном сравнении.</p>', 1)
        md = (source / 'artifacts/7-sravnenie-platform/sources.md').read_text()
        links = re.findall(r'\[([^]]+)\]\((https?://[^)]+)\)', md)
        body += '<details id="comparison-sources"><summary>Официальные источники сравнения</summary><ul>' + ''.join(f'<li><a href="{escape(url, quote=True)}" target="_blank" rel="noopener">{escape(label)} ↗</a></li>' for label,url in links) + '</ul></details>'
    scripts = scripts.replace('document.body.classList', 'document.querySelector(".platform-comparison").classList')
    (out / f'{name}.html').write_text(body.strip()+'\n')
    css = scope_css(css, '.platform-comparison')
    radii = {'999':'pill','20':'card','16':'card','13':'btn','12':'sm','10':'sm','9':'sm','4':'sm'}
    css = re.sub(r'border-radius:\s*(999|20|16|13|12|10|9|4)px', lambda m:'border-radius:var(--radius-'+radii[m[1]]+')', css)
    css = css.replace('color:#fff', 'color:var(--on-teal)').replace('background:#fff', 'background:var(--print-page)').replace('color:#000','color:var(--print-ink)')
    (out / f'{name}.css').write_text(css)
    (out / f'{name}.js').write_text(scripts.strip()+'\n')

# Public factual data only; internal questions and audit notes are not shipped.
registry = json.loads((source / 'research/insales-kit-features/features.json').read_text())
(root / 'src/data/platform-features.json').write_text(json.dumps({k:registry[k] for k in ['as_of','status_definitions','sources','features']},ensure_ascii=False,indent=2)+'\n')
print('Imported both comparisons; scoped CSS, preserved all rows and source links.')
