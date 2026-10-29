#!/bin/bash
# The menu icons in the painterly hand: one Pro 128 × 128 image on transparency per side-rack tab
# (10 generations each), in the title's style, shown at 28 CSS px in the rack. Existing files are kept.
#   tools/icons.sh            paints every missing icon
cd "$(dirname "$0")/../../.." || exit 1
P=(python3 -I apps/web/tools/pixellab.py)
ICON="a single game menu icon in highly detailed HD pixel art with painterly shading, centered on a transparent background"
TAIL="bold readable silhouette that fills the frame, warm late light, no text or lettering, no frame, no background"
paint() {
  local name=$1 subject=$2
  [ -f "apps/web/assets/icons/$name.png" ] && { echo "$name: kept"; return; }
  "${P[@]}" pro "$ICON: $subject, $TAIL" 128 128 "apps/web/assets/icons/$name.png" --style apps/web/assets/title/title.png --transparent | tail -1
}
paint fleet "the front three-quarter view of an American long-nose conventional semi tractor with a chrome grille, cyan paint and a sleeper cab"
paint loads "a clipboard holding a freight bill of lading with a pen clipped to it, leaning on a wooden pallet stacked with brown cardboard boxes"
paint staff "a worn blue trucker's cap resting on a black dispatcher's headset, a yellow hard hat behind them"
paint market "a chrome truck key with a big orange price tag hanging from it, a small dealership pennant flag behind"
paint money "a stack of gold coins beside a bundle of folded green banknotes, a single blue token coin leaning on them"
paint company "a small trucking company office building with a lit window, a blank sign board over the door and a flag on a pole"
paint guide "an open road atlas with a red route drawn across a map page, a brass compass resting on it"
"${P[@]}" balance
