# Emilius Meetings: страницы для Google OAuth

Состояние на 23.10.2026. Бот — `~/Documents/DevOps Emilius/meeting_automation` (не в этом репозитории). Тексты страниц написаны по его коду: `adapters/google.py`, `adapters/mymeet.py`, `adapters/telegram.py`, `google_onboarding.py`.

## Что сделано

| Страница | Файл | Адрес после релиза |
|---|---|---|
| Приложение | `src/pages/meetings/index.astro` | https://emilius.agency/meetings/ |
| Политика конфиденциальности | `src/pages/meetings/privacy.astro` | https://emilius.agency/meetings/privacy/ |
| Условия использования | `src/pages/meetings/terms.astro` | https://emilius.agency/meetings/terms/ |

Название, scope и дата редакции — `src/data/meetings.ts`. Меню трёх страниц — `src/components/MeetingsNav.astro`. Страницы в карте сайта, без `noindex`, текст в HTML (без скриптов).

## Значения для Google Auth Platform → Branding

Вписывать **после** того, как страницы открываются на emilius.agency (см. «Что мешает»). Адреса — со слешем на конце: так сервер сразу отвечает 200, без редиректа.

| Поле | Значение |
|---|---|
| App name | `Emilius Meetings` (сейчас в проекте — Meet Auto Emilius, поменять) |
| Application home page | `https://emilius.agency/meetings/` |
| Application privacy policy link | `https://emilius.agency/meetings/privacy/` |
| Application terms of service link | `https://emilius.agency/meetings/terms/` |
| Authorized domains | `emilius.agency` |

User support email Google даёт выбрать только из адресов аккаунта, который настраивает проект, или его Google-групп. `behappy@emilius.agency` на страницах — контакт поддержки для людей; в поле Google можно оставить адрес аккаунта проекта.

## Что мешает прямо сейчас

1. **Домен ещё на Tilda.** 23.10.2026 `emilius.agency` и `www` → `185.215.4.32` (Tilda). Страницы заработают на домене только после переключения A-записей на Бегет (`docs/RELEASE.md`, раздел 4). До этого адреса выше отдают 404 Tilda, и Google их не примет.
2. **Подтверждение владения доменом.** Authorized domain должен быть подтверждён в Google Search Console тем же аккаунтом, который владеет проектом Google Cloud (Owner/Editor проекта `tokyo-dream-425219-u3`). Способ — ресурс «Домен» `emilius.agency` и TXT-запись `google-site-verification=…` в DNS 101domain. Это **дополнительная** TXT-запись: SPF, MX и DKIM Яндекса не трогать. Подтверждение по DNS не зависит от Tilda/Бегета, его можно сделать уже сейчас.

## Вопросы владельцу (в тексты не вносили, пока не подтверждено)

1. **Срок хранения.** Сколько хранить записи в базе бота и документы встреч? Сейчас в политике честно: автоматического удаления нет.
2. **Какие папки видит технический аккаунт.** Ему расшарены только папки проектов или это аккаунт с личным Диском? Если только папки проектов — так и напишем, это сильно сужает фактический доступ.
3. **Limited Use.** На страницах опубликовано обязательство соблюдать Google API Services User Data Policy и Limited Use (Google требует такую фразу). По коду бот его соблюдает: данные Google никуда не передаются, кроме ссылки на документ в Telegram. Подтвердить, что так и останется.
4. **Где сервер бота** (страна/хостинг) — для 152-ФЗ и трансграничной передачи. В политике не указано.
5. **MyMeet.** Где MyMeet хранит записи и конспекты, сколько, можно ли удалить из кабинета агентства, использует ли их для обучения моделей. Это данные участников встречи, не Google, но для 152-ФЗ и честного ответа на запрос об удалении нужно знать.
6. **Яндекс Диск и видео.** В коде есть архив записей на Яндекс Диске и отправка MP4 в Telegram, в пилоте выключено. Когда включим — дописать в политику.
7. **152-ФЗ.** Голос, имена и реплики участников встречи — персональные данные. Основание обработки, уведомление РКН, юрист — вместе с политикой сайта.
8. **Английская версия.** Если пойдём на полную верификацию Google, проверяющим удобнее английский текст. Сейчас по-английски только фраза Limited Use.

## Как Google смотрит на это приложение (для решения владельца)

- В режиме Testing refresh-токен с доступом к Диску живёт 7 дней — поэтому бот теряет доступ и его нужно переводить в In production.
- `https://www.googleapis.com/auth/drive` — restricted scope. Полная верификация такого доступа требует ежегодной проверки безопасности CASA у стороннего аудитора. Без верификации приложение в In production работает, но показывает экран «Google не проверил это приложение» и ограничено 100 пользователями. Для одного технического аккаунта этого достаточно: экран проходится один раз при авторизации.
- Страницы готовят приложение к настройке OAuth, но не гарантируют одобрение Google.
- Сузить доступ до `drive.file` можно только с выбором папок через Google Picker — в боте это не сделано (`docs/GOOGLE_USER_OAUTH_SETUP.md` в проекте бота). В рамках этой задачи права бота не меняли.

Источники: [справка по брендингу](https://support.google.com/cloud/answer/15549049), [User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), [Workspace API user data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy), [верификация](https://support.google.com/cloud/answer/7454865), [срок refresh-токена в Testing](https://developers.google.com/identity/protocols/oauth2).

## Если бот изменится

Новый scope, новые сервисы (Яндекс Диск, видео в Telegram), другая схема хранения — обновить `src/pages/meetings/privacy.astro` и дату в `src/data/meetings.ts`. Политика должна совпадать с тем, что бот делает на самом деле.
