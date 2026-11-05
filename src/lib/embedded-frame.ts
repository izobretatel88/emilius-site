/** The load event confirms the frame loaded, not that the voice service is available. */
export function setupEmbeddedFrame(root:HTMLElement){
  const frame=root.querySelector<HTMLIFrameElement>('iframe[data-src]')!;
  const wrapper=root.querySelector<HTMLElement>('.emi-widget')!;
  const fallback=root.querySelector<HTMLElement>('[data-widget-fallback]')!;
  const status=root.querySelector<HTMLElement>('[data-frame-status]')!;
  const retry=root.querySelector<HTMLButtonElement>('[data-frame-retry]')!;
  const contact=root.querySelector<HTMLElement>('[data-widget-contact]')!;
  let state:'idle'|'loading'|'loaded'|'error'='idle';
  let timer:number|undefined;
  const render=()=>{
    root.dataset.widgetState=state;
    wrapper.setAttribute('aria-busy',String(state==='loading'));
    frame.hidden=state!=='loaded';
    fallback.hidden=state==='loaded';
    status.textContent=state==='loading'?'Загружаем интерфейс Эми…':state==='error'?'Не удалось загрузить интерфейс Эми.':'Голосовой помощник';
    contact.hidden=state!=='error';
    retry.hidden=state==='idle';
    retry.disabled=state==='loading';
    retry.textContent=state==='loading'?'Загружаем…':state==='loaded'?'Перезагрузить Эми':'Повторить загрузку';
  };
  const fail=()=>{if(state!=='loading')return;window.clearTimeout(timer);state='error';render();};
  const start=(force=false)=>{
    if(!force&&state!=='idle')return;
    window.clearTimeout(timer);
    state='loading';render();
    frame.onload=()=>{if(state!=='loading')return;window.clearTimeout(timer);state='loaded';render();};
    frame.onerror=fail;
    timer=window.setTimeout(fail,20000);
    frame.src=frame.dataset.src!;
  };
  retry.addEventListener('click',()=>start(true));
  render();
  return {load:()=>start()};
}
