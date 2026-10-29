#!/usr/bin/env bash
# The LANES asset pass: every PixelLab image the client ships, one command per asset.
# Run from the repo root: bash apps/web/tools/asset-pass.sh [rigs|scenes|people|all]
set -u
cd "$(dirname "$0")/../../.."
P=(python3 apps/web/tools/pixellab.py)
want=${1:-all}

rigs() {
  mkdir -p apps/web/assets/rigs
  "${P[@]}" image "side view pixel art of a long-nose conventional semi tractor with a sleeper cab in cyan paint, chrome exhaust stack and chrome bumper, pulling a white 53-foot refrigerated trailer with a boxy silver refrigeration unit on its front and a light blue stripe along the side, big black tires with silver rims, facing right, clean game sprite, crisp single-color black outline" 160 56 apps/web/assets/rigs/reefer.png --view side --transparent --palette --detail high
  "${P[@]}" image "side view pixel art of a long-nose conventional semi tractor with a sleeper cab in cyan paint, chrome exhaust stack and chrome bumper, pulling a flatbed trailer loaded with steel coils under an olive green tarp held by orange straps, big black tires with silver rims, facing right, clean game sprite, crisp single-color black outline" 160 56 apps/web/assets/rigs/flatbed.png --view side --transparent --palette --detail high
}

scenes() {
  mkdir -p apps/web/assets/scenes
  "${P[@]}" image "pixel art interior of a small trucking dispatch office at dusk: two desks with computer monitors showing a map and a load board, a big wall map of the United States with pins, a coffee maker, a window looking out on a truck yard under an orange sky, warm desk lamps, detailed background art" 200 120 apps/web/assets/scenes/office.png --palette --detail high
  "${P[@]}" image "pixel art truck yard at dusk seen from a slight elevation: several parked white semi trailers and a cyan tractor, a corrugated-steel repair shop with an open bay and a lit interior, a chain-link fence, sodium lights on poles, dry grass and a gravel lot, orange and purple sky, detailed background art" 200 120 apps/web/assets/scenes/yard.png --palette --detail high
  "${P[@]}" image "pixel art loading dock of a warehouse: a refrigerated semi trailer backed into a dock door, a forklift carrying a pallet, stacked boxes, a dock worker in a hard hat with a clipboard, fluorescent light inside, evening outside, detailed background art" 200 120 apps/web/assets/scenes/dock.png --palette --detail high
  "${P[@]}" image "pixel art highway weigh station at night: a semi truck stopped on the scale under a canopy with bright lights, an inspection booth with a state trooper, a police car with a light bar, the interstate stretching into the dark behind, detailed background art" 200 120 apps/web/assets/scenes/weigh.png --palette --detail high
}

people() {
  mkdir -p apps/web/assets/people
  "${P[@]}" image "pixel art portrait of a male truck driver, head and shoulders, worn trucker cap, red and black flannel shirt, stubble, friendly face, facing the viewer, game character portrait" 64 64 apps/web/assets/people/driver-m.png --transparent --palette --detail high
  "${P[@]}" image "pixel art portrait of a female truck driver, head and shoulders, brown ponytail, orange hi-vis safety vest over a grey hoodie, confident smile, facing the viewer, game character portrait" 64 64 apps/web/assets/people/driver-f.png --transparent --palette --detail high
  "${P[@]}" image "pixel art portrait of a freight dispatcher, head and shoulders, wearing a black headset with a microphone, navy blue polo shirt, focused expression, facing the viewer, game character portrait" 64 64 apps/web/assets/people/dispatcher.png --transparent --palette --detail high
  "${P[@]}" image "pixel art portrait of a freight broker, head and shoulders, grey suit jacket over an open-collar white shirt, holding a phone to his ear, sharp look, facing the viewer, game character portrait" 64 64 apps/web/assets/people/broker.png --transparent --palette --detail high
  "${P[@]}" image "pixel art portrait of a diesel mechanic, head and shoulders, dark blue coveralls with grease stains, a red rag over the shoulder, cap turned backwards, facing the viewer, game character portrait" 64 64 apps/web/assets/people/mechanic.png --transparent --palette --detail high
  "${P[@]}" image "pixel art portrait of a warehouse dock worker, head and shoulders, yellow hard hat, yellow safety vest over a brown shirt, holding a clipboard, facing the viewer, game character portrait" 64 64 apps/web/assets/people/dockworker.png --transparent --palette --detail high
}

case "$want" in
  rigs) rigs ;;
  scenes) scenes ;;
  people) people ;;
  all) rigs; scenes; people ;;
esac
"${P[@]}" balance
