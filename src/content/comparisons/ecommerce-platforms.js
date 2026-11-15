const NAMES = ["Tilda", "Яндекс KIT", "inSales", "Shop-Script", "AdvantShop", "1С-Битрикс", "WooCommerce", "OpenCart"];
const BEST = null; // единственная платформа с синхронизацией WB и Ozon в тарифе

// Быстрые фильтры (из 08-anketa-vybora.csv): какие платформы отпадают и почему.
// Кнопки с подписями, счётчик «8 из 8» и вывод для «Только сайт» стоят в разметке (think-different, итерация 94):
// раньше их дописывал скрипт через ~1 с после загрузки, и таблица на компьютере уезжала на 170 px вниз.
const FILTERS = [
  { id: "f-1c", out: { "Tilda": "нет связи с 1С" } },
  { id: "f-services", out: { "Яндекс KIT": "услуги только заявкой, без оплаты" } },
  { id: "f-design", out: {} },
  { id: "f-b2b", out: { "Tilda": "нет типов цен и складов" } },
  { id: "f-bonus", out: { "Tilda": "бонусов нет, только сторонние сервисы", "Яндекс KIT": "бонусы только через RetailCRM" } },
  { id: "f-nodev", out: { "1С-Битрикс": "нужен разработчик", "WooCommerce": "нужен разработчик", "OpenCart": "нужен разработчик" } },
  { id: "f-server", out: { "Tilda": "только облако", "Яндекс KIT": "только облако", "inSales": "только облако", "AdvantShop": "облачный тариф" } },
];
const TAKEAWAY = {
  site: [document.querySelector("#takeaway b")?.textContent || "", document.getElementById("takeaway").lastChild?.textContent || ""],
  mp: ["Для продавцов маркетплейсов", "inSales заявляет обмен остатками между площадками. У KIT подтверждён импорт товаров и остатков; обратный обмен и состав обработки заказов нужно уточнить. Итоговая стоимость зависит от выбранной связки и состава интеграций."],
};

const active = new Set();
let mode = "site";

function apply() {
  document.querySelector(".platform-comparison").classList.toggle("mp", mode === "mp");
  document.querySelectorAll(".seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  const [lead, text] = TAKEAWAY[mode];
  const box = document.getElementById("takeaway");
  box.replaceChildren(Object.assign(document.createElement("b"), { textContent: lead }), document.createTextNode(text));

  let fitting = 0;
  const fitNames = [];
  NAMES.forEach((name, i) => {
    const reasons = FILTERS.filter(f => active.has(f.id) && f.out[name]).map(f => f.out[name]);
    const out = reasons.length > 0;
    if (!out) { fitting++; fitNames.push(name); }
    document.querySelectorAll(`[data-p="${i}"]`).forEach(c => {
      c.classList.toggle("out", out);
      c.classList.toggle("best", name === BEST && !out);
    });
    document.querySelector(`thead [data-p="${i}"] .why`).textContent = out ? "Ограничения: " + reasons.join("; ") : "";
  });

  const count = document.getElementById("count");
  count.replaceChildren();
  const total = Object.assign(document.createElement("b"), { textContent: `${fitting} из ${NAMES.length}` });
  // Осталось четыре или меньше — называем их (think-different, итерация 128): «1 из 8» не говорило, какая это платформа,
  // и на телефоне, где видны две колонки, её приходилось искать перебором пар. Больше четырёх — строка была бы длиннее экрана.
  // Число и названия — в одном элементе: #count — flex, и отдельным куском тире уезжало бы в начало новой строки.
  const named = active.size && fitting > 0 && fitting <= 4;
  if (named) {
    const fit = document.createElement("span");
    fit.append(total, "\u00a0— " + fitNames.join(", ") + (active.size ? "\u00a0·\u00a0" : ""));
    count.append("Без отмеченных ограничений: ", fit);
  } else count.append("Без отмеченных ограничений: ", total);
  if (active.size) {
    const reset = Object.assign(document.createElement("button"), { type: "button", className: "reset", textContent: "Сбросить" });
    reset.addEventListener("click", () => {
      const returnTo=[...active][0];
      active.clear();
      document.querySelectorAll(".chips button").forEach(b => b.setAttribute("aria-pressed", "false"));
      apply();
      writeURL();
      document.getElementById(returnTo)?.focus();
    });
    // С названиями «·» уже стоит в конце их строки: отдельным куском он повисал бы в начале строки перед «Сбросить»
    if (named) count.append(reset); else count.append(" · ", reset);
  }
  try { localStorage.setItem("emilius-platform-mode-v1", mode); } catch (e) {}
}

// Отмеченные ограничения и режим — в адресе (think-different, итерация 52): обновление страницы и пересланная ссылка
// показывают тот же отбор. Принимаются только известные id фильтров и режимы site/mp. Пишем только по действию человека.
function writeURL() {
  const url = new URL(location.href);
  if (active.size) url.searchParams.set("need", [...active].join(",")); else url.searchParams.delete("need");
  if (mode === "mp") url.searchParams.set("mode", "mp"); else url.searchParams.delete("mode");
  history.replaceState(history.state, "", url.href);
}
const startParams = new URL(location.href).searchParams;
for (const id of (startParams.get("need") || "").split(",")) if (FILTERS.some(f => f.id === id)) active.add(id);

for (const f of FILTERS) {
  const b = document.getElementById(f.id);
  if (!b) continue;
  b.setAttribute("aria-pressed", String(active.has(f.id)));
  b.addEventListener("click", () => {
    active.has(f.id) ? active.delete(f.id) : active.add(f.id);
    b.setAttribute("aria-pressed", String(active.has(f.id)));
    apply();
    writeURL();
  });
}
document.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => { mode = b.dataset.mode; apply(); writeURL(); }));
try { if (localStorage.getItem("emilius-platform-mode-v1") === "mp") mode = "mp"; } catch (e) {}
if (startParams.get("mode") === "mp" || startParams.get("mode") === "site") mode = startParams.get("mode");
apply();
