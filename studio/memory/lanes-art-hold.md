---
name: lanes-art-hold
description: Back Lot graphics wait until the parent LANES session finishes its current work; Jeff wants resources conserved
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9eb67832-08bf-44d9-a4e3-1088f8d69fb9
  modified: 2026-11-02T09:12:14.276Z
---

On 2026-10-31 Jeff said not to build the Back Lot graphics yet: "Wait until parent branch is done working to conserve resources."
- None had been made: nothing on main, nothing in PixelLab.
- The balance was 6,836 generations, refilling 2026-11-29.

**Why:** Jeff doesn't want resource-heavy side work, like PixelLab art passes, running while the parent session ([Lanes spec implementation], local_b255ba09-fced-449a-a36d-099bccccb4b3) is on a long job.

**How to apply:**
- Before starting an art pass from a side session, check whether the parent is mid-job. If it is, hold off and ask Jeff.
- The parent doesn't notify a forked session when it finishes, so the go-ahead has to come from Jeff.
- The art list to work from is the appendix of the bad-actor spec ([[lanes-bad-actor-spec]]). Draft 3 puts it at about 1,000–1,300 generations on a first pass. Only about 325 are worth painting before the server: robbers and security, the logbook, and phases 1–2.
- The Logbook tab (main 3586399) uses a "star" icon fallback; an `icons/logbook.png` would replace it in the next icon pass.
- 2026-11-01: the parent relayed Jeff's request for the tutorial guide, Iuliia, drawn by this session. Files: `people/iuliia`, `-point`, `-laugh` and `-wave`, each a 128 × 128 still plus a 16-frame loop at 8 fps; optionally `scenes/welcome.png`, 256 × 128.
  - Look: blonde; a navy or charcoal suit with a light blouse; a clipboard and pen; a warm smile. "Cute" in the charming sense, tasteful and professional.
  - Style: the staff portraits (`peoplepro` and `peopleloops` in `apps/web/tools/asset-pass.sh`). `build.mjs` writes the manifest that `hasAsset` reads.
  - The parent was still building, so I asked Jeff to confirm before starting. Estimate: 100–150 generations.
  - Jeff lifted the hold for her only ("Start Iuliia now"); the Back Lot art still waits. Her look changed three times in an hour: a braided trainer, then a hair-up executive (via the parent), then Jeff directly: "no ponytail, just flowing long hair". He approved the final base ("I like it"): long golden waves, brown eyes, a charcoal suit, an ivory blouse, a leather folio, a fountain pen, a half smile with one eyebrow up.
  - When Jeff's own words and the parent's relay differ, his own words win.
- PixelLab lessons (2026-11-01):
  - Costs: a Pro image at 128 × 128 is 10 generations; a 16-frame PixMiniMax loop is 2 at 128 × 128 and 1 at 256 × 128. When the queue is busy, a job takes 5–10 minutes.
  - PixMiniMax turned her palette orange on every "tap or point with the pen" motion (three of three), while idle, laugh and wave held. An affine colour fit from frame-01 to the base, plus a per-channel stretch back to the base's spread, fixed it. A histogram match turned the charcoal suit navy.
  - Scene loops drift (the sky darkens, the screens glare) unless the prompt says those never change.
  - Check every loop for colour drift and for the jump from its last frame back to its first, not only by eye.
  - The Pro painter drew both side-view rigs facing left although the prompt said "facing right". Mirror them.
  - Pro rigs come out three-quarter even when asked for a flat side view, and Jeff saw them as "driving diagonally" on a side-on road. For a true profile, use an eight-direction object's east cell (`pixellab.py object … --view side`).
  - To cut a subject out of a painting, edit a copy with the subject removed, then mask where the two differ, closed and hole-filled (`tools/title-approach.py`).
- The title screen, 2026-11-01. Jeff: "the road looks like the truck is driving but nothing in the background is moving."
  - It's now a side-view parallax composed by `apps/web/tools/title-parallax.py` from layers in `assets/title/parallax`.
  - The truck holds still while the shoulder, road and scrub stream past; the mesas stay put. 96 frames at 24 fps, seamless.
  - Client: `TITLE_LOOP` has `fade: 0`; `title.ts` inlines one poster frame. `title.png` stays as the painterly style anchor and no longer ships.
- Both went to main on 2026-11-01 with Jeff's "Push both": Iuliia as e48dfd8, the title as 88c1f4c. The parent republishes the live page.
- The same day Jeff asked to fix both titles and cycle them every 20 s. It went to main as c9fa456 on his "Push", relayed by the producer. The live page was republished as version 38 from c9fa456; any republish now builds from c9fa456 or later.
- The same evening Jeff (via the producer) asked for the title again: "a box truck, not a semi", the head-on "way too slowly", "the pick up truck again", "no loops".
  - It's now drawn live in `title.ts` from a seeded schedule, with one atlas cut by `tools/title-sprites.py`. The bobtail tractor object's east view is coupled to a 53-foot trailer drawn in code.
  - Head-on traffic uses the pickup and sedan objects' south-west and north-east views. Coming traffic sweeps out left near the camera.
  - Any screen shape works: the sky grows above the band and the ground below it.
  - On main as bebf2d4 (Jeff: "Push it"), plus 02e2732, which drops mapart's dead title loaders. Portrait ground under the head-on shot is the road extended in perspective from the painting's bottom row.
  - Review frames come from a never-committed `src/titletest.ts` harness plus a scratchpad frame catcher on port 5190 (launch.json "title-frames").
  - The side view uses the profile truck.
  - The head-on shot is the original painting with the truck cut out and driven up its lane by `title.ts` (`drawTitleShots`, `APPROACH`).
  - The shots alternate side view, then head-on, each with a one-second fade.
- Iuliia v2, 2026-11-01. Jeff (via the producer): "She has 3 arms. This is slop. Don't make her animations loops either."
  - The cause: PixMiniMax's wave loop animated an arm, which came out from behind the folder while her real sleeve still hung at her side.
  - Rule: never animate a portrait's arms or hands. The body stays static; only face patches change.
  - Now: `src/portrait.ts` `drawPortrait(ctx, x, y, size, mood, tMs)` plays a seeded schedule from one sheet, `people/iuliia-sheet.png`, cut by `tools/portrait-sprites.py` from frames in `people/iuliia-faces`.
  - Blink patches cover the whole eye area, so a blink over the side glance doesn't smear.
  - On main as 6e9322f. Engineering wires it into Walkthrough; I don't touch `src/ui`.
  - Review harness: a never-committed `src/portraittest.ts` posting frames to the catcher on port 5190.
- 2026-11-02 logo: Jeff saw the E, S and "Terminal" in a darker blue. Two-colour remap per face in `logo/lanes-title.png` and `lanes.png`; on main as 3964f5e.
- 2026-11-02 title pass 2. Jeff: "cars can't be driving both ways into each other"; vehicles were stills; trains overlapped the diner and each other.
  - Producer's rules:
    - one lane each way;
    - every vehicle animated (wheels, bob, exhaust, lamps);
    - per-lane gaps, one train per track, one way;
    - roadside reservations (diner, signs);
    - a real speed-limit sign.
  - Built: commit 0c7bae3, local only, awaiting Jeff's review of the side and head-on mp4s. Push it only on his go.
  - Open question for Jeff: the head-on painting's truck comes in the right lane, which is wrong for US traffic. The fix would be to mirror the shot and redraw the DINER sign.
  - Lessons:
    - At this camera height, the far lane needs about 14 px of separation or it reads as tailgating.
    - Stateless spacing is a max/min chain over spawn order.
    - Trains: one train per slot, wholly inside the slot.
    - Head-on occlusion uses the "head-front" mask cut from approach.png.
  - Harness: `src/titletest.ts`, never committed. Recordings: frames from the catcher on port 5190 → ffmpeg, 4x nearest-neighbour.
- 2026-11-02, map trucks. Jeff: "my trucks are box trucks on the map, not semis."
  - The map draws `assets/trucks/{van,reefer,flatbed}64` (68-px cells, 8 headings) for the player's trucks.
  - `assets/rigs` holds the card portraits, which were already semis.
  - The sheets are now rendered by `tools/rig-sheets.py` from a rig measured in feet:
    - ray-cast boxes and cylinders, a 50° tilt, the rig drawn 1.45× wide and the tractor 1.12× long;
    - snapped to the old palette, with depth-edge outlines;
    - the cab cyan is the only colour in the 165–210 hue band, so the owner recolour still works.
  - On main as d4523f3.
  - To push one commit past an unpushed one: cherry-pick it onto origin/main on a temporary branch, push, then rebase the work branch. The title commit is now a17c35e, still waiting on Jeff.
- 2026-11-02, Iuliia: "a creepy smile on all the time."
  - Rest is now a composed mouth, painted by `portrait-sprites.py` onto `iuliia-faces/portrait.png` (the PixelLab original) to make `iuliia.png`.
  - Smiles are scheduled moments.
  - Recorded and sent to the producer; push waits for a go.
- 2026-11-02, title pass 3. Jeff: "Each vehicle moving is a still image that looks like crap." He kept the painting's lanes (coming traffic on the right).
  - Head-on traffic is now rasterised live in `title.ts`: flat-shaded faces, a depth buffer, depth-edge outlines, and a Bayer-dithered height gradient on painted panels.
  - The models (pickup, sedan, 4 rigs with detail) and the per-pair headway table come from `tools/title-vehicles.py`.
  - Camera derived from the painting: level, h 7 ft, VP (211,89), f 120 (the ground doesn't fix f; the painted truck's 3/4 view does). Lanes at −14 and −26 ft.
  - Vehicles pass the camera at full size, with modeled wheels, a spoke and a hub; no atlas.
  - `assets/title/poster.png` is frame 0 of shot 0, rendered by the harness.
  - Sprite atlases for perspective vehicles were rejected: passing vehicles need hundreds of huge sprites.
- 2026-11-02, title pass 4 (supersedes pass 3's approaching traffic). Jeff: "keeping the semi truck in center screen while the background and everything else changes … It was really nice it just kept the background still."
  - Head-on: the painting's own rig stays fixed at `TRUCK_AT` and comes alive: a 1 px bob, exhaust, a headlight wash, lamp pulses, grille and mirror glints, hub glints walking round.
  - The world streams past in perspective (`streamGround`, `roadThings`): poles and wires, scrub, signs, and the painting's diner leaving from where it is painted. Clouds drift. The train runs behind with a locomotive at its head.
  - `DRIFT = 1`: the world falls away toward the horizon, because the rig faces the camera and drives toward it. `-1` would flow toward the camera instead, which reads as the rig reversing.
  - Narrow screens centre the rig (`ox` clamped to the painting). A phone at 375 wide shows the diner sliding in from the left edge as it recedes.
  - Head-on far lane: exactly one rasterised pickup or sedan a shot, pulling away (Jeff: "This is a desert and there should be barely any traffic").
  - No PixelLab credits went on vehicle views.
  - Side view (Jeff: "bring back" the original detailed pickup, plus more vehicles and semis): the oncoming traffic was hidden behind our 152 px rig in the far lane (a phone is 188 wide), so the rig now rides the far lane and the traffic passes in front in the near lane.
  - Then Jeff overrode "keep the painting as is": US lanes in both shots. `shot()` draws each shot the painting's way (left-hand), then `mirror()` flips the frame. Head-on, the rig comes in the camera's left lane. Side-on, our rig drives right to left in the far lane (driver's side), with oncoming traffic left to right in front of it.
  - All title lettering goes through `letter()`, which sets text back to front so it reads forward after the flip. The head-on diner's painted sign (it read DNHER) is redrawn as DINER (`dinerSign`, `DINER_SIGN`). Commit 1e4859f.
  - Reverted the same night: the producer had misread Jeff. Jeff: "why did you flip it, mirror it??? The original one was perfect, it was in the correct lane". He reads lanes from the viewer's side, so the painting's rig on the screen's right is "correct" to him.
  - Final lanes: the side view is our rig facing right in the near (bottom) lane, oncoming traffic in the far lane behind it. Jeff accepted that it's mostly hidden. The head-on is the painting un-mirrored, with its own sign.
  - Head-on `DRIFT = -1` (4770419) read as the rig reversing (Jeff: "now the truck is in reverse going backwards"). ccaa650 puts `DRIFT = 1` back and keeps the roadside on the ground: things come in large at the near edges and shrink into the haze, the wires from the pole behind the camera are drawn, the diner fades out past 1000 ft, and `DINER_EVERY = 1800` brings a second one in from the near left at about 22 s. The poster was regenerated as the new frame 0, and it gained only those wires.
  - Head-on lanes (US, from the camera on the right shoulder; road -32 to -1.8): coming -24.5 is the painted rig's lane, and going -9.5 is the right of the screen. Both are set in `tools/title-vehicles.py`.
  - The head-on has no car, by the producer's call: the right lane runs between the camera and the rig, so a car passing the camera must sweep across the rig's grille (about 0.17 s at 80+80 ft/s). Any car later should pull onto the road from a side road on the right, beyond the rig, and only if Jeff asks for traffic there.
  - Lesson: check a brief's screen-space claims against the camera geometry before building ("appears at the bottom right" was impossible for X < 0).
  - Lesson: when a relayed instruction overrides something Jeff earlier asked to keep, ask for his exact words before doing anything irreversible-looking.
  - `oncoming(n)`: each side shot has three shuffled 10 s slots: a pickup (the bebf2d4 red one, or `pickup-teal`, the 6428739 painted loop's slate teal), a semi in red, white or amber, and a sedan, the other pickup or nothing. Each crosses in 2 s or less, so two are never on screen at once.
  - Title and surround were pushed on Jeff's "go ahead and push … I'll play it in game", without a review round.
- 2026-11-02, map surround (`tools/map-surround.py`): painted at 500×446 per season and shipped at the map's own scale, 2000×1784 (4× nearest, about 160 KB), because engineering's `mapview.ts` draws it one to one with the map centred in it (equal margins: 208 and 464).
  - The panning clamp puts the map's edge exactly at the window's edge, so `mapview` must draw the surround whenever the 48 px faded edge is on screen (`fade = 48 * k`), not only where the map leaves a gap.
  - The l0 maps get a 48 px alpha feather and a sea dehaze over 170 px; the originals are kept in `surround-src/l0-*`.
  - `tame()` caps the surround's greens at the map's own 99.5th-percentile chroma. Summer's Yucatán came back lime. The hue test has to exclude cyan sea glints.
  - About 100 PixelLab generations (Pro edit, 25 each).
