#!/usr/bin/env bash
# The LANES asset pass: every PixelLab image the client ships, one command per asset.
# Run from the repo root: bash apps/web/tools/asset-pass.sh [rigs|scenes|people|title|mix|map|all]
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

# Block A of ASSET-PLAN.md: the Pro title scene, the style anchor every painterly asset copies, and since 2026-11-01
# the title's poster and the head-on shot's painting; the screen itself is drawn live (src/title.ts; titleparallax,
# titleapproach and titlesprites below).
title() {
  mkdir -p apps/web/assets/title
  "${P[@]}" pro "highly detailed HD pixel art, painterly shading, cinematic wide title screen: a cyan long-nose semi truck with a white trailer driving toward the viewer on a two-lane desert highway at dusk, a roadside diner with a glowing neon sign, telephone poles, red mesas on the horizon, a saturated orange and purple sunset sky with a few stars, long warm shadows" 256 144 apps/web/assets/title/title.png
}

# Style samples (not shipped): isometric tycoon scenes in the painterly hand, for Jeff's 2026-10-29 look.
# The style image is the Pro painterly sample from the style round (scratchpad styles/pro-hd.png).
mix() {
  local style=${STYLE:?set STYLE=<path to the painterly style png>}
  "${P[@]}" pro "isometric pixel art scene of a busy freight terminal at golden hour, tycoon game style: a long warehouse with loading dock doors and semi trailers backed into the bays, a cyan long-nose semi truck pulling out onto the access road, a small dispatch office with glowing windows, a fuel island with a canopy, rows of parked white trailers, a chain-link fence, tiny dock workers with a forklift, a neon diner sign on the street beyond, long warm shadows, saturated orange and purple sunset sky, highly detailed HD pixel art with painterly shading and layered depth, clean readable isometric buildings" 384 288 samples/mix-terminal.png --style "$style"
  "${P[@]}" pro "isometric pixel art of a small American city hub for a trucking tycoon game, on a transparent background: a cluster of downtown towers with lit windows, a highway interchange with tiny semi trucks on the ramps, a river with a steel bridge, warehouses and a rail yard at the edge, a water tower, street lights coming on at dusk, saturated sunset palette, highly detailed HD pixel art with painterly shading, clean isometric tycoon game building shapes" 288 288 samples/mix-city.png --style "$style" --transparent
}

# Map style samples (not shipped), for Jeff's 2026-10-29 "large US map first" look: the code-drawn base
# (rendered by tools/map-harness, which saves crops of the real map) repainted by the Pro editor in the
# two candidate styles. BASE is the folder with base-us-512.png, base-west-1536.png and base-east-1536.png.
PAINTERLY="repaint this top-down pixel art map of the United States as highly detailed HD pixel art with painterly shading and layered depth: richly textured terrain with dark forests, patchwork farmland, pale deserts, mountain ranges with shaded ridges and snow caps, rivers and coastlines with surf, warm late-afternoon light and a saturated palette; keep every coastline, river, state line, highway, town dot and city skyline exactly where it is"
MIXED="repaint this top-down pixel art map of the United States as an isometric tycoon game world with highly detailed HD painterly pixel art shading: the ground stays a top-down map with every coastline, river, state line and highway exactly where it is, but the mountain ranges rise as shaded isometric peaks with snow, the forests become clusters of tiny isometric trees, every city skyline becomes a small cluster of isometric buildings with lit windows and every town dot a few tiny isometric houses, warm late-afternoon light and a saturated palette"
map() {
  local base=${BASE:?set BASE=<folder with the base-*.png crops from tools/map-harness>}
  mkdir -p samples
  for crop in us-512 west-1536 east-1536; do
    "${P[@]}" edit "$base/base-$crop.png" "$PAINTERLY" "samples/map-$crop-painterly.png" &
    "${P[@]}" edit "$base/base-$crop.png" "$MIXED" "samples/map-$crop-mix.png" &
  done
  wait
}

# Block B in the painterly hand: the four scenes as Pro 256 × 144 (shown at 2× and 3×) in the title's style,
# every truck an American long-nose conventional, each with a 16-frame loop. Jeff's 2026-10-29 review: the
# pixflux scenes looked noisy and one showed a European cab-over.
TRUCK="an American long-nose conventional semi tractor with a long hood, a chrome grille and bumper, tall chrome exhaust stacks and a sleeper cab, never a flat-faced European cab-over truck"
HD="highly detailed HD pixel art with painterly shading and layered depth, cinematic, warm late light, saturated palette, no text or lettering"
scenespro() {
  mkdir -p apps/web/assets/scenes
  local st=apps/web/assets/title/title.png
  "${P[@]}" pro "$HD: the inside of a small trucking company dispatch office at dusk, two desks with monitors showing a load board and a map of the United States, a big wall map with pins, a coffee maker, a window onto the yard where $TRUCK in cyan paint is parked under an orange and purple sunset, warm desk lamps" 256 144 apps/web/assets/scenes/office.png --style "$st" &
  "${P[@]}" pro "$HD: a trucking company yard at dusk seen from the road, a row of white 53-foot dry van trailers, $TRUCK in cyan paint, a corrugated steel repair shop with an open lit bay, sodium lights on poles, a chain-link fence, mountains on the horizon, an orange and purple sunset sky" 256 144 apps/web/assets/scenes/yard.png --style "$st" &
  "${P[@]}" pro "$HD: a warehouse loading dock in the evening, $TRUCK in white backed up with its white 53-foot trailer to a lit dock door, a forklift carrying a pallet, stacked boxes, a dock worker in a hard hat with a clipboard, fluorescent light spilling out onto the lot" 256 144 apps/web/assets/scenes/dock.png --style "$st" &
  "${P[@]}" pro "$HD: an interstate weigh station at night, $TRUCK in cyan paint stopped on the scale under a bright canopy, an inspection booth with a state trooper, a patrol car with a light bar, the interstate stretching into the dark with headlights and taillights" 256 144 apps/web/assets/scenes/weigh.png --style "$st" &
  wait
}
scenesloops() {
  local sub="a seamless loop that ends where it began, the camera and the buildings never move"
  "${P[@]}" animate apps/web/assets/scenes/office.png "the monitors flicker with changing data, the desk lamp glows and dims, a dispatcher types and sips coffee, outside the sky slowly deepens and the parked truck's marker lights blink, $sub" apps/web/assets/scenes/office-loop --frames 16 --view side &
  "${P[@]}" animate apps/web/assets/scenes/yard.png "the sodium lights flicker on, the open bay's light glows, a mechanic walks across the bay, the truck's marker lights blink, exhaust puffs from the stacks, clouds drift slowly across the sunset, $sub" apps/web/assets/scenes/yard-loop --frames 16 --view side &
  "${P[@]}" animate apps/web/assets/scenes/dock.png "the forklift drives a pallet into the trailer and backs out, the dock worker checks the clipboard and waves, the fluorescent light buzzes and flickers, $sub" apps/web/assets/scenes/dock-loop --frames 16 --view side &
  "${P[@]}" animate apps/web/assets/scenes/weigh.png "the patrol car's light bar flashes red and blue, the trooper steps out of the booth and back, headlights and taillights stream past on the interstate behind, the scale display blinks, $sub" apps/web/assets/scenes/weigh-loop --frames 16 --view side &
  wait
  for s in office yard dock weigh; do python3 apps/web/tools/pack-loop.py apps/web/assets/scenes/$s-loop apps/web/assets/scenes/$s.loop.png --cols 16; done
}

# Block D in the painterly hand: the six portraits as Pro 128 × 128 (shown at 48 CSS px) in the title's style,
# then idle loops. Block A: the loading strip, a rig rolling on a road, 256 × 72 shown at 2×, with its loop.
PORTRAIT="highly detailed HD pixel art portrait with painterly shading, head and shoulders, facing the viewer, warm late light, a plain dark background, no text"
peoplepro() {
  mkdir -p apps/web/assets/people
  local st=apps/web/assets/title/title.png
  "${P[@]}" pro "$PORTRAIT: an American truck driver, a man in his forties with a worn trucker cap, a red and black flannel shirt and stubble, a friendly tired smile" 128 128 apps/web/assets/people/driver-m.png --style "$st" &
  "${P[@]}" pro "$PORTRAIT: an American truck driver, a woman in her thirties with a brown ponytail, an orange hi-vis safety vest over a grey hoodie, a confident smile" 128 128 apps/web/assets/people/driver-f.png --style "$st" &
  "${P[@]}" pro "$PORTRAIT: a freight dispatcher at a desk, a black headset with a microphone, a navy blue polo shirt, a focused expression lit by a monitor" 128 128 apps/web/assets/people/dispatcher.png --style "$st" &
  "${P[@]}" pro "$PORTRAIT: a freight broker, a grey suit jacket over an open-collar white shirt, a phone held to the ear, a sharp calculating look" 128 128 apps/web/assets/people/broker.png --style "$st" &
  wait
  "${P[@]}" pro "$PORTRAIT: a diesel mechanic, dark blue coveralls with grease stains, a red rag over the shoulder, a cap turned backwards, a wry grin" 128 128 apps/web/assets/people/mechanic.png --style "$st" &
  "${P[@]}" pro "$PORTRAIT: a warehouse dock worker, a yellow hard hat and a yellow safety vest over a brown shirt, holding a clipboard, a steady look" 128 128 apps/web/assets/people/dockworker.png --style "$st" &
  wait
}
peopleloops() {
  local sub="a subtle idle loop that ends where it began, the face and clothes stay the same"
  local n=0
  for who in driver-m driver-f dispatcher broker mechanic dockworker; do
    "${P[@]}" animate apps/web/assets/people/$who.png "breathes slowly, blinks, the eyes glance aside and back, a slight tilt of the head, $sub" apps/web/assets/people/$who-loop --frames 16 --view side --transparent &
    n=$((n + 1)); (( n % 3 == 0 )) && wait
  done
  wait
  for who in driver-m driver-f dispatcher broker mechanic dockworker; do python3 apps/web/tools/pack-loop.py apps/web/assets/people/$who-loop apps/web/assets/people/$who.loop.png --cols 16; done
}
# Sixteen drivers for the Staff roster (Jeff, 2026-11-03: "there's only 2 for drivers"): m1 and f1 are the two above,
# copied, and the other fourteen are drawn with them as style, so the light, the outline and the dark ground match.
# Each a different person at a glance even at 48 px: age, build, skin, hair, beards, hats and hi-vis. Then the
# originals' idle loop for each. Checked by eye and by number (colour drift against the still, the jump from the last
# frame back to the first): the first loops of m3, m8 and f6 jumped at the wrap and f8's drifted, so they were redrawn
# (the seeds below are the kept ones; f8 took three); m8's second came out orange-skinned and was fitted back to its
# still with an affine colour map. f5's first still looked thirty, not late fifties, and was redrawn. The men inherit
# a 1 px dark frame on the bottom and right edges from driver-m, removed after drawing (stills, loops and frames).
DRIVER="$PORTRAIT, no logos: an American truck driver"
drivers() {
  local d=apps/web/assets/people
  local m=$d/driver-m.png f=$d/driver-f.png
  "${P[@]}" pro "$DRIVER, a broad-shouldered Black man in his fifties with a shaved head and a short grey beard, a tan canvas work jacket over a white t-shirt, a warm easy smile" 128 128 $d/driver-m2.png --style $m --seed 1008802678 &
  "${P[@]}" pro "$DRIVER, a young Latino man in his twenties with short black hair in a fade, clean-shaven, a lime yellow hi-vis safety vest over a black t-shirt, a bright grin" 128 128 $d/driver-m3.png --style $m --seed 1760079830 &
  "${P[@]}" pro "$DRIVER, a weathered white man in his sixties with a big white walrus moustache, a tan felt cowboy hat, a faded denim shirt with pearl snaps, squinting kindly" 128 128 $d/driver-m4.png --style $m --seed 546722334 &
  "${P[@]}" pro "$DRIVER, a heavy-set white man in his thirties with a long full brown beard, a dark green knit beanie, a grey hoodie, a calm steady look" 128 128 $d/driver-m5.png --style $m --seed 898098256 &
  "${P[@]}" pro "$DRIVER, a Sikh man in his forties with a navy blue turban and a full neat black beard, a charcoal quilted vest over a maroon shirt, a quiet confident smile" 128 128 $d/driver-m6.png --style $m --seed 94585503 &
  "${P[@]}" pro "$DRIVER, an East Asian man in his late thirties with short neat black hair and thin wire-rimmed glasses, an olive green work shirt, a slight thoughtful smile" 128 128 $d/driver-m7.png --style $m --seed 170554824 &
  "${P[@]}" pro "$DRIVER, a lanky young white man in his twenties with a short ginger beard and freckles, a plain green and white mesh trucker cap worn forward, a black t-shirt, a cheeky half grin" 128 128 $d/driver-m8.png --style $m --seed 699671970 &
  wait
  "${P[@]}" pro "$DRIVER, a Black woman in her forties with short natural hair and small gold hoop earrings, a mustard yellow zip-up work jacket, a warm knowing smile" 128 128 $d/driver-f2.png --style $f --seed 1927941587 &
  "${P[@]}" pro "$DRIVER, a white woman in her sixties with short silver hair and red reading glasses, a faded denim jacket, a kind crinkly grin" 128 128 $d/driver-f3.png --style $f --seed 571344999 &
  "${P[@]}" pro "$DRIVER, a young Latina woman in her twenties with long straight black hair under a plain black baseball cap, a lime yellow hi-vis safety vest over a white t-shirt, a confident grin" 128 128 $d/driver-f4.png --style $f --seed 916045724 &
  "${P[@]}" pro "$DRIVER, a stout round-faced white woman in her late fifties with laugh lines, short curly auburn hair going grey at the temples and freckles, a green and black flannel shirt, a broad cheerful smile" 128 128 $d/driver-f5.png --style $f --seed 200874546 &
  "${P[@]}" pro "$DRIVER, an East Asian woman in her thirties with a short black bob and sunglasses pushed up on her head, a navy windbreaker zipped to the collar, a cool composed look" 128 128 $d/driver-f6.png --style $f --seed 1176682442 &
  "${P[@]}" pro "$DRIVER, a young Black woman in her twenties with long box braids tied up high and a small nose stud, an open khaki work shirt over a white t-shirt, a playful smile" 128 128 $d/driver-f7.png --style $f --seed 1034563015 &
  "${P[@]}" pro "$DRIVER, a Native American woman in her forties with long straight black hair in a single braid over one shoulder, a maroon fleece pullover, a calm half smile" 128 128 $d/driver-f8.png --style $f --seed 284181788 &
  wait
  for s in m f; do cp $d/driver-$s.png $d/driver-${s}1.png; cp $d/driver-$s.loop.png $d/driver-${s}1.loop.png; cp $d/driver-$s.loop.json $d/driver-${s}1.loop.json; done
}
driverloops() {
  local d=apps/web/assets/people
  local sub="a subtle idle loop that ends where it began, the face and clothes stay the same"
  local seeds="m2:121483720 m3:4072239020 m4:681322299 m5:3011097698 m6:147102564 m7:1290064252 m8:2375017116 f2:4240114158 f3:2293088666 f4:2086532722 f5:3603165020 f6:2267517212 f7:3074697073 f8:2057797402"
  local n=0
  for ws in $seeds; do
    "${P[@]}" animate $d/driver-${ws%%:*}.png "breathes slowly, blinks, the eyes glance aside and back, a slight tilt of the head, $sub" $d/driver-${ws%%:*}-loop --frames 16 --view side --transparent --seed ${ws##*:} &
    n=$((n + 1)); (( n % 6 == 0 )) && wait
  done
  wait
  for ws in $seeds; do python3 apps/web/tools/pack-loop.py $d/driver-${ws%%:*}-loop $d/driver-${ws%%:*}.loop.png --cols 16; done
}
# The three tractor makes (Jeff, 2026-11-02): Keystone the workhorse, Meridian the economical highway truck, Ironwood the
# premium driver's favourite. tools/makes.py models each in feet and renders its Dealer card's layout; a Pro edit
# repaints each layout as painterly pixel art, told in words what the make is (an image reference instead copied the
# reference or put stacks on the Meridian); makes.py then fits the paint to the rig cards' colours and renders the
# map sheets from the same models. The edits take no seed back; the shipped ones reported 1744236630 (Keystone),
# 18164897 (Meridian) and 1259596957 (Ironwood), kept as assets/makes/src/*-paint.png.
MAKE="repaint as highly detailed HD pixel art with painterly shading, a crisp dark outline and warm late light, keeping the truck's shape, size and position exactly"
makes() {
  local s=apps/web/assets/makes/src
  python3 apps/web/tools/makes.py layouts
  "${P[@]}" edit $s/keystone-layout.png "$MAKE: a plain square workhorse American semi tractor in cyan paint with a medium flat hood, a grey grille with horizontal bars, a grey steel bumper, a flat-roof sleeper no taller than the cab, one grey exhaust stack, aluminium fuel tanks, grey steel wheels, no text, no logos" $s/keystone-paint.png --transparent &
  "${P[@]}" edit $s/meridian-layout.png "$MAKE: a modern aerodynamic American semi tractor in cyan paint with a sloped short hood, a wide black mesh grille, a raked windshield with no sun visor, a tall smooth roof fairing, cyan side skirts covering the fuel tanks and steps all the way between the wheels, no exhaust stacks, almost no chrome, no text, no logos" $s/meridian-paint.png --transparent &
  "${P[@]}" edit $s/ironwood-layout.png "$MAKE: a classic long-nose American semi tractor in cyan paint with a long square hood, a tall upright chrome grille with vertical bars, round chrome air cleaners beside the cowl, a chrome sun visor with amber lamps over an upright split windshield, a tall square sleeper, twin tall chrome exhaust stacks behind the sleeper, chrome fuel tanks, a big chrome bumper, no text, no logos" $s/ironwood-paint.png --transparent &
  wait
  # The rig cards (sprint 3 prep, 2026-11-03): each make pulling a dry van, for the Dealer's "rig as a shortcut".
  # Keystone and Ironwood repaint whole; four repaints of the whole Meridian rig each came back at another scale, so
  # its tractor is repainted alone in its place and the trailer is the Keystone's (the Ironwood's where that is hidden).
  local van="pulling a plain white 53-foot dry van trailer with no text, no logos and no markings"
  python3 apps/web/tools/makes.py rigs rig-tractor meridian
  "${P[@]}" edit $s/keystone-rig-layout.png "$MAKE: a plain square workhorse American semi tractor in cyan paint with a medium flat hood, a grey grille with horizontal bars, a grey steel bumper, a flat-roof sleeper no taller than the cab, one grey exhaust stack, aluminium fuel tanks, grey steel wheels, $van" $s/keystone-rig-paint.png --transparent &
  "${P[@]}" edit $s/ironwood-rig-layout.png "$MAKE: a classic long-nose American semi tractor in cyan paint with a long square hood, a tall upright chrome grille with vertical bars, round chrome air cleaners beside the cowl, a chrome sun visor with amber lamps over an upright split windshield, a tall square sleeper, twin tall chrome exhaust stacks behind the sleeper, chrome fuel tanks, a big chrome bumper, $van" $s/ironwood-rig-paint.png --transparent &
  "${P[@]}" edit $s/meridian-rig-tractor-layout.png "$MAKE: a modern aerodynamic American semi tractor in cyan paint with a sloped short hood, a wide black mesh grille, a raked windshield with no sun visor, a tall smooth roof fairing, cyan side skirts covering the fuel tanks and steps all the way between the wheels, no exhaust stacks, almost no chrome, no text, no logos" $s/meridian-rig-tractor-paint.png --transparent &
  wait
  python3 apps/web/tools/makes.py rig-compose meridian keystone ironwood
  python3 apps/web/tools/makes.py fit map
}
# Both looks for every staff kind (QA's replay, 2026-11-03: half the staff names couldn't match their faces). The four
# originals above are all men, so each gets a woman drawn with it as style; the five kinds that borrowed the
# dispatcher's face (operations, maintenance, the CEO, security, sales) get a man and a woman each, office roles in the
# dispatcher's or broker's light and the maintenance manager in the mechanic's. Each kind keeps what says its job (a
# headset, a suit, coveralls, a hard hat, a radio); the hands never move in the loops. Files are <kind>-m and <kind>-f
# (kebab case, ops-manager, maint-manager, ceo, security-manager, sales-rep); the originals are copied to <kind>-m.
STAFF="$PORTRAIT, no logos"
staff() {
  local d=apps/web/assets/people
  "${P[@]}" pro "$STAFF: a freight dispatcher, a Latina woman in her thirties with dark hair in a low bun, a black headset with a microphone, a navy blue polo shirt, a focused expression lit by a monitor" 128 128 $d/dispatcher-f.png --style $d/dispatcher.png --seed 527400335 &
  "${P[@]}" pro "$STAFF: a freight broker, a South Asian woman in her forties with sleek black hair to the shoulders, a small wireless earpiece, a charcoal blazer over a white silk blouse, a sharp calculating look" 128 128 $d/broker-f.png --style $d/broker.png --seed 2019762299 &
  "${P[@]}" pro "$STAFF: a diesel mechanic, a white woman in her late twenties with a short blonde pixie cut under a red bandana and a smudge of grease on one cheek, dark blue coveralls with grease stains, a red rag over the shoulder, a wry grin" 128 128 $d/mechanic-f.png --style $d/mechanic.png --seed 1901508790 &
  "${P[@]}" pro "$STAFF: a warehouse dock worker, a Black woman in her forties with braids under a yellow hard hat, a yellow safety vest over a brown shirt, holding a clipboard, a steady look" 128 128 $d/dockworker-f.png --style $d/dockworker.png --seed 40598912 &
  "${P[@]}" pro "$STAFF: a trucking company's operations manager, a Black man in his forties with a trimmed beard, a light blue button-down shirt with the sleeves rolled up, a lanyard with a blank ID card, no headset, a no-nonsense look" 128 128 $d/ops-manager-m.png --style $d/broker.png --seed 1545675022 &
  "${P[@]}" pro "$STAFF: a trucking company's operations manager, a white woman in her forties with shoulder-length brown hair and reading glasses pushed up on her head, a grey cardigan over a white shirt, a lanyard with a blank ID card, a brisk capable look" 128 128 $d/ops-manager-f.png --style $d/dispatcher.png --seed 42856984 &
  "${P[@]}" pro "$STAFF: a truck shop's maintenance manager, a heavy-set white man in his fifties with a grey goatee and safety glasses pushed up on his forehead, a dark grey work shirt with pens in the chest pocket, a steady practical look" 128 128 $d/maint-manager-m.png --style $d/mechanic.png --seed 1412143874 &
  wait
  "${P[@]}" pro "$STAFF: a truck shop's maintenance manager, a Latina woman in her forties with her hair tied back and safety glasses pushed up on her head, a dark grey work shirt with pens in the chest pocket, a steady practical look" 128 128 $d/maint-manager-f.png --style $d/mechanic.png --seed 62489522 &
  "${P[@]}" pro "$STAFF: the chief executive of a trucking company, an East Asian man in his fifties with silver at the temples, a navy suit and an open-collar white shirt, composed and quietly confident" 128 128 $d/ceo-m.png --style $d/broker.png --seed 735768993 &
  "${P[@]}" pro "$STAFF: the chief executive of a trucking company, a Black woman in her fifties with short grey natural hair, a navy tailored suit jacket and a small pearl stud in each ear, composed and quietly confident" 128 128 $d/ceo-f.png --style $d/broker.png --seed 1551578010 &
  "${P[@]}" pro "$STAFF: a trucking company's security manager, a broad white man in his forties with a shaved head and a short dark beard, a black polo shirt with a plain grey shoulder patch, a radio earpiece with a coiled wire, a watchful look" 128 128 $d/security-manager-m.png --style $d/dispatcher.png --seed 1592429627 &
  "${P[@]}" pro "$STAFF: a trucking company's security manager, a Latina woman in her thirties with her black hair in a tight braid, a black polo shirt with a plain grey shoulder patch, a radio earpiece with a coiled wire, a watchful look" 128 128 $d/security-manager-f.png --style $d/dispatcher.png --seed 411687790 &
  "${P[@]}" pro "$STAFF: a freight sales representative, a young white man in his late twenties with neat blond hair, a navy quarter-zip pullover over a collared shirt, a bright confident salesman's smile" 128 128 $d/sales-rep-m.png --style $d/broker.png --seed 1520406350 &
  "${P[@]}" pro "$STAFF: a freight sales representative, an East Asian woman in her late twenties with long dark hair, a red blazer over a black top, a bright confident smile" 128 128 $d/sales-rep-f.png --style $d/broker.png --seed 1307698206 &
  wait
  for k in dispatcher broker mechanic dockworker; do cp $d/$k.png $d/$k-m.png; cp $d/$k.loop.png $d/$k-m.loop.png; cp $d/$k.loop.json $d/$k-m.loop.json; done
}
# Their idle loops: the drivers' motion, or, where a hand is up at the ear or the chin, no tilt of the head and the hands
# held still (a moving hand is where the three arms came from). Checked like the drivers': the first loops of
# ops-manager-m, maint-manager-m and sales-rep-m jumped at the wrap and were redrawn; dockworker-f came out orange
# twice (a yellow vest seems to set it off) and the second was fitted back to its still with one affine colour map.
# The original dockworker's loop (2026-10-29) drifted orange and popped back at the wrap; it's redrawn here, still.
staffloops() {
  local d=apps/web/assets/people
  local sub="a subtle idle loop that ends where it began, the face and clothes stay the same"
  local idle="breathes slowly, blinks, the eyes glance aside and back, a slight tilt of the head, $sub"
  local still="breathes slowly, blinks, the eyes glance aside and back, only the face moves; the head, the hands and the arms stay perfectly still, $sub"
  local n=0
  for who in dockworker dispatcher-f broker-f mechanic-f dockworker-f ops-manager-m ops-manager-f maint-manager-m maint-manager-f ceo-m ceo-f security-manager-m security-manager-f sales-rep-m sales-rep-f; do
    local motion=$idle
    case $who in dockworker|dispatcher-f|broker-f|dockworker-f|ops-manager-f|ceo-m|security-manager-m|sales-rep-m) motion=$still ;; esac
    "${P[@]}" animate $d/$who.png "$motion" $d/$who-loop --frames 16 --view side --transparent &
    n=$((n + 1)); (( n % 7 == 0 )) && wait
  done
  wait
  for who in dockworker dispatcher-f broker-f mechanic-f dockworker-f ops-manager-m ops-manager-f maint-manager-m maint-manager-f ceo-m ceo-f security-manager-m security-manager-f sales-rep-m sales-rep-f; do python3 apps/web/tools/pack-loop.py $d/$who-loop $d/$who.loop.png --cols 16; done
  for k in dispatcher broker mechanic dockworker; do cp $d/$k.loop.png $d/$k-m.loop.png; cp $d/$k.loop.json $d/$k-m.loop.json; done
}
loading() {
  mkdir -p apps/web/assets/loading
  "${P[@]}" pro "$HD: side view of $TRUCK in cyan paint pulling a white 53-foot dry van trailer, driving to the right along a straight two-lane highway at dusk, the road and the flat desert horizon running seamlessly to both edges of the frame, telephone poles, a saturated orange and purple sky" 256 72 apps/web/assets/loading/rig.png --style apps/web/assets/title/title.png
  "${P[@]}" animate apps/web/assets/loading/rig.png "the truck drives steadily to the right with its wheels turning and the road's dashes, poles and desert scrolling left past it so it stays in the frame, exhaust puffs from the stacks, a seamless loop that ends where it began" apps/web/assets/loading/rig-loop --frames 16 --view side --direction east
  python3 apps/web/tools/pack-loop.py apps/web/assets/loading/rig-loop apps/web/assets/loading/rig.loop.png --cols 16
}

# Every menu item gets its own location (Jeff, 2026-10-29): Loads at a truck stop, Staff in the drivers'
# lounge, Dealer on a dealership lot, Money at a small-town bank, Guide in a diner booth over a road atlas.
# Fleet keeps the yard and Company the office; the dock and the weigh station stay for load and inspection views.
placespro() {
  local st=apps/web/assets/title/title.png
  "${P[@]}" pro "$HD: a big interstate truck stop at dusk, a tall lit sign on a pole, rows of fuel islands under a long canopy, $TRUCK in cyan paint fueling and several others parked in a row, a diner with neon in the window, a driver walking with a coffee, the highway beyond" 256 144 apps/web/assets/scenes/truckstop.png --style "$st" &
  "${P[@]}" pro "$HD: the drivers' lounge at a trucking terminal, a few drivers in caps and flannel on worn couches, a coffee machine, a vending machine, a bulletin board of notices, a TV on the wall, a window onto the yard where $TRUCK is parked at dusk" 256 144 apps/web/assets/scenes/lounge.png --style "$st" &
  "${P[@]}" pro "$HD: a truck dealership lot at dusk, rows of new and used American long-nose conventional semi tractors with chrome grilles and sleeper cabs in cyan, white and red paint under strings of flags and tall lights, a glass showroom with a salesman inside, price tags on the windshields, never a flat-faced European cab-over truck" 256 144 apps/web/assets/scenes/dealer.png --style "$st" &
  wait
  "${P[@]}" pro "$HD: a small-town bank branch at dusk, a brick building with tall windows and a lit sign, a drive-through lane, $TRUCK in cyan paint parked at the curb, a man in a trucker cap walking in with papers, a lit interior with a teller counter" 256 144 apps/web/assets/scenes/bank.png --style "$st" &
  "${P[@]}" pro "$HD: a diner booth at night seen from across the table, a road atlas of the United States open on the table beside a mug of coffee and a slice of pie, a trucker's cap and keys, the window showing $TRUCK parked under the diner's neon sign" 256 144 apps/web/assets/scenes/guide.png --style "$st" &
  wait
}
placesloops() {
  local sub="a seamless loop that ends where it began, the camera and the buildings never move"
  "${P[@]}" animate apps/web/assets/scenes/truckstop.png "the tall sign and the diner neon flicker, a truck's lights blink at the fuel island, the driver walks a few steps and back, headlights pass on the highway, $sub" apps/web/assets/scenes/truckstop-loop --frames 16 --view side &
  "${P[@]}" animate apps/web/assets/scenes/lounge.png "the TV flickers, a driver sips coffee and sets the cup down, another turns a page, the vending machine light hums and flickers, outside the truck's lights blink, $sub" apps/web/assets/scenes/lounge-loop --frames 16 --view side &
  "${P[@]}" animate apps/web/assets/scenes/dealer.png "the strings of flags flutter in the wind, the tall lights flicker on, the salesman walks across the showroom, a price tag swings, $sub" apps/web/assets/scenes/dealer-loop --frames 16 --view side &
  wait
  "${P[@]}" animate apps/web/assets/scenes/bank.png "the bank sign glows and flickers, the man walks up the steps and through the door, the truck's marker lights blink, a car rolls through the drive-through lane, $sub" apps/web/assets/scenes/bank-loop --frames 16 --view side &
  "${P[@]}" animate apps/web/assets/scenes/guide.png "steam rises from the coffee, the neon sign outside flickers, a page of the atlas lifts and settles, the truck's lights blink through the window, $sub" apps/web/assets/scenes/guide-loop --frames 16 --view side &
  wait
  for s in truckstop lounge dealer bank guide; do python3 apps/web/tools/pack-loop.py apps/web/assets/scenes/$s-loop apps/web/assets/scenes/$s.loop.png --cols 16; done
}

# Iuliia, the walkthrough's trainer (Jeff, 2026-11-01): a Russian executive, class first and then the wit, long
# flowing blonde hair and brown eyes. The portrait in the staff's hand (Pro 128 × 128, the title as style, kept as
# iuliia-faces/portrait.png), two hands, the folder in one and the pen in the other; her body never moves again (the
# first moods animated her arms and one frame came out with three: Jeff, "This is slop"). Her rest frame and poster,
# iuliia.png, is that portrait with a composed, closed mouth painted on by portrait-sprites.py (Jeff, 2026-11-02:
# "a creepy smile on all the time"); the portrait's own half smile is a moment now. Animations of the portrait are
# only a source of faces: a blink, a laugh, a glance aside, whose frames portrait-sprites.py aligns and pastes over the
# face; src/portrait.ts plays them on a seeded schedule, never a loop. The welcome strip is her office at dusk (Pro
# 256 × 128, the portrait as reference).
iuliia() {
  local st=apps/web/assets/title/title.png d=apps/web/assets/people s=apps/web/assets/scenes f=apps/web/assets/people/iuliia-faces
  mkdir -p $f
  local sub="a loop that ends where it began, the face and clothes stay the same"
  "${P[@]}" pro "$PORTRAIT: a poised Russian corporate executive in her early thirties, long flowing blonde hair worn down past her shoulders in soft waves, warm brown eyes, small pearl earrings, a tailored charcoal suit jacket over a light ivory silk blouse, holding a slim dark leather folio against her chest like a board paper, a fountain pen in her other hand, composed, with a knowing half smile and one eyebrow a fraction raised, elegant and classy" 128 128 $f/portrait.png --style "$st" --seed 1235705877
  "${P[@]}" animate $f/portrait.png "she breathes slowly, blinks once and gives a small composed nod, her hair stirring slightly, a subtle idle $sub" $d/iuliia-loop --frames 16 --view side --transparent --seed 1333339439 &
  "${P[@]}" animate $f/portrait.png "she laughs softly with her eyes closed and her head tilting back a little, then smiles at the viewer again, $sub" $d/iuliia-laugh-loop --frames 16 --view side --transparent --seed 173182654 &
  "${P[@]}" animate $f/portrait.png "she glances to the side, toward the edge of the picture, and raises one eyebrow with a knowing half smile, then looks back at the viewer, only her face moves; her hands, the folder, the pen, her shoulders and her hair stay perfectly still" $d/iuliia-side-loop --frames 16 --view side --seed 3075658587 &
  "${P[@]}" pro "$HD: the corner office of a trucking company executive at dusk, a poised blonde woman in her early thirties with long flowing hair, a tailored charcoal suit and an ivory silk blouse, sits behind a polished dark wood desk smiling with one eyebrow raised, a large wall screen behind her shows a freight load board with rows of lanes beside a map of the United States, a white porcelain cup of tea with a slice of lemon on a saucer and a single black chess knight on the desk, tall windows with the city lights coming on, a warm desk lamp, a restrained elegant palette" 256 128 $s/welcome.png --style "$st" --reference $f/portrait.png --seed 528154814 &
  wait
  "${P[@]}" animate $s/welcome.png "steam rises gently from the tea cup, the city lights twinkle in the windows, the desk lamp glows softly, she gives the viewer a slow knowing smile and a small nod, a seamless loop that ends exactly where it began, the wall screen, the sky, the camera and the furniture never change" $s/welcome-loop --frames 16 --view side --seed 2558438596
  python3 apps/web/tools/pack-loop.py $s/welcome-loop $s/welcome.loop.png --cols 16
  cp $d/iuliia-loop/frame-09.png $f/blink-half.png
  cp $d/iuliia-loop/frame-12.png $f/blink.png
  cp $d/iuliia-laugh-loop/frame-03.png $f/laugh1.png
  cp $d/iuliia-laugh-loop/frame-04.png $f/laugh2.png
  cp $d/iuliia-side-loop/frame-07.png $f/side.png
  python3 apps/web/tools/portrait-sprites.py
}

# The title screen, drawn live by src/title.ts (Jeff, 2026-11-01: a real semi, a head-on rig at highway speed, the
# pickup and the life back, nothing on a loop). Its painted layers: the side view's sky, mesas and far desert, the
# diner, and a sheet of plants.
titleparallax() {
  local st=apps/web/assets/title/title.png l=apps/web/assets/title/parallax
  mkdir -p $l
  "${P[@]}" pro "$HD: a wide desert landscape at dusk seen straight from the side, a saturated orange and purple sunset sky with long streaks of cloud and a few early stars near the top, red-purple mesas and buttes standing along the horizon across the lower middle, the flat empty desert floor in the bottom third, no road, no buildings, no poles, no vehicles, no people" 256 144 $l/back.png --style "$st" --seed 502479405 &
  "${P[@]}" pro "$HD: side view of a small retro American roadside diner at dusk, a long low building with a row of warm lit windows and a chrome stripe, a glowing pink neon coffee cup sign on its roof, a strip of gravel lot, seen straight from the side, isolated on a transparent background" 112 64 $l/diner.png --style "$st" --transparent --seed 547048965 &
  "${P[@]}" pro "$HD: a sprite sheet of separate desert plants seen from the side at dusk: round sagebrush bushes, dry grass tufts, a small saguaro cactus, a prickly pear cactus, small rocks and a tumbleweed, each one separate with empty space between them, isolated on a transparent background" 256 64 $l/scrub.png --style "$st" --transparent --seed 1367072652 &
  wait
}

# The head-on shot's road: the original painting with its truck painted out (the truck is cut out where they differ).
titleapproach() {
  "${P[@]}" edit apps/web/assets/title/title.png "the same desert highway scene at dusk with the semi truck removed: the empty two-lane road runs on to the horizon with its dashed centre line, the diner, the poles, the mesas and the sky exactly as they are" apps/web/assets/title/approach.png --seed 7
}

# The title's vehicles, as eight-direction objects (true side profiles, which the Pro painter won't draw, and the
# coming and going three-quarter views): a bobtail tractor, its trailers drawn in title.ts; a pickup; a sedan. Objects
# take no seed; the shipped ones are objects 4fcfe870-2776-4459-ae17-1f60ff2f9033 (tractor),
# bf917e8a-d4a6-43c5-beb0-e7ff8b03319f (pickup) and ae028a00-bbbd-4514-8250-7cafd624fa3e (sedan). Then the atlas.
titlesprites() {
  local o=apps/web/assets/title/objects
  mkdir -p $o
  "${P[@]}" object "an American long-nose conventional semi tractor unit with no trailer, the whole truck from bumper to frame end, cyan paint, a sleeper cab, tall chrome exhaust stacks, a chrome grille, a fifth wheel coupling plate on the bare frame behind the cab, a steer axle and two drive axles" 80 $o/tractor-sheet --view side &
  "${P[@]}" object "a red American full-size pickup truck with a chrome bumper" 80 $o/pickup-sheet --view side &
  "${P[@]}" object "a dusty white four-door American sedan" 72 $o/sedan-sheet --view side &
  wait
  for k in tractor pickup sedan; do cp $o/$k-sheet/$k-sheet.png $o/$k.png; done
  python3 apps/web/tools/title-sprites.py
}

case "$want" in
  rigs) rigs ;;
  scenes) scenes ;;
  people) people ;;
  title) title ;;
  mix) mix ;;
  map) map ;;
  scenespro) scenespro ;;
  scenesloops) scenesloops ;;
  peoplepro) peoplepro ;;
  peopleloops) peopleloops ;;
  drivers) drivers ;;
  driverloops) driverloops ;;
  makes) makes ;;
  staff) staff ;;
  staffloops) staffloops ;;
  loading) loading ;;
  placespro) placespro ;;
  placesloops) placesloops ;;
  iuliia) iuliia ;;
  titleparallax) titleparallax ;;
  titleapproach) titleapproach ;;
  titlesprites) titlesprites ;;
  all) rigs; scenes; people; title ;;
esac
"${P[@]}" balance
