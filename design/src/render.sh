#!/bin/zsh
# Render MiniFocus mockups to PNG (2x) with headless Chrome.
# Usage: ./render.sh            -> all screens
#        ./render.sh 03 04      -> only screens whose name starts with 03 / 04
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SRC="${0:A:h}"
OUT="${SRC:h}/mockups"
mkdir -p "$OUT"

typeset -A SIZE
SIZE=(
  09-car-mode-phone 915,412
  10-car-headunit 1920,720
  11-car-auto-template 1280,720
  00-overview 2000,1600
)

# overview (00) goes last because it embeds the other PNGs
for f in "$SRC"/0[1-9]-*.html "$SRC"/[1-9][0-9]-*.html "$SRC"/00-*.html; do
  [[ -f "$f" ]] || continue
  name="${${f:t}%.html}"
  if (( $# > 0 )); then
    ok=0; for p in "$@"; do [[ "$name" == ${p}* ]] && ok=1; done
    (( ok )) || continue
  fi
  size="${SIZE[$name]:-412,915}"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size="$size" --virtual-time-budget=6000 --allow-file-access-from-files \
    --screenshot="$OUT/$name.png" "file://$f" >/dev/null 2>&1
  echo "rendered $name ($size)"
done
