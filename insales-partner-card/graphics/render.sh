#!/bin/bash
# Рендерит графику для карточки партнёра InSales в out/ (PNG 2400×1600, логотип 960×960).
# Скриншоты магазинов сначала: node partner-insales/graphics/shoot.mjs
cd "$(dirname "$0")"
mkdir -p out
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
P="${TMPDIR:-/tmp}/partner-cards-chrome"
r(){ "$CH" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$P" --force-device-scale-factor=2 \
  --window-size="$3" --virtual-time-budget=4000 --screenshot="$PWD/out/$2.png" "file://$PWD/cards.html?slide=$1" >/dev/null 2>&1; }
r hero            01-oblozhka        1200,800
r steps           02-etapy           1200,800
r vs              03-tema-ili-front  1200,800
r keep            04-chto-ostaetsya  1200,800
r case-alohagaia  p1-aloha-gaia      1200,800
r case-duman      p2-duman           1200,800
r case-limemart   p3-limemart        1200,800
r case-geekboards p4-geekboards      1200,800
r logo            logo               480,480
ls -la out
