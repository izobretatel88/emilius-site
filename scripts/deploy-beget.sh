#!/usr/bin/env bash
# Выкладка продакшена на Бегет: сборка под emilius.agency и синхронизация dist/ по SSH.
#
#   BEGET_SSH=логин@логин.beget.tech BEGET_DIR=emilius.agency/public_html npm run deploy:prod
#
# Вход — по SSH-ключу (пароль скрипт не спрашивает и не хранит). Ключ один раз добавляет владелец.
# Файл с токеном бота (emilius-telegram.php) лежит уровнем выше BEGET_DIR и скриптом не трогается.
set -euo pipefail

: "${BEGET_SSH:?Укажите BEGET_SSH, например логин@логин.beget.tech}"
: "${BEGET_DIR:?Укажите BEGET_DIR, например emilius.agency/public_html}"

cd "$(dirname "$0")/.."

# Счётчик Метрики тот же, что был на Tilda, — история посещений не прерывается.
SITE_URL=https://emilius.agency BASE_PATH=/ YM_ID="${YM_ID:-68742100}" npm run build

# Защита от выкладки превью: в продакшене не должно быть noindex и метки dev.
if grep -rlq 'noindex' dist; then
  echo "В сборке есть noindex — это сборка превью, выкладку останавливаю." >&2
  exit 1
fi

# --delete убирает с сервера файлы, которых больше нет в сборке; .well-known нужен для SSL-сертификата.
rsync -az --delete --exclude '.well-known/' dist/ "$BEGET_SSH:$BEGET_DIR/"

echo "Готово: https://emilius.agency"
