// Новое значение расчёта проявляется за --fade-in (только прозрачность), чтобы было видно: цифра пересчиталась.
// Анимация — только после действия посетителя: первый расчёт при загрузке не мигает.
// При «уменьшить движение» длительность гасит global.css.
let armed=false;
for(const type of ['change','click','keydown'])document.addEventListener(type,()=>{armed=true;},{capture:true,once:true});

export function showUpdate(el:Element|null,text:string){
  if(!el||el.textContent===text)return;
  el.textContent=text;
  if(!armed)return;
  el.classList.remove('ui-updated');
  void (el as HTMLElement).offsetWidth; // перезапуск анимации
  el.classList.add('ui-updated');
}

export function updateLiveEstimate(root:ParentNode,price:string|null){
  const strip=root.querySelector<HTMLElement>('[data-live-estimate]');
  if(!strip)return;
  strip.hidden=!price;
  if(price)showUpdate(strip.querySelector('[data-estimate-strip]'),price);
}
