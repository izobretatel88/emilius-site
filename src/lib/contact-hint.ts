// Подсказка к полю контакта (think-different, итерация 60): «ivan_shop» без @ может быть и ником в Telegram,
// и чем угодно ещё — менеджер гадает, куда отвечать. Если текст похож на ник Telegram (5–32 латинских букв,
// цифр и «_», начинается с буквы), спокойно предлагаем добавить @. Значение без согласия человека не меняем.
const USERNAME = /^[a-z][a-z0-9_]{4,31}$/i;

export function contactHint(input: HTMLInputElement) {
  const hint = document.createElement('p');
  hint.className = 'ui-field-hint';
  hint.hidden = true;
  hint.setAttribute('role', 'status');
  hint.append('Это ник в Telegram? ');
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'ui-link';
  add.textContent = 'Добавить @';
  add.style.cssText = 'min-height:44px;padding:0;border:0;background:none;font:inherit;color:var(--teal-text);text-decoration:underline;text-underline-offset:4px;cursor:pointer';
  hint.append(add);
  (input.closest('label') ?? input).insertAdjacentElement('afterend', hint);

  // Проверяем во время набора, после паузы — не при уходе из поля: иначе подсказка сдвинула бы кнопку «Отправить» под пальцем
  const check = () => { hint.hidden = !USERNAME.test(input.value.trim()); };
  let timer = 0;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    if (!hint.hidden) check();
    else timer = window.setTimeout(check, 700);
  });
  add.addEventListener('click', () => {
    input.value = `@${input.value.trim()}`;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    hint.hidden = true;
    input.focus();
  });
}
