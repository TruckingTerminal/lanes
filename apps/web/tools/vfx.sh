#!/bin/bash
# Weather effects in the painterly hand: Pro sprites on transparency (10 generations each) and
# 16-frame loops (2 each) for the rain, snow and fog that the map and every scene draw, plus a
# cloud and a lightning bolt the code moves itself. Existing files are kept.
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
loop() {
  local name=$1 motion=$2
  [ -f "$OUT/$name.loop.png" ] && { echo "$name loop: kept"; return; }
  "${P[@]}" animate "$OUT/$name.png" "$motion, a seamless loop that ends where it began, the background stays fully transparent" "$OUT/$name-loop" --frames 16 --view side | tail -1
  python3 apps/web/tools/pack-loop.py "$OUT/$name-loop" "$OUT/$name.loop.png" --cols 4
}
still rain 256 144 "falling rain: many thin pale blue-white diagonal streaks of rain of different lengths spread evenly over the whole frame, a few small splashes near the bottom edge"
still snow 256 144 "falling snow: soft white snowflakes of different sizes spread evenly over the whole frame, some near and large, most small and far"
still fog 256 96 "a low bank of pale grey morning mist with soft wispy curling edges that fade out to transparency"
still cloud 128 64 "one fluffy white cumulus cloud seen from high above, sunlit top, soft shaded underside, soft edges fading to transparency"
still bolt 96 192 "one bright white and pale blue forked lightning bolt striking straight downward with a soft glow around it"
loop rain "the rain streaks fall steadily downward and the splashes flicker"
loop snow "the snowflakes drift slowly downward and sway gently side to side"
loop fog "the mist drifts slowly to the right and its wisps curl"
"${P[@]}" balance
