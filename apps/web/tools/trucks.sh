#!/usr/bin/env bash
# Block C, the trucks: the map's eight-heading rigs at 64 px (one per trailer), the side-view rigs for
# the cards and the start form as Pro 320 × 112 paintings in the title's style, and rolling loops.
# Run from the repo root: bash apps/web/tools/trucks.sh [map|rigs|loops|all]
set -u
cd "$(dirname "$0")/../../.."
P=(python3 apps/web/tools/pixellab.py)
want=${1:-all}
TRACTOR="an American long-nose conventional semi tractor with a long hood, a chrome grille and bumper, tall chrome exhaust stacks and a sleeper cab in cyan paint, never a flat-faced European cab-over truck"
HD="highly detailed HD pixel art with painterly shading, a crisp dark outline, warm late light, no text"
mapsheet() {
  mkdir -p apps/web/assets/trucks
  "${P[@]}" object "$TRACTOR pulling a white 53-foot dry van trailer, $HD, a clean game sprite seen from above" 64 apps/web/assets/trucks/van64 --view "high top-down" &
  "${P[@]}" object "$TRACTOR pulling a white 53-foot refrigerated trailer with a boxy silver refrigeration unit on its front, $HD, a clean game sprite seen from above" 64 apps/web/assets/trucks/reefer64 --view "high top-down" &
  "${P[@]}" object "$TRACTOR pulling a flatbed trailer loaded with steel coils under an olive green tarp held by orange straps, $HD, a clean game sprite seen from above" 64 apps/web/assets/trucks/flatbed64 --view "high top-down" &
  wait
}
rigs() {
  mkdir -p apps/web/assets/rigs
  local st=apps/web/assets/title/title.png
  "${P[@]}" pro "side view of $TRACTOR pulling a white 53-foot dry van trailer, facing right, on a transparent background, $HD, big black tires with chrome rims, the whole rig fitting in the frame"  256 96 apps/web/assets/rigs/van.png --style "$st" --transparent &
  "${P[@]}" pro "side view of $TRACTOR pulling a white 53-foot refrigerated trailer with a boxy silver refrigeration unit on its front and a light blue stripe, facing right, on a transparent background, $HD, big black tires with chrome rims, the whole rig fitting in the frame"  256 96 apps/web/assets/rigs/reefer.png --style "$st" --transparent &
  "${P[@]}" pro "side view of $TRACTOR pulling a flatbed trailer loaded with steel coils under an olive green tarp held by orange straps, facing right, on a transparent background, $HD, big black tires with chrome rims, the whole rig fitting in the frame"  256 96 apps/web/assets/rigs/flatbed.png --style "$st" --transparent &
  wait
}
loops() {
  for r in van reefer flatbed; do
    [[ -f apps/web/assets/rigs/$r.loop.png ]] && continue
    "${P[@]}" animate apps/web/assets/rigs/$r.png "the rig drives steadily to the right in place: the wheels turn, the suspension bobs slightly, exhaust puffs from the stacks, the marker lights blink, a seamless loop that ends where it began" apps/web/assets/rigs/$r-loop --frames 16 --view side --direction east --transparent &
  done
  wait
  for r in van reefer flatbed; do [[ -d apps/web/assets/rigs/$r-loop ]] && python3 apps/web/tools/pack-loop.py apps/web/assets/rigs/$r-loop apps/web/assets/rigs/$r.loop.png --cols 16; done
}
case "$want" in
  map) mapsheet ;;
  rigs) rigs ;;
  loops) loops ;;
  all) mapsheet & rigs & wait; loops ;;
esac
"${P[@]}" balance
