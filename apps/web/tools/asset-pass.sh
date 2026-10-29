#!/usr/bin/env bash
# The LANES asset pass: every PixelLab image the client ships, one command per asset.
# Run from the repo root: bash apps/web/tools/asset-pass.sh [rigs|scenes|people|title|mix|all]
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

# Block A of ASSET-PLAN.md: the Pro title scene (the style anchor) and its 16-frame loop.
title() {
  mkdir -p apps/web/assets/title
  "${P[@]}" pro "highly detailed HD pixel art, painterly shading, cinematic wide title screen: a cyan long-nose semi truck with a white trailer driving toward the viewer on a two-lane desert highway at dusk, a roadside diner with a glowing neon sign, telephone poles, red mesas on the horizon, a saturated orange and purple sunset sky with a few stars, long warm shadows" 256 144 apps/web/assets/title/title.png
  "${P[@]}" animate apps/web/assets/title/title.png "the semi truck rolls slowly forward along the highway with its wheels turning and headlights glowing, clouds drift slowly across the sunset sky, the neon diner sign flickers and buzzes, heat shimmer rises off the road, a seamless loop that ends where it began" apps/web/assets/title/loop --frames 16 --view side --direction east --subject "a cyan long-nose semi truck with a white trailer on a desert highway at dusk beside a neon diner"
}

# Style samples (not shipped): isometric tycoon scenes in the painterly hand, for Jeff's 2026-10-29 look.
# The style image is the Pro painterly sample from the style round (scratchpad styles/pro-hd.png).
mix() {
  local style=${STYLE:?set STYLE=<path to the painterly style png>}
  "${P[@]}" pro "isometric pixel art scene of a busy freight terminal at golden hour, tycoon game style: a long warehouse with loading dock doors and semi trailers backed into the bays, a cyan long-nose semi truck pulling out onto the access road, a small dispatch office with glowing windows, a fuel island with a canopy, rows of parked white trailers, a chain-link fence, tiny dock workers with a forklift, a neon diner sign on the street beyond, long warm shadows, saturated orange and purple sunset sky, highly detailed HD pixel art with painterly shading and layered depth, clean readable isometric buildings" 384 288 samples/mix-terminal.png --style "$style"
  "${P[@]}" pro "isometric pixel art of a small American city hub for a trucking tycoon game, on a transparent background: a cluster of downtown towers with lit windows, a highway interchange with tiny semi trucks on the ramps, a river with a steel bridge, warehouses and a rail yard at the edge, a water tower, street lights coming on at dusk, saturated sunset palette, highly detailed HD pixel art with painterly shading, clean isometric tycoon game building shapes" 288 288 samples/mix-city.png --style "$style" --transparent
}

case "$want" in
  rigs) rigs ;;
  scenes) scenes ;;
  people) people ;;
  title) title ;;
  mix) mix ;;
  all) rigs; scenes; people; title ;;
esac
"${P[@]}" balance
