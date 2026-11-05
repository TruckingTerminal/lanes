---
name: lanes-sprint2-art
description: Sprint 2 art (2026-11-03) — sixteen driver portraits and the three tractor makes; methods that worked and where the makes work is parked
metadata:
  node_type: memory
  type: project
  originSessionId: 9eb67832-08bf-44d9-a4e3-1088f8d69fb9
  modified: 2026-11-02T14:10:28.701Z
---

Sprint 2 (from 2026-11-03), via the producer:

**Driver portraits** (Jeff: "there's only 2 for drivers"):
- Files are `assets/people/driver-{m,f}{1..8}` (still, `.loop.png`, `.loop.json`). m1 and f1 are copies of `driver-m` and `driver-f`.
- Engineering picks the variant by person id; the note is `studio/reviews/art-portraits.md` with its sheet.
- The producer asked for that studio note and the push in so many words, which overrides the usual "producer commits studio files" for that item.
- The recipe is `drivers` / `driverloops` in `asset-pass.sh`.

What worked:
- Pro 128 px with the original portrait as `--style` matches the light and background exactly.
- `driver-m.png` carries a 1 px dark frame on its bottom and right edges, and everything styled from it inherits it. Remove it afterwards.
- Loop checks: colour drift against the still, the seam (last frame to first), then an eye pass. Most loops pass first time; m3, m8, f6 and f8 needed re-rolls.
- A loop that turns the skin orange is fixed with an affine RGB fit from frame 1 to the still.
- The `-loop/` frame dirs are gitignored; only the stills, loop sheets and JSON are committed.

**Three makes** (Keystone, Meridian, Ironwood; sprint plan item 6), on main as 82d1b8d (2026-11-03):
- Cards: `assets/makes/*.png` (128×96). Map: `assets/trucks/makes/{make}-{van,reefer,flatbed,bobtail}.png` plus `layout.json`. Note: `studio/reviews/art-makes.md`.
- Pipeline (`makes()` in `asset-pass.sh`): `makes.py layouts` → a Pro edit per layout → `makes.py fit map`.
- The edit that works is text-guided `pixellab.py edit <layout> "<style>: <what the make is>"`. It keeps the layout.
- An image `--ref` edit copied the reference or added stacks and tanks to the Meridian, and `--seed` isn't honoured on edits.
- `fit` maps the teal onto the rig cards' 8 commonest cab cyans by brightness. Rank-mapping onto all of them made stripes.
- On the map, Ironwood's cab lamps are one amber bar; that is what tells it from Keystone at mid zoom.
- At the opening zoom a whole rig is 3–4 px, so no make reads there.
- Left for sprint 3: the warm glow on the roofs may read two-tone on light cards, and a rig card per make.
- Lesson: the scratchpad lives under /tmp and was wiped by the 2026-11-02 reboot. Keep anything needed later (PixelLab outputs) in the repo tree.
**Staff portraits and the reefer mark**, on main as a5d1c04 (2026-11-03):
- Every kind is now `<kind>-{m,f}` in kebab case: dispatcher, ops-manager, maint-manager, ceo, security-manager, sales-rep, broker, mechanic, dockworker.
- The originals were all men and are copied to `-m`. Recipes: `staff` / `staffloops`. Note: `studio/reviews/art-staff.md`.
- On the map, other carriers' reefers are a blue diamond (`mapview.ts`, cached per size); the hollow square read as a dark dot at 3–4 px.
- Lessons:
  - A `--style` portrait can leak its props: the dispatcher's headset and monitor turned up on the ops manager. Name what the job is not ("no headset"), or use a plainer style source.
  - Yellow hi-vis loops drift orange in PixMiniMax. The original dockworker loop had it, and so did both dockworker-f rolls. The "only the face moves" motion plus one affine colour fit cures it.
  - Where a hand is up at the ear or chin, use the "only the face moves; head, hands, arms perfectly still" motion.
  - A wrap jump no bigger than the loop's ordinary frame steps is fine.
  - Never edit a shell script while bash is running it: bash reads scripts as it goes, and an edit mid-run caused a syntax error at the end.

**Sprint 3 prep**, on main as ef9cb7c (2026-11-03):
- One paint per make card. `makes.py fit` takes the layout's per-pixel part names (`draw(..., names=True)`) and maps every lit pixel the model calls `paint` onto the cab cyan, so the repaint's warm roof glow is gone. Trailer `white` goes onto the van card's whites the same way.
- Rig cards: `assets/makes/{make}-rig.png`, 256×96, a plain van (the map's dark band dropped).
- The Meridian rig wouldn't hold its layout through a whole-rig edit (four tries, each rescaled). Instead, `rig-tractor` repaints the tractor alone in a 128 px window and `rig-compose` lays the donors' painted trailer under it, aligned by the tail.
- Icons `intel`, `book`, `carriers` and `switch` come from `tools/icons.sh`, which only paints missing files. Check each at 28 px: a 2×2 grid of sheets reads as a window, and small objects that don't fill the frame vanish.

Related: [[lanes-art-hold]], [[lanes-studio-role]].
