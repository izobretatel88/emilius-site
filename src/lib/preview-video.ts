// Видео в превью проекта: прокрутка сайта клиента поверх снимка. Видео лежат в public/video/gallery/,
// снимаются scripts/record-gallery.mjs; рядом лёгкие копии 640 px (-640.mp4) для телефона и узких превью.
// Разметка: ссылка-превью с [data-preview-video], внутри <video class="preview-video" data-src data-src-small>.
// Источник ставим только перед первым показом — до этого видео не грузится вовсе.
//
// Компьютер (мышь): играет, пока курсор над превью (после 150 мс — проскочивший курсор ничего не грузит)
// или на превью фокус с клавиатуры.
// Телефон и планшет (наведения нет): играет превью, которое после остановки прокрутки видно хотя бы на 70%;
// одновременно — только одно, один раз за показ, ушло с экрана — остановилось.
// Нигде не играем при «уменьшении движения» и в режиме экономии трафика: остаётся снимок.

const INTENT = 150; // мс: курсор задержался — значит, смотрят
const SETTLE = 400; // мс: прокрутка на телефоне остановилась
const VISIBLE = 0.7; // доля превью на экране, чтобы видео пошло на телефоне
const FADE = 200; // мс: как --hover, затухание видео до снимка
const SMALL = 720; // физических px: превью уже — берём лёгкую копию 640 px

type Connection = { saveData?: boolean };
// done — на телефоне ролик уже проигран в этот показ превью; снова — только когда превью уйдёт с экрана и вернётся
type Player = { preview: HTMLElement; start: (delay: number) => void; stop: () => void; done: boolean };

export function setupPreviewVideos(root: ParentNode = document) {
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = () => Boolean((navigator as Navigator & { connection?: Connection }).connection?.saveData);
  const players: Player[] = [];

  root.querySelectorAll<HTMLElement>('[data-preview-video]').forEach((preview) => {
    const video = preview.querySelector<HTMLVideoElement>('.preview-video');
    if (!video) return;
    let intent = 0;
    let rewind = 0;
    let wanted = false;

    const load = () => {
      if (video.getAttribute('src')) return;
      // Телефон — всегда лёгкая копия (трафик); компьютер — по реальным пикселям, чтобы на Retina не было мыла
      const small = video.dataset.srcSmall && (!canHover.matches || preview.clientWidth * devicePixelRatio <= SMALL);
      video.src = (small ? video.dataset.srcSmall : video.dataset.src) ?? '';
    };
    const start = (delay: number) => {
      if (calm.matches || saveData()) return;
      wanted = true;
      clearTimeout(rewind);
      clearTimeout(intent);
      intent = window.setTimeout(() => {
        if (!wanted) return;
        load();
        video
          .play()
          .then(() => {
            // показ отменили, пока видео грузилось, — не проявляем
            if (wanted) preview.classList.add('is-playing');
            else video.pause();
          })
          // iOS в режиме энергосбережения не даёт играть без касания — остаётся снимок
          .catch(() => {});
      }, delay);
    };
    const stop = () => {
      if (!wanted && !preview.classList.contains('is-playing')) return;
      wanted = false;
      clearTimeout(intent);
      preview.classList.remove('is-playing');
      // после затухания — на начало, чтобы следующий показ начинался с первого экрана
      rewind = window.setTimeout(() => {
        video.pause();
        if (video.readyState > 0) video.currentTime = 0;
      }, FADE);
    };
    const player: Player = { preview, start, stop, done: false };
    // Конец ролика: не прыгаем от подвала к шапке, а гасим видео до снимка.
    // Мышь над превью — перематываем и проявляем снова. Телефон (видео пошло само) и фокус с клавиатуры — один раз
    // и остаёмся на снимке: движение, которое не остановить, не крутится бесконечно (WCAG 2.2.2)
    video.addEventListener('ended', () => {
      preview.classList.remove('is-playing');
      if (!canHover.matches || !preview.matches(':hover')) {
        player.done = true;
        wanted = false;
        rewind = window.setTimeout(() => { video.currentTime = 0; }, FADE);
        return;
      }
      rewind = window.setTimeout(() => {
        video.currentTime = 0;
        if (wanted) video.play().then(() => wanted && preview.classList.add('is-playing')).catch(() => {});
      }, FADE + 300);
    });
    players.push(player);

    preview.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse' && canHover.matches) start(INTENT);
    });
    preview.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !preview.matches(':focus-visible')) stop();
    });
    preview.addEventListener('focus', () => {
      // Фокус вернуло окно просмотра (data-returning ставит project-viewer.ts) — видео не запускаем:
      // проект только что смотрели крупно. Метка одноразовая
      if (preview.hasAttribute('data-returning')) { preview.removeAttribute('data-returning'); return; }
      if (preview.matches(':focus-visible') && !player.done) start(0);
    });
    preview.addEventListener('blur', () => {
      if (!canHover.matches) return;
      // Ушли с превью — следующий фокус снова покажет ролик
      player.done = false;
      if (!preview.matches(':hover')) stop();
    });
    // Превью открыло окно просмотра или ушло по ссылке — видео под ним больше не нужно
    preview.addEventListener('click', stop);
  });
  if (!players.length) return;

  // Телефон: после остановки прокрутки играет самое видимое превью
  let settle = 0;
  const pickVisible = () => {
    if (canHover.matches) return;
    // Из превью, видных на 70%+, — то, что ближе к середине экрана: на него и смотрят
    let best: Player | null = null;
    let bestGap = Infinity;
    for (const player of players) {
      const r = player.preview.getBoundingClientRect();
      const shown = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      const share = r.height ? shown / r.height : 0;
      if (share < VISIBLE) {
        player.done = false; // ушло с экрана — при возвращении сыграет снова
        continue;
      }
      const gap = Math.abs(r.top + r.height / 2 - innerHeight / 2);
      if (gap < bestGap) [best, bestGap] = [player, gap];
    }
    players.forEach((player) => (player === best ? !player.done && player.start(0) : player.stop()));
  };
  const onScroll = () => {
    if (canHover.matches) return;
    clearTimeout(settle);
    settle = window.setTimeout(pickVisible, SETTLE);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  onScroll();

  // Вкладку свернули — останавливаем, чтобы видео не крутилось в фоне; вернулись — телефон выберет заново
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) players.forEach((player) => player.stop());
    else onScroll();
  });
}
