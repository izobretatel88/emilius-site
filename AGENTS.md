# Инструкции для Codex

Правила проекта общие для всех агентов и лежат в `CLAUDE.md`. Прочитай его целиком перед работой, затем `docs/HANDOFF.md`: там состояние проекта, решения владельца, открытые вопросы и известные грабли.

Коротко о главном:

- Работаем в ветке `dev` (видна на https://izobretatel88.github.io/emilius-site/dev/). В `main` вливаем только после одобрения владельца.
- Цвета, радиусы, тени и шрифты берутся только из `src/styles/tokens.css`.
- Связь «день ↔ сектор» у колеса продукта не ломать (52 деления, 4 сектора по 13).
- Тексты на русском, короткие, с цифрами в кейсах.
- Итерации записываются в `CHANGELOG.md`, номер итерации — в `src/data/site.ts`.
- Репозиторий публичный: ключи, пароли и сырые выгрузки клиентов не коммитить.

## Подпись изменений

В этой папке работают и владелец, и Claude Code, поэтому Codex подписывается отдельно.

- Коммиты делай с автором Codex, не меняя `git config` (настройка общая для всех):
  `GIT_AUTHOR_NAME=Codex GIT_AUTHOR_EMAIL=codex@emilius.agency GIT_COMMITTER_NAME=Codex GIT_COMMITTER_EMAIL=codex@emilius.agency git commit ...`
- Первая строка коммита — по-русски, как в истории проекта, с пометкой ветки, например `(dev)`.

## Выкладка на Бегет

Только по прямой просьбе владельца. Команда описана в `docs/HANDOFF.md`, но Codex заходит своим ключом:
`BEGET_KEY=~/.ssh/codex_beget BEGET_SSH=emilso@emilso.beget.tech BEGET_DIR=emilius.agency/public_html npm run deploy:prod`.
Ключ владельца `~/.ssh/emilius_beget` не используй.
