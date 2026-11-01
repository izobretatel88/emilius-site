export function updateLiveEstimate(root:ParentNode,price:string|null){
  const strip=root.querySelector<HTMLElement>('[data-live-estimate]');
  if(!strip)return;
  strip.hidden=!price;
  const output=strip.querySelector('[data-estimate-strip]');
  if(output&&price)output.textContent=price;
}
