#!/usr/bin/env bash
# Animates every still city and town sprite that has no loop yet (2 generations each) and packs the loop.
# Run from the repo root: bash apps/web/tools/animate-sprites.sh [cities|towns|all] [--jobs 3]
set -u
cd "$(dirname "$0")/../../.."
want=${1:-all}
jobs=3
[[ "${2:-}" == "--jobs" ]] && jobs=${3:-3}
CITY_MOTION="the city breathes: windows flicker and glow, smoke drifts slowly from the stacks, tiny trucks and cars crawl along the highway ramps, boats bob on the water, the buildings themselves never move, a seamless loop that ends where it began"
TOWN_MOTION="the town breathes: a few windows flicker, smoke drifts from a chimney, a tiny semi truck rolls along the highway, grass and trees sway slightly in the wind, the buildings themselves never move, a seamless loop that ends where it began"
one() {
  local png=$1 motion=$2 id dir
  id=$(basename "$png" .png)
  dir=$(dirname "$png")/$id-loop
  [[ -f "$(dirname "$png")/$id.loop.png" ]] && return
  python3 -u apps/web/tools/pixellab.py animate "$png" "$motion" "$dir" --frames 16 --transparent --view "high top-down" 2>&1 | grep -v "^  processing" | sed "s/^/$id: /"
  [[ -f "$dir/frame-16.png" ]] && python3 apps/web/tools/pack-loop.py "$dir" "$(dirname "$png")/$id.loop.png"
}
run() {
  local motion=$1; shift
  local n=0
  for png in "$@"; do
    [[ "$png" == *.loop.png ]] && continue
    one "$png" "$motion" &
    n=$((n + 1))
    (( n % jobs == 0 )) && wait
  done
  wait
}
case "$want" in
  cities) run "$CITY_MOTION" apps/web/assets/cities/*.png ;;
  towns) run "$TOWN_MOTION" apps/web/assets/towns/*.png ;;
  all) run "$CITY_MOTION" apps/web/assets/cities/*.png; run "$TOWN_MOTION" apps/web/assets/towns/*.png ;;
esac
python3 apps/web/tools/pixellab.py balance
