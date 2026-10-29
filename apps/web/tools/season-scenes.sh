#!/usr/bin/env bash
# The scenes in every season: edits of each summer painting (the layout and the hand stay, the season
# changes), then a loop for each. Run from the repo root: bash apps/web/tools/season-scenes.sh [scene ...]
# with SEASONS="autumn winter spring" (the default) and ONLY_STILLS=1 to skip the loops.
set -u
cd "$(dirname "$0")/../../.."
P=(python3 apps/web/tools/pixellab.py)
SEASONS=${SEASONS:-"autumn winter spring"}
scenes=("$@"); [[ ${#scenes[@]} -eq 0 ]] && scenes=(office yard dock weigh truckstop lounge dealer bank guide)
# The Mac's bash is 3.2 (no associative arrays), so the looks are functions.
look() {
  case "$1" in
    autumn) echo "autumn: red, orange and gold leaves on every tree, fallen leaves blowing across the ground, harvested brown fields, a low amber sun and long shadows" ;;
    winter) echo "deep winter: snow on every roof, on the ground and the trucks, bare trees, icicles, breath and exhaust steaming in the cold, a low pale sun or grey sky, snow banks along the road" ;;
    spring) echo "early spring: fresh light-green leaves and blossom on the trees, puddles on the wet ground reflecting the sky, a soft clear light, the last patches of melting snow in the shade" ;;
  esac
}
motion() {
  local sub="a seamless loop that ends where it began, the camera and the buildings never move"
  case "$1" in
    autumn) echo "leaves blow across in the wind, the lights flicker, the trucks' marker lights blink, $sub" ;;
    winter) echo "snow falls steadily, breath and exhaust steam in the cold, the lights flicker, the trucks' marker lights blink, $sub" ;;
    spring) echo "a light rain falls and puddles ripple, blossom petals drift, the lights flicker, the trucks' marker lights blink, $sub" ;;
  esac
}
for s in "${scenes[@]}"; do
  for season in $SEASONS; do
    out=apps/web/assets/scenes/$s-$season.png
    [[ -f "$out" ]] || "${P[@]}" edit "apps/web/assets/scenes/$s.png" "repaint this HD painterly pixel art scene in $(look "$season"); keep every building, truck, person and object exactly where it is and in the same style; never write any words or letters" "$out" 2>&1 | grep -v "^  processing" | sed "s/^/$s-$season: /"
    [[ -n "${ONLY_STILLS:-}" ]] && continue
    [[ -f "apps/web/assets/scenes/$s-$season.loop.png" ]] && continue
    "${P[@]}" animate "$out" "$(motion "$season")" "apps/web/assets/scenes/$s-$season-loop" --frames 16 --view side 2>&1 | grep -v "^  processing" | sed "s/^/$s-$season loop: /"
    python3 apps/web/tools/pack-loop.py "apps/web/assets/scenes/$s-$season-loop" "apps/web/assets/scenes/$s-$season.loop.png" --cols 16
  done
done
"${P[@]}" balance
