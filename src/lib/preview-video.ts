// Видео в превью проекта: прокрутка сайта играет, пока над превью курсор мыши или на нём фокус с клавиатуры,
// и гаснет до снимка, когда курсор или фокус ушли. Разметка: ссылка-превью с [data-preview-video],
// внутри <video class="preview-video" preload="none">. Видео лежат в public/video/gallery/,
// снимаются scripts/record-gallery.mjs.
//
// Не играем: на сенсорных экранах (наведения нет), при «уменьшении движения» и в режиме экономии трафика.
// Курсор, который просто проскочил через превью, видео не загружает — ждём 150 мс.

const INTENT = 150; // мс: курсор задержался — значит, смотрят
const FADE = 200; // мс: как --hover, затухание видео до снимка

type Connection = { saveData?: boolean };

export function setupPreviewVideos(root: ParentNode = document) {
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = () => Boolean((navigator as Navigator & { connection?: Connection }).connection?.saveData);
  const stops: (() => void)[] = [];

  root.querySelectorAll<HTMLElement>('[data-preview-video]').forEach((preview) => {
    const video = preview.querySelector<HTMLVideoElement>('.preview-video');
    if (!video) return;
    let intent = 0;
    let rewind = 0;
    let wanted = false;

    const start = (delay: number) => {
      if (calm.matches || saveData()) return;
      wanted = true;
      clearTimeout(rewind);
      clearTimeout(intent);
      intent = window.setTimeout(() => {
        if (!wanted) return;
        video
          .play()
          .then(() => {
            // курсор успел уйти, пока видео грузилось, — не показываем
            if (wanted) preview.classList.add('is-playing');
            else video.pause();
          })
          .catch(() => {});
      }, delay);
    };
    const stop = () => {
      wanted = false;
      clearTimeout(intent);
      preview.classList.remove('is-playing');
      // после затухания — на начало, чтобы следующий показ начинался с первого экрана
      rewind = window.setTimeout(() => {
        video.pause();
        if (video.readyState > 0) video.currentTime = 0;
      }, FADE);
    };
    stops.push(stop);

    preview.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse' && canHover.matches) start(INTENT);
    });
    preview.addEventListener('pointerleave', () => {
      if (!preview.matches(':focus-visible')) stop();
    });
    preview.addEventListener('focus', () => {
      if (preview.matches(':focus-visible')) start(0);
    });
    preview.addEventListener('blur', () => {
      if (!preview.matches(':hover')) stop();
    });
  });

  // Вкладку свернули — останавливаем, чтобы видео не крутилось в фоне
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stops.forEach((stop) => stop());
  });
}
