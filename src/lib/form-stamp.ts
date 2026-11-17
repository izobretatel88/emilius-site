// Метка «форму отправила страница»: сколько секунд она была открыта до отправки.
// lead.php без метки заявку не принимает — боты шлют POST напрямую, скрипты страницы не запускают.
const opened = performance.now();

export const stampForm = (data: FormData): FormData => {
  data.set('fill', String(Math.round((performance.now() - opened) / 1000)));
  return data;
};
