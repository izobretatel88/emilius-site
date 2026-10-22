#!/usr/bin/env bash
# Выкладка продакшена на Бегет: сборка под emilius.agency и синхронизация dist/ по SSH.
#
#   BEGET_SSH=логин@логин.beget.tech BEGET_DIR=emilius.agency/public_html npm run deploy:prod
#
# Вход — по SSH-ключу ~/.ssh/emilius_beget (пароль скрипт не спрашивает и не хранит).
# Публичную часть ключа владелец один раз добавляет на Бегет.
# Файл с токеном бота (emilius-telegram.php) лежит вне BEGET_DIR (в домашней папке аккаунта) и скриптом не трогается.
set -euo pipefail

: "${BEGET_SSH:?Укажите BEGET_SSH, например логин@логин.beget.tech}"
: "${BEGET_DIR:?Укажите BEGET_DIR, например emilius.agency/public_html}"
BEGET_KEY="${BEGET_KEY:-$HOME/.ssh/emilius_beget}"

cd "$(dirname "$0")/.."

# Счётчик Метрики тот же, что был на Tilda, — история посещений не прерывается.
SITE_URL=https://emilius.agency BASE_PATH=/ YM_ID="${YM_ID:-68742100}" npm run build

# Защита от выкладки превью: в продакшене не должно быть noindex и метки dev.
if grep -rlq --include='*.html' 'noindex' dist; then
  echo "В сборке есть noindex — это сборка превью, выкладку останавливаю." >&2
  exit 1
fi

# --delete убирает с сервера файлы, которых больше нет в сборке; .well-known нужен для SSL-сертификата,
# emilius-telegram.php — на случай, если файл с токеном положили в папку сайта.
rsync -az --delete --exclude '.well-known/' --exclude 'emilius-telegram.php' -e "ssh -i $BEGET_KEY -o IdentitiesOnly=yes" dist/ "$BEGET_SSH:$BEGET_DIR/"

echo "Готово: https://emilius.agency"
