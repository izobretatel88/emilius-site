type Device = 'desktop' | 'phone';
type Screen = {device: Device; label: string; src: string; width: number; height: number};
type ProjectMedia = {name: string; inquiry: string; screens: Screen[]};

export function setupProjectViewer() {
  const viewer = document.querySelector<HTMLDialogElement>('.project-viewer');
  const source = document.querySelector('#project-media');
  if (!viewer || !source || typeof viewer.showModal !== 'function') return;
  const projects: Record<string, ProjectMedia> = JSON.parse(source.textContent!);
  const image = viewer.querySelector<HTMLImageElement>('img')!;
  const imageBox = viewer.querySelector<HTMLElement>('.viewer-image')!;
  const title = viewer.querySelector<HTMLElement>('#viewer-title')!;
  const status = viewer.querySelector<HTMLElement>('.viewer-status')!;
  const error = viewer.querySelector<HTMLElement>('.viewer-error')!;
  const inquiry = viewer.querySelector<HTMLAnchorElement>('.viewer-inquiry')!;
  const screensControl = viewer.querySelector<HTMLElement>('.viewer-screens')!;
  const deviceButtons = [...viewer.querySelectorAll<HTMLButtonElement>('[data-device]')];
  const paging = viewer.querySelector<HTMLElement>('.viewer-paging')!;
  const previous = viewer.querySelector<HTMLButtonElement>('[data-prev-screen]')!;
  const next = viewer.querySelector<HTMLButtonElement>('[data-next-screen]')!;
  let opener: HTMLAnchorElement | null = null;
  let project: ProjectMedia | null = null;
  let device: Device = 'desktop';
  let index = 0;
  let request = 0;
  const screens = () => project?.screens.filter(screen => screen.device === device) ?? [];

  const render = () => {
    const list = screens();
    const screen = list[index];
    if (!project || !screen) return;
    const currentProject = project;
    const version = ++request;
    error.hidden = true;
    image.hidden = false;
    imageBox.dataset.device = device;
    imageBox.setAttribute('aria-busy', 'true');
    const description = `${device === 'phone' ? 'Телефон' : 'Компьютер'} · ${screen.label}`;
    status.textContent = `${description} · загружаем снимок…`;
    const ready = () => {
      if (version !== request) return;
      imageBox.setAttribute('aria-busy', 'false');
      status.textContent = `${currentProject.name} · ${description}${list.length > 1 ? ` · ${index + 1} из ${list.length}` : ''}`;
    };
    image.onload = ready;
    image.onerror = () => {
      if (version !== request) return;
      imageBox.setAttribute('aria-busy', 'false');
      image.hidden = true;
      error.hidden = false;
      status.textContent = `${description} · снимок недоступен`;
    };
    image.width = screen.width;
    image.height = screen.height;
    image.alt = `${project.name}: ${screen.label}, ${device === 'phone' ? 'мобильная версия' : 'компьютер'}`;
    image.src = screen.src;
    imageBox.scrollTop = imageBox.scrollLeft = 0;
    // Уже декодированный снимок может не прислать повторный load.
    if (image.complete && image.naturalWidth) ready();
    deviceButtons.forEach(button => {
      button.hidden = !project!.screens.some(item => item.device === button.dataset.device);
      button.setAttribute('aria-pressed', String(button.dataset.device === device));
    });
    screensControl.querySelectorAll<HTMLButtonElement>('button').forEach((button, i) => {
      button.setAttribute('aria-pressed', String(i === index));
    });
    paging.hidden = list.length < 2;
    previous.disabled = index === 0;
    next.disabled = index === list.length - 1;
  };

  const chooseDevice = (value: Device) => {
    if (!project?.screens.some(screen => screen.device === value)) return;
    device = value;
    index = 0;
    screensControl.replaceChildren();
    screens().forEach((screen, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = screen.label;
      button.addEventListener('click', () => { index = i; render(); });
      screensControl.append(button);
    });
    render();
  };

  document.querySelectorAll<HTMLAnchorElement>('[data-project-preview]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const selected = projects[link.dataset.projectPreview!];
      if (!selected?.screens.length) return;
      event.preventDefault();
      opener = link;
      project = selected;
      title.textContent = selected.name;
      inquiry.href = selected.inquiry;
      inquiry.textContent = link.dataset.projectPreview === 'navalishenskoe' ? 'Хочу похожий сайт ↗' : 'Хочу похожий магазин ↗';
      chooseDevice('desktop');
      viewer.showModal();
      viewer.scrollTop = 0;
    });
  });
  deviceButtons.forEach(button => button.addEventListener('click', () => chooseDevice(button.dataset.device as Device)));
  previous.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });
  next.addEventListener('click', () => { if (index + 1 < screens().length) { index += 1; render(); } });
  viewer.querySelector('[data-retry-viewer]')!.addEventListener('click', render);
  viewer.querySelector('[data-close-viewer]')!.addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', event => { if (event.target === viewer) viewer.close(); });
  viewer.addEventListener('close', () => {
    request += 1;
    image.onload = image.onerror = null;
    opener?.focus({preventScroll: true});
  });
}
