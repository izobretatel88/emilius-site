const NAMES = ["Tilda", "Яндекс KIT", "InSales", "Shop-Script", "AdvantShop", "1С-Битрикс", "WooCommerce", "OpenCart"];
const BEST = null; // единственная платформа с синхронизацией WB и Ozon в тарифе

// Быстрые фильтры (из 08-anketa-vybora.csv): какие платформы отпадают и почему.
const FILTERS = [
  { id: "f-1c", label: "Нужна 1С", out: { "Tilda": "нет связи с 1С" } },
  { id: "f-services", label: "Продаю услуги", out: { "Яндекс KIT": "услуги только заявкой, без оплаты" } },
  { id: "f-design", label: "Нужен свой дизайн", out: {} },
  { id: "f-b2b", label: "Опт и B2B", out: { "Tilda": "нет типов цен и складов" } },
  { id: "f-bonus", label: "Нужны бонусные баллы", out: { "Tilda": "бонусов нет, только сторонние сервисы", "Яндекс KIT": "бонусы только через RetailCRM" } },
  { id: "f-nodev", label: "Без программиста", out: { "1С-Битрикс": "нужен разработчик", "WooCommerce": "нужен разработчик", "OpenCart": "нужен разработчик" } },
  { id: "f-server", label: "Данные на своём сервере", out: { "Tilda": "только облако", "Яндекс KIT": "только облако", "InSales": "только облако", "AdvantShop": "облачный тариф" } },
];
const TAKEAWAY = {
  site: ["Как выбирать", "Сопоставьте каталог, процессы и ограничения платформы. Затраты включают запуск, подписку и внешние сервисы; одного тарифа для решения недостаточно. Неизвестные возможности уточняйте у платформы."],
  mp: ["Для продавцов маркетплейсов", "InSales заявляет обмен остатками между площадками. У KIT подтверждён импорт товаров и остатков; обратный обмен и состав обработки заказов нужно уточнить. Итоговая стоимость зависит от выбранной связки и состава интеграций."],
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
  NAMES.forEach((name, i) => {
    const reasons = FILTERS.filter(f => active.has(f.id) && f.out[name]).map(f => f.out[name]);
    const out = reasons.length > 0;
    if (!out) fitting++;
    document.querySelectorAll(`[data-p="${i}"]`).forEach(c => {
      c.classList.toggle("out", out);
      c.classList.toggle("best", name === BEST && !out);
    });
    document.querySelector(`thead [data-p="${i}"] .why`).textContent = out ? "Не подходит: " + reasons.join("; ") : "";
  });

  const count = document.getElementById("count");
  count.replaceChildren();
  if (active.size) {
    const reset = Object.assign(document.createElement("button"), { type: "button", className: "reset", textContent: "Сбросить" });
    reset.addEventListener("click", () => {
      active.clear();
      document.querySelectorAll(".chips button").forEach(b => b.setAttribute("aria-pressed", "false"));
      apply();
    });
    count.append("Подходят: ", Object.assign(document.createElement("b"), { textContent: `${fitting} из ${NAMES.length}` }), " · ", reset);
  }
  try { localStorage.setItem("emilius-platform-mode-v1", mode); } catch (e) {}
}

const chips = document.getElementById("chips");
for (const f of FILTERS) {
  const b = Object.assign(document.createElement("button"), { type: "button", id: f.id, textContent: f.label });
  b.setAttribute("aria-pressed", "false");
  b.addEventListener("click", () => {
    active.has(f.id) ? active.delete(f.id) : active.add(f.id);
    b.setAttribute("aria-pressed", String(active.has(f.id)));
    apply();
  });
  chips.append(b);
}
document.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => { mode = b.dataset.mode; apply(); }));
try { if (localStorage.getItem("emilius-platform-mode-v1") === "mp") mode = "mp"; } catch (e) {}
apply();
