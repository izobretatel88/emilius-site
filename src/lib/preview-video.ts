// Видео в превью проекта: прокрутка сайта клиента поверх снимка. Видео лежат в public/video/gallery/,
// снимаются scripts/record-gallery.mjs; рядом лёгкие копии 640 px (-640.mp4) для узких превью.
// Разметка: ссылка-превью с [data-preview-video], внутри <video class="preview-video" data-src data-src-small>.
// Источник ставим только перед первым показом — до этого видео не грузится вовсе.
//
// Компьютер (мышь): играет, пока курсор над превью (после 150 мс — проскочивший курсор ничего не грузит)
// или на превью фокус с клавиатуры.
// Телефон и планшет (наведения нет): играет превью, которое после остановки прокрутки видно хотя бы на 70%;
// одновременно — только одно, ушло с экрана — остановилось.
// Нигде не играем при «уменьшении движения» и в режиме экономии трафика: остаётся снимок.

const INTENT = 150; // мс: курсор задержался — значит, смотрят
const SETTLE = 400; // мс: прокрутка на телефоне остановилась
const VISIBLE = 0.7; // доля превью на экране, чтобы видео пошло на телефоне
const FADE = 200; // мс: как --hover, затухание видео до снимка
const SMALL = 700; // px: превью уже — берём лёгкую копию 640 px

type Connection = { saveData?: boolean };
type Player = { preview: HTMLElement; start: (delay: number) => void; stop: () => void };

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
      const small = video.dataset.srcSmall && preview.clientWidth <= SMALL;
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
    players.push({ preview, start, stop });

    preview.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse' && canHover.matches) start(INTENT);
    });
    preview.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !preview.matches(':focus-visible')) stop();
    });
    preview.addEventListener('focus', () => {
      if (preview.matches(':focus-visible')) start(0);
    });
    preview.addEventListener('blur', () => {
      if (canHover.matches && !preview.matches(':hover')) stop();
    });
    // Превью открыло окно просмотра или ушло по ссылке — видео под ним больше не нужно
    preview.addEventListener('click', stop);
  });
  if (!players.length) return;

  // Телефон: после остановки прокрутки играет самое видимое превью
  let settle = 0;
  const pickVisible = () => {
    if (canHover.matches) return;
    let best: Player | null = null;
    let bestShare = VISIBLE;
    for (const player of players) {
      const r = player.preview.getBoundingClientRect();
      const shown = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      const share = r.height ? shown / r.height : 0;
      if (share >= bestShare) [best, bestShare] = [player, share];
    }
    players.forEach((player) => (player === best ? player.start(0) : player.stop()));
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
