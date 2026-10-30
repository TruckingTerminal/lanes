#!/bin/bash
# Weather effects in the painterly hand: Pro sprites on transparency (10 generations each) for the
# rain, snow and fog that the map and every scene draw, plus a cloud and a lightning bolt. The code
# moves them (the rain and snow tiles scroll along the fall, the fog and clouds drift): the animator
# paints a flat grey ground under a transparent sprite, so loops of these are no use. Existing files
# are kept.
#   tools/vfx.sh              paints every missing effect
cd "$(dirname "$0")/../../.." || exit 1
P=(python3 -I apps/web/tools/pixellab.py)
OUT=apps/web/assets/vfx
ST=apps/web/assets/title/title.png
FX="a game weather effect sprite in highly detailed HD pixel art with painterly shading, on a fully transparent background with nothing else in the frame, no ground, no sky, no horizon, no border"
mkdir -p "$OUT"
still() {
  local name=$1 w=$2 h=$3 subject=$4
  [ -f "$OUT/$name.png" ] && { echo "$name: kept"; return; }
  "${P[@]}" pro "$FX: $subject" "$w" "$h" "$OUT/$name.png" --style "$ST" --transparent | tail -1
}
"${P[@]}" balance
