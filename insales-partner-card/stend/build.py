"""Стенд карточки партнёра InSales: «Было» (живая страница) и «Стало» (новый текст, графика, портфолио).

Использование:
    curl -s https://www.insales.ru/collection/partners-prodvizhenie/product/emiliusagency -o partner-insales/stend/source.html
    python3 -I partner-insales/stend/build.py
Смотреть: preview «insales-stend» → http://127.0.0.1:4341/stend/index.html

Скрипты InSales вырезаются (без счётчиков и чужого кода), стили и картинки грузятся с insales.ru.
Слайдер портфолио без JS заменён лентой с прокруткой.
"""
import re
from pathlib import Path

here = Path(__file__).resolve().parent
h = (here / "source.html").read_text(encoding="utf-8")

# --- чистим ---
h = re.sub(r"<script\b[^>]*>.*?</script>", "", h, flags=re.S | re.I)
h = re.sub(r"<noscript\b[^>]*>.*?</noscript>", "", h, flags=re.S | re.I)
h = re.sub(r"<iframe\b[^>]*>.*?</iframe>", "", h, flags=re.S | re.I)
h = re.sub(r'<link\b[^>]*rel="(?:modulepreload|preload|prefetch|preconnect|dns-prefetch)"[^>]*>', "", h, flags=re.I)
h = re.sub(r'\son[a-z]+="[^"]*"', "", h, flags=re.I)
h = re.sub(r'(href|src)="/(?!/)', r'\1="https://www.insales.ru/', h)
h = re.sub(r'(href|src)="//', r'\1="https://', h)

# стили InSales — копией рядом со стендом: адреса на CDN версионные и после обновления сайта отдают 403.
# Внутри CSS шрифты и картинки остаются ссылками на CDN (шрифты InSales лицензированы — не копируем).
import urllib.request
from urllib.parse import urljoin
CSS_DIR = here / "insales-css"
CSS_DIR.mkdir(exist_ok=True)
def local_css(m):
    url = m.group(2)
    name = url.rsplit("/", 1)[-1].split("?")[0]
    dst = CSS_DIR / name
    if not dst.exists():
        css = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read().decode("utf-8", "replace")
        css = re.sub(r'url\(\s*([\'"]?)(?!data:|https?:|//)([^\'")]+)\1\s*\)', lambda u: f'url("{urljoin(url, u.group(2))}")', css)
        css = re.sub(r'url\(\s*([\'"]?)//', r'url(\1https://', css)
        dst.write_text(css, encoding="utf-8")
    return m.group(1) + "insales-css/" + name + m.group(3)
h = re.sub(r'(<link\b[^>]*rel="stylesheet"[^>]*href=")(https://cdn\.insales-shop\.ru/[^"]+\.css)("[^>]*>)', local_css, h)
h = re.sub(r'(<link\b[^>]*href=")(https://cdn\.insales-shop\.ru/[^"]+\.css)("[^>]*rel="stylesheet"[^>]*>)', local_css, h)
# картинки шаблона InSales (логотип, иконки) лежат по тем же версионным адресам — тоже копией рядом
def local_asset(m):
    url = m.group(2)
    name = url.rsplit("/", 1)[-1].split("?")[0]
    dst = CSS_DIR / name
    if not dst.exists():
        dst.write_bytes(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read())
    return m.group(1) + "insales-css/" + name + m.group(3)
h = re.sub(r'((?:src|href)=")(https://cdn\.insales-shop\.ru/assets/[^"]+\.(?:svg|png|jpg|jpeg|webp|gif|ico))(")', local_asset, h)

STAND_CSS = """<style>
  .js-partner-slider .swiper-wrapper{display:flex;gap:16px;overflow-x:auto;padding-bottom:10px;transform:none!important}
  .js-partner-slider .swiper-slide{flex:0 0 auto;width:420px!important;max-width:85vw}
  .js-partner-slider .swiper-slide img{width:100%;height:auto;display:block;border-radius:6px}
  .partner-slider-arrow-prev,.partner-slider-arrow-next{display:none!important}
  [class*=cookie i],.cookies-message{display:none!important}
  .stand-desc img{max-width:100%;height:auto;display:block;margin:24px 0}
  .stand-desc h3{margin:36px 0 12px;font-size:22px;font-weight:700}
</style>"""
# стенд — копия страницы insales.ru: не индексировать и не выдавать себя за оригинал (canonical убираем)
h = re.sub(r'<link\b[^>]*rel="canonical"[^>]*>', "", h, flags=re.I)
h = re.sub(r'<meta\b[^>]*name="robots"[^>]*>', "", h, flags=re.I)
h = h.replace("</head>", '<meta name="robots" content="noindex, nofollow">' + STAND_CSS + "</head>", 1)
(here / "was.html").write_text(h, encoding="utf-8")

# --- «Стало» ---
IMG = "../graphics/out/"

def p(t): return f"<p>{t}</p>"
def title(t): return f"<h3>{t}</h3>"
def img(f, alt): return f'<p><img src="{IMG}{f}" alt="{alt}"></p>'

desc = "\n".join([
    img("01-oblozhka.png", "Магазин, который выглядит как бренд"),
    p("<strong>Emilius.Agency</strong> проектирует и разрабатывает интернет-магазины на InSales: собственный дизайн, своя тема с нуля, продуманная мобильная версия и витрина, которой команда управляет без программиста. Если нужно стартовать быстро — запускаем на готовой теме и доводим её до вашего фирменного стиля."),
    title("Индивидуальный фронтенд"),
    p("Это не перекрашенный шаблон: мы проектируем и пишем витрину под ваш бренд, ассортимент и покупателя."),
    img("02-etapy.png", "Пять этапов от брифа до запуска"),
    "<ul>"
    "<li><strong>Дизайн-система в Figma</strong> — шрифты, сетка, цвета и компоненты, чтобы магазин рос без разнобоя.</li>"
    "<li><strong>Мобильная версия</strong> проектируется наравне с десктопом, анимации — там, где помогают выбрать товар.</li>"
    "<li><strong>Лёгкий код и чистая разметка</strong> — быстрая загрузка и хорошая индексация.</li>"
    "<li><strong>Блоки в админке</strong> — баннеры, подборки и лендинги без задачи разработчику.</li>"
    "<li><strong>Интеграции</strong> — оплата, доставка, 1С и МойСклад, маркетплейсы, RetailCRM, Mindbox.</li>"
    "</ul>",
    p("Стоимость зависит от объёма: сколько уникальных страниц и блоков, какие анимации и интеграции нужны. После брифа даём смету в часах по каждому этапу и фиксируем сумму и сроки в договоре до начала работ."),
    img("03-tema-ili-front.png", "Готовая тема или свой фронтенд"),
    title("Запуск на готовой теме — от 75 000 ₽"),
    p("Когда важно начать продажи быстро. Подбираем тему, адаптируем её под бренд, загружаем каталог, настраиваем оплату, доставку, Яндекс Метрику и базовое SEO. Простой проект — около 2–3 недель после получения материалов."),
    title("Наши проекты на InSales"),
    "<ul>"
    "<li><strong><a href=\"https://alohagaia.ru/\" target=\"_blank\" rel=\"noopener\">Aloha Gaia</a></strong> (alohagaia.ru) — ювелирный бренд. Свой фронтенд, интеграция с InSales и собственные модули.</li>"
    "<li><strong><a href=\"https://www.duman.store/\" target=\"_blank\" rel=\"noopener\">Duman</a></strong> (duman.store) — женская одежда премиум-сегмента. Свой фронтенд, сложная архитектура и UX/UI.</li>"
    "<li><strong><a href=\"https://limemart.wizzu.ru/\" target=\"_blank\" rel=\"noopener\">LimeMart</a></strong> (limemart.wizzu.ru) — доставка продуктов в Чечне. Витрина и интеграции стартапа: с нуля до 2000+ заказов в месяц.</li>"
    "<li><strong><a href=\"https://geekboards.ru/\" target=\"_blank\" rel=\"noopener\">Geekboards</a></strong> (geekboards.ru) — клавиатуры и аксессуары, шоурум в Москве. Развитие магазина и кастомизация фронтенда.</li>"
    "</ul>",
    title("Доработка работающего магазина"),
    p("Дорабатываем вёрстку и функции темы, ускоряем страницы, переносим каталог, подключаем интеграции и рассылки, собираем семантическое ядро и структуру под SEO."),
    title("Как работаем"),
    "<ol>"
    "<li>Бриф: что продаёте, как ведёте учёт, откуда придут покупатели.</li>"
    "<li>Смета, сроки и договор — до начала работ.</li>"
    "<li>Показываем дизайн и магазин по этапам: вы видите результат задолго до запуска.</li>"
    "<li>Сдача: вместе проходим путь покупателя — выбор, доставка, оплата, заказ в админке.</li>"
    "<li>Передаём тему, исходники дизайна и доступы. Домен, аккаунт InSales и сервисы с самого начала оформлены на вас.</li>"
    "</ol>",
    img("04-chto-ostaetsya.png", "Что остаётся у вас"),
    p("Заранее показываем и регулярные расходы — тариф, приложения, сервисы, — чтобы вы знали цену магазина не только в запуске, но и в содержании."),
    p("<strong>Напишите на <a href=\"mailto:behappy@emilius.agency\">behappy@emilius.agency</a></strong>, что продаёте, и пришлите пару сайтов, которые вам нравятся. Предложим решение и подготовим расчёт."),
])

# типографика: короткие слова (в, и, с, на, по, от, до…) не оставляем висеть в конце строки — неразрывный пробел после них, только в тексте, не в тегах
def nbsp(html):
    return re.sub(r'(>[^<]+)', lambda m: re.sub(r'(?<![\w\u0400-\u04FF])([\w\u0400-\u04FF]{1,2}) (?=\S)', '\\1\u00a0', m.group(1)), html)
desc = nbsp(desc)
desc = re.sub(r'(?<![\w\u0400-\u04FF])([\w\u0400-\u04FF]{1,2}) <a ', lambda m: m.group(1) + '\u00a0<a ', desc)  # «на <a…>» — короткое слово перед ссылкой

n = h
# описание: первый <div> после разделителя под портфолио, до закрывающего </div>, за которым идёт <div></div>
m = re.search(r'(<div class="cell-12 ">\s*<div>)(.*?)(</div>\s*<div></div>)', n, flags=re.S)
assert m, "блок описания не найден"
n = n[:m.start(2)] + '\n<div class="stand-desc">' + desc + '</div>\n' + n[m.end(2):]

# портфолио
slides = "".join(
    f'<div class="swiper-slide"><a href="{IMG}{f}"><img src="{IMG}{f}" alt=""></a></div>'
    for f in ["p1-aloha-gaia.png", "p2-duman.png", "p3-limemart.png", "p4-geekboards.png"]
)
m = re.search(r'(<div class="swiper-wrapper">)(.*?)(</div>\s*<div class="swiper-button-prev)', n, flags=re.S)
assert m, "портфолио не найдено"
n = n[:m.start(2)] + slides + n[m.end(2):]

# логотип и цена
n, k = re.subn(r'(<img class="partner-logotype[^"]*" src=")[^"]+', r'\1' + IMG + 'logo.png', n)
assert k == 1, "логотип"
assert "от 15 000 руб." in n
n = n.replace("от 15 000 руб.", "от 75 000 руб.")

(here / "new.html").write_text(n, encoding="utf-8")
print("готово: was.html, new.html")
