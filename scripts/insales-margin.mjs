// Селлеру: сколько остаётся с заказа на маркетплейсе и на своём сайте, и сколько заказов в месяц окупают магазин.
//   node scripts/insales-margin.mjs --check 3500 --cost 1400 [--mp 0.335] [--ad 250] [--project 119000] [--tariff 6600]
// --mp       доля выручки, которую забирает площадка со всеми расходами (по умолчанию 33,5%: селлер получает ~66,5%,
//            разбор на vc.ru, 2025 — подставлять цифру клиента из его отчёта, если он её знает)
// --ad       расход на привлечение одного заказа на сайт, ₽ (повторные покупки из своей базы — около 0)
// --acq      эквайринг и касса, доля (по умолчанию 3%)
// Доставку на сайте оплачивает покупатель — в расчёт не входит. Проект окупаем за 12 месяцев.
const a = Object.fromEntries(process.argv.slice(2).reduce((r, x, i, arr) => (x.startsWith('--') ? [...r, [x.slice(2), Number(arr[i + 1])]] : r), []));
const check = a.check, cost = a.cost;
if (!check || !cost) {
  console.error('Укажите --check (средний чек, ₽) и --cost (себестоимость, ₽)');
  process.exit(1);
}
const mp = a.mp ?? 0.335, ad = a.ad ?? 250, acq = a.acq ?? 0.03, project = a.project ?? 119000, tariff = a.tariff ?? 6600;
const rub = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';

const onMp = check * (1 - mp) - cost;
const onSite = check * (1 - acq) - cost - ad;
const monthly = tariff + project / 12;
const breakEven = Math.ceil(monthly / onSite);
// Для селлера сайт — не замена, а покупатели, которые иначе купили бы на площадке: считаем прирост маржи к ней.
const vsMp = onSite - onMp;

console.log(`Средний чек ${rub(check)}, себестоимость ${rub(cost)}
  с заказа на площадке остаётся:  ${rub(onMp)}  (площадка забирает ${(mp * 100).toLocaleString("ru-RU")}% выручки)
  с заказа на сайте остаётся:     ${rub(onSite)}  (эквайринг ${Math.round(acq * 100)}%, привлечение ${rub(ad)})
  разница в пользу сайта:         ${rub(vsMp)} с заказа

Сайт в месяц: тариф ${rub(tariff)} + проект ${rub(project)} / 12 = ${rub(monthly)}
  ${onSite > 0 ? `окупается при ${breakEven} заказах в месяц с сайта (${(breakEven / 30).toFixed(1).replace('.', ',')} в день)` : 'не окупается: заказ на сайте убыточный'}
  если это покупатели, ушедшие с площадки: ${vsMp > 0 ? Math.ceil(monthly / vsMp) + ' заказов в месяц' : 'не окупается — сайт дороже площадки на заказ'}`);
if (onSite <= 0) console.log('\n  ВНИМАНИЕ: на сайте заказ убыточный при таком привлечении. Магазин не продаём, пока нет своей базы или дешёвого трафика.');
