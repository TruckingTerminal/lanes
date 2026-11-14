# The menu system: beautiful, animated, still where it counts (ux, 2026-11-13)

Jeff, 2026-11-13: "Since this is mostly a menu screen game/sim, let's make the menus as beautiful and interactive as
graphically possible… beautiful and animated." This note is the design. Engineering builds it after ruleset 0.25.0
goes live; the art role paints from section 6 now. No code was changed.

Read for it: `apps/web/src/page.html` (all of it), `ui/TopBar.tsx`, `ui/Rack.tsx`, `tabs.ts`, `build.mjs`'s asset
rules, `tools/ASSET-PLAN.md`, the art bank's queue (`art-bank/queue/*.jsonl`, 439 jobs, 4,453 generations; no
manifest yet), the title (`assets/title/title.png`), the director's windows and standing notes of today.

**The one-line idea.** The game is a dispatcher's evening: a warm sunset world painted behind every screen,
and in front of it, solid paper and enamel where the numbers live. The paintings move; the numbers don't.

---

## 0. What changes from today, in one list

| Today | After | Why |
|---|---|---|
| The `cyber-ops` TMS theme: teal on near-black, mono type everywhere | One house theme, **Sunset** (tokens in §1.1); teal kept as the accent (the title's cab) | Anchors the menus on the title's palette |
| `--font-body` is JetBrains Mono | Body in **Inter**, figures in **JetBrains Mono** tabular, display headings in **Pixelify Sans** (Google Fonts, ~25 KB) | Mono body reads as a console, not a game; figures stay mono so columns align |
| 1 px CSS borders on `.card`, `.btn`, sheets, toasts | Painted nine-slice frames (§1.2) with the same border widths | The look, with no layout shift when the art decodes |
| `.btn.primary::after` gleam on an infinite 3.6 s loop | Gleam once when the button appears, once on hover | Rule 4.3: one accent at a time; an endless gleam on every screen is a second accent |
| `.btn.on` `tab-breathe` infinite; `.btn.on img.px` `icon-bob` infinite | The active tab's icon plays its 4-frame lit loop once on select, then rests lit | Same |
| `.stars` `star-twinkle` infinite | Cut | It glows over a rating being read (rule 4.1) |
| `.logowrap::after` gleam every 5 s | Once on the title and once when the top bar first paints | Same |
| No motion setting; `prefers-reduced-motion` honoured piecemeal | One **Motion** setting (Full · Calm · Still), defaulting from the system (§2.6) | Respect the system, and let a player choose |
| Phone toasts at the bottom over the tab bar's edge | Phone toasts drop from under the top bar (§1.6) | Taps never move: nothing lands over the bottom bar or a pinned Bid |

Kept as they are: the four phone tabs and their order (Truck, Loads, Money, More), the strip/half/full sheet, the
explain sheet and its tap-outside layer, Needs you, the city pane, the map, every string. **Strings added** (the
writer words them): the Motion setting's label and three choices and its one-line help; the stamps' words
(BID IN, BOOKED, WON, LOST, PAID); the fee chip ("−41 FD · settlement fee", "−212 FD · 3 costs"); the board's
"3 new loads" pill; Money's "1 new entry" pill.

---

## 1. The visual language

### 1.1 Palette and type (code)

Taken from the title painting's own pixels (its sixteen most common colours): dusk plum #382838, violet
#583878, mesa magenta #884888, rose #b85878, coral #e87868, peach #f89868, apricot glow #f8b878, rust #985848,
and the rig's teal cab. The Sunset theme replaces `cyber-ops` in `themes.css` (same token names, so no component
changes for colour):

| Token | Value | Use | Contrast on `--bg-panel` |
|---|---|---|---|
| `--bg-primary` | #1a1220 | page, behind the sheet | — |
| `--bg-secondary` | #241a2c | top bar, tab bar | — |
| `--bg-panel` | #2c2036 | cards, panels, sheets | — |
| `--bg-input` | #140e1a | fields, steppers | — |
| `--border` | #4d3a5c | fallback border before the frames decode | — |
| `--text-primary` | #f7ebde (warm cream) | body, figures | 13.1:1 |
| `--text-secondary` | #cdb6c4 | labels, captions | 8.1:1 |
| `--text-dim` | #a68fa8 | the dimmest text allowed | 5.2:1 |
| `--accent` | #3fd9c4 (the cab teal) | primary action, active tab, focus | 8.7:1 |
| `--text-on-accent` | #1a1220 | label on a teal button | 10.4:1 on teal |
| `--accent-warn` | #ffb454 | warnings, Needs you amber | 8.7:1 |
| `--accent-danger` | #ff6b6b | losses, danger | 5.5:1 |
| `--accent-success` | #86e09a | pay, wins | 9.6:1 |
| `--sun` (new) | #f89868 | the horizon line, glows, the money glow | 7.1:1 |
| `--paper` / `--ink` (new) | #f3e6d2 / #2a1d2e | the month report and receipts (the one light surface) | 13.0:1; red ink #a3262a 6.0:1; green ink #1f6b3a 5.3:1 |

Every pairing above passes 4.5:1. The `--wp-*` and `--status-*` route and status colours stay as they are (the map
uses them).

**Type.** Body Inter 13 px laptop / 15 px phone (as today). Figures `.num`: JetBrains Mono, `tabular-nums`, 600
weight for money. Headings h2/h3 in Pixelify Sans (20/16 px phone), letter-spacing 0.02em, never for a number.
Labels (`.label`) stay mono caps.

### 1.2 What is painted (PixelLab) and what is code

| Element | PixelLab | Code |
|---|---|---|
| **Panel, card, dialog, sheet top, ticket, paper frames** | Six nine-slice sources (§6, P1): painted wood-and-enamel rims, rivets at the corners, warm rim light on the top edge | `border-image` at 1 source px per CSS px (12 px corners), `image-rendering: pixelated`; interior fill is the CSS token, never a painting |
| **Buttons** | Primary (teal enamel, apricot rim), secondary (plum), danger (brick): each a rest and a pressed state, nine-slice | Label, hover gleam, focus ring, disabled (CSS `saturate(0.3)` + 0.5 opacity), busy (a 3-dot code spinner) |
| **Tab bar icons** | The four phone tabs at 128 px (truck, board, money exist; More is new), each with a 4-frame "lit" loop | Size (28 px), the active top line, the dots |
| **Rack and More icons** | The 11 existing icons, the queued `tab-*` set | — |
| **Top bar** | Four hour badges (dawn, day, dusk, night) at 128 px shown at 24 px | The bar (a dusk gradient #241a2c → #2c1c30 with a 1 px `--sun` horizon line at its foot), the clock, cash, chips |
| **Backdrops** | 256 × 144 scenes with 16-frame loops (most exist; §3, §6) | Cropping into "windows" (§1.3), the hour grade (CityPicture's per-hour light, reused), the season tint fallback |
| **Badges and plaques** | Standing band plaques, milestone medallions, notoriety (Back Lot) at 128 px | Tier numerals and words drawn over them in code (PixelLab can't letter) |
| **Stamps** | One empty ink-stamp ring, 128 px | The word (BID IN, BOOKED, WON, LOST, PAID) in Pixelify Sans, ink colour by CSS |
| **Accent effects** | Spark trail (8 frames, 32 px), stamp dust (6 frames, 48 px), shine sweep (8 frames, 64 px) | Their paths and timing |
| **Iuliia** | Faces exist (portrait, blink, blink-half, laugh1/2, side); add *proud* and *concerned*; an 8-frame breathing loop at 128 px | Which face, when; the blink timer |
| **Layout, type, motion, scrims, grain** | — | All code; a 64 × 64 grain tile at 4% over panels is code-generated noise |

### 1.3 The window: how a backdrop sits on a screen

Every main screen opens with a **window**: a horizontal slice of its scene, full width, above the panel's title.

- **Phone:** 72 CSS px tall at the top of the sheet's body (half and full). At strip height the window is hidden.
- **Laptop:** 96 CSS px tall at the top of the side rack, under the four tabs.
- **Hero** (16:9, the whole width): only for moments, never a working screen: the walkthrough's welcome, What now?,
  a truck bought, the month report's cover, a tier reached, a brokerage stage reached.
- **Scaling (pixel-art rule kept):** whole-number scale in *device* pixels: `scale = ceil(boxWidthDevicePx / 256)`,
  then cropped to the box around the art's declared focal point (`focalX`, `focalY` in the kit's JSON, set per
  scene by the art role). A 390 px phone at DPR 3 shows the scene at 5× (1280 device px) cropped to 1170.
- **The window scrolls away with the content** (no sticky, no parallax on scroll). Under its bottom edge a 16 px
  gradient fades it into `--bg-panel`, so no text ever sits on the painting.
- **The hour grade:** the scene is regraded by the world's hour band (night, dawn, morning, midday, afternoon, golden,
  dusk) using `CityPicture.tsx`'s grade, so the same painting reads as morning or night. Zero generations.
- **Before it decodes:** the box is reserved at its size and filled with the scene's average colour (in the JSON), so
  nothing moves when it lands; it fades in over 160 ms.

### 1.4 Cards, tickets and sheets

- **Load cards are tickets** (`frame-ticket`): a cream-edged freight ticket rim on the panel colour, a perforated
  left edge (painted), the profit chip in its top-right. Blocked cards keep their 0.55 opacity and gain a grey
  rim (CSS filter), with the reason chip as today.
- **The load sheet** is a clipboard: the `frame-paper` top with a painted clip, the facility's window above it.
- **Dialogs** (Confirm, the explain sheet on laptop) use `frame-dialog`: heavier rim, a drop shadow 0 24px 60px.
- **The phone sheet's top** is `frame-sheet` (a rounded painted lip with the rim light); the grip stays code.
- **Receipts and the month report** are `frame-paper` on `--paper` with `--ink` text: the one light surface,
  so money moments look like paper.

### 1.5 Tabs

- **Phone bar** (56 px, kept): icon 28 px over the label; the active tab shows its lit frame and a 2 px `--sun`
  top line (today `--accent`; teal stays for the primary action so the eye has one teal per screen).
- **Rack tabs on laptop:** the same icons at 24 px, the active underline in `--sun`.
- **In-panel segments** (`.seg`, `.citytabs`): code only: a filled plum pill for the active segment, no art.
- **Teasers** (Jeff's rule kept): dashed rim stays, the icon at 60% opacity, never animated.

### 1.6 Toasts and chips

- **Phone:** a toast drops from under the top bar (top: 44 px + safe area), full width minus 8 px gutters, on
  `frame-ticket`. Never over the tab bar or a pinned action row. Swipe up or wait 4 s (6 s if it holds a figure).
- **Laptop:** bottom-right as today, on `frame-ticket`.
- At most one toast at a time; a second waits (they queue on the accent stage, §4.3).

### 1.7 The top bar

44 px as today, phone first: company chip · hour badge + clock · cash · Needs you. The hour badge swaps at the
hour band's edge with a 300 ms crossfade (an ambient change, not an accent). The cash sits on its own dark chip
(`--bg-input`, 1 px `--sun` rim at 30%) so the money glow (§2.4) has a place to happen behind the figure, never on it.

---

## 2. Motion

### 2.1 Tokens (code)

```
--t-tap: 0ms        pressed state shows at once
--t-quick: 120ms    leaves, hover, small fades
--t-enter: 220ms    content arriving
--t-sheet: 280ms    sheet snaps, dialogs
--t-morph: 300ms    card → load sheet
--t-flight: 520ms   money spark
--ease-out: cubic-bezier(.2,.8,.2,1)       everything arriving
--ease-in: cubic-bezier(.4,0,1,1)          everything leaving
--ease-in-out: cubic-bezier(.45,0,.25,1)   the money spark's arc, the card morph
--ease-snap: cubic-bezier(.3,1.25,.5,1)    sheets and stamps only; overshoot ≤ 4 px, never on a figure's box
```

Only `transform` and `opacity` animate (plus the sprite's `background-position`); never width, height, top or
left. `will-change` only while an animation runs.

### 2.2 Screens entering and leaving

| Move | Out | In |
|---|---|---|
| Phone tab switch | old content opacity → 0, 90 ms `--ease-in` | new content opacity 0 → 1 and translateY 8 → 0 px, 220 ms `--ease-out`; the window crossfades 240 ms. The sheet's height never changes on a tab switch |
| Laptop rack tab switch | same | same; the map is untouched |
| Board card → load sheet | the card's ticket frame morphs into the sheet's header (View Transitions where the browser has them: Chrome, Safari 18; otherwise a crossfade), 300 ms | the sheet's body fades in 160 ms after the morph |
| Load sheet → back | reverse, 220 ms | |
| Dialog (Confirm) | scrim 0 → 60% in 160 ms; dialog scale 0.96 → 1 and fade, 200 ms `--ease-out` | leave: 120 ms fade, no scale |
| Sheet strip/half/full | 280 ms `--ease-snap` (today's transition, retimed) | |
| Hero moment | the hero fades in 300 ms over a dimmed screen; its loop starts after it lands | dismiss: 160 ms |
| City pane | today's 200 ms fade plus scale 0.98 → 1 | |

No horizontal page slides: a slide moves every target on the screen.

### 2.3 How a control answers a touch

- **Button:** pressed frame at 0 ms (the bevel inverts, the enamel darkens one step); no translate, no shrink. A light
  ripple from the touch point, 280 ms, clipped to the button, peak 20% white. Hover on laptop: the gleam once,
  600 ms. Released over the button: the action; dragged off: no action, frame returns in 120 ms.
- **Busy:** a button whose action waits on the world keeps its exact size and shows three code dots instead of its
  label; never disabled-grey (it reads as refused).
- **Stepper (counter bid):** the value swaps in place; hold to repeat at 8 per second after 400 ms. No rolling digits.
- **Bid:** tap Bid → pressed frame → the same button box becomes the status "Bid in · clears 18:00" (same size and
  place). On the card, a **BID IN** stamp lands in the ticket's top-left corner, clear of every figure: scale
  1.25 → 1 with `--ease-snap` over 160 ms, then the 6-frame dust at 12 fps. One accent.
- **Clearing:** the result card shows **WON** (green ink) or **LOST** (grey ink) stamped the same way. Won: the truck
  card's rig loop starts rolling. Lost: no shake, no red flash; the reason line under it as today.
- **Book now:** **BOOKED** stamp, then (on the truck card) the "Next:" line appears with a 1.2 s highlight fade behind it.

### 2.4 Money moving on screen

The rule: **a figure changes once, in place, and the motion happens beside it.** No counting up, no rolling digits.

**Pay landing** (one accent, ≤ 1.4 s):
1. The toast arrives (§1.6): "Paid · Dallas → Tulsa · +4,180 FD". Its figure is still from the first frame.
2. At 300 ms a spark (`fx` 8 frames, 32 px) leaves the toast's figure on a 520 ms arc (`--ease-in-out`) to the top
   bar's cash chip. The spark travels over the map or the window, never over text in a panel; on a phone its path
   runs from the toast (under the top bar) up to the chip, about 60 px.
3. On arrival the cash swaps to the new value and a `--sun` glow breathes behind the chip once: box-shadow 0 → 12 px →
   0 over 600 ms. The digits never move.
4. Money's tab dot appears (as today).

**A fee or cost leaving:** the cash swaps at once; a chip appears under the top bar's cash in the toast lane:
"−41 FD · settlement fee", still for 1.6 s, then fades over 300 ms. Several in one tick merge into one chip
("−212 FD · 3 costs"); a tap opens Money at those rows. No falling coins, no red flash on the cash.

**Big money** (a truck bought, a loan drawn, a month's pay): the receipt (`frame-paper`) shows the figures, then the
**PAID** stamp lands on the paper's corner. A truck bought adds the hero (`mkt-keys`).

**Inside Money:** a new ledger row while the screen is open does not push rows down; a pill "1 new entry" appears at
the list's top; a tap scrolls to it and the row's background fades from `--sun` 20% to none over 1.2 s.

### 2.5 Idle life (ambient, always behind a scrim or in a window)

- **Backdrop loops:** 16 frames at 8 fps (a 2 s loop), drawn by the existing stepped CSS (`.loop`), so they cost no
  JavaScript per frame. Small motions only: a light, steam, a flag, one figure.
- **Iuliia:** at 96 px and up, the breathing loop (8 frames at 6 fps) and a blink every 4–7 s (random, from the
  blink and blink-half faces); at 32 px in the strip, the blink only. A new line: the text fades in whole over 160 ms
  (no typing effect: typed text is text moving while it's read) and her face changes for 2.5 s (laugh for good news,
  concerned for bad, side for a question), then back to the portrait.
- **The yard:** a parked rig's exhaust and the sodium lamps flicker (the yard loop exists).
- **The dock clock** (load sheet, windows): a painted clock face with **code hands set to the deadline** ("deliver by
  Thu 14:00"), not ticking. It is a picture of the deadline, never a countdown. A tight load (under 4 h of slack)
  lights an amber lamp on the clock's rim, steady, not blinking.
- **The hour badge** on the top bar changes with the world's hour.
- Loops pause when: their box is off screen (IntersectionObserver), the page is hidden, a dialog or a full sheet
  covers them, or Motion is Calm or Still.

### 2.6 Reduced motion

One setting, in the ≡ menu: **Motion: Full · Calm · Still**. Its default follows the system: `prefers-reduced-motion:
reduce` → Calm; otherwise Full. A player's own choice is kept per device (localStorage; it is a convenience, not
world state).

| | Full | Calm (the system's reduce) | Still |
|---|---|---|---|
| Backdrop loops, Iuliia's breath | play | first frame only | first frame only |
| Iuliia's blink and faces | yes | faces change, no blink | faces change, no blink |
| Screen and sheet moves | as §2.2 | opacity only, 120 ms; sheet snaps 120 ms without overshoot | instant |
| Stamps | land with scale and dust | appear, 120 ms fade | appear |
| Money spark and glow | yes | no spark; a steady `--sun` ring on the cash chip for 1.2 s | the ring, no fade |
| Gleams, ripples, lit-icon loops | yes | none | none |
| The live badge's blink | yes | steady dot | steady dot |

The page's last rule (`@media (prefers-reduced-motion: reduce) { * { transition: none; animation: none } }`) is
replaced by a `data-motion="full|calm|still"` attribute on `<html>`, which every motion rule keys on.

---

## 3. Each screen: its character and backdrop

Phone first; the laptop notes follow. "Exists" means in `apps/web/assets`; "queued" means in the art bank's queue;
"new" is in §6. Every window has the hour grade; seasons come from the painted season files where they exist and
from the CSS tint where they don't.

**The board (Loads).** *A dispatcher's desk at the end of the day: busy, warm, the board on the wall.* Window:
`office` (exists, with seasons and loop). Cards are tickets in time order; the profit chip is the brightest thing on
each. New loads arriving at a round never push the list: a pill "3 new loads" sits at the top until tapped. Accent
moments: BID IN, WON/LOST, BOOKED. Laptop: the same in the rack; the map beside it carries the motion.

**A load sheet.** *The shipper's place, seen from the cab as you pull in.* Window: the origin's facility by the load's
kind (queued: `shp-docks`, `shp-factory`, `shp-coldstore`, `shp-dc`, `shp-produce`, `shp-steel`, `shp-lumber`; until
they land, `dock`). Under it, the clipboard: lane, pay line, windows block, the dock clock. The pinned Book/Bid row
is solid and never covered. With windows on, the **gate pass**: the director's "What you're agreeing to" block on a
ticket with a perforated edge, the clock beside the deliver-by line. Laptop: the facility's hero (512 × 288) when it
exists, else the window.

**The truck card.** *Your truck, alive, where it is right now.* The side-view rig loop (exists) over a window chosen by
its state: rolling → `road-golden` (new: the open interstate at golden hour, no vehicles); at a dock → `dock`; resting
→ `plan-restarea` (queued); in the shop → `plan-repair` (queued); broken down → `plan-breakdown` (queued); home →
`plan-hometime` (queued); waiting at a shipper → `shp-detention` (queued). The rig rolls only while the truck rolls.
At night the hour grade turns on its headlights' glow (code). Now/Next lines (windows) under it. Laptop: the card is
wider; the rig at 3× instead of 2×.

**The yard.** *The lot at dusk, your trucks under the sodium lamps.* Window: `yard` (exists). Each truck a ticket with
its rig still (the rolling loop only on the truck card). A truck bought arrives here with the hero `mkt-keys`.

**The Dealer and its showroom.** *A showroom under spotlights; the used lot out back.* Dealer window: `dealer`
(exists). The showroom: `showroom-floor` (new) with the chosen rig painted on its stage, a spotlight sweep accent once
on open; the used row: `mkt-usedrow` (queued). The price and the terms sit on paper below, never on the stage.

**Money.** *The bank lobby late in the afternoon; the books on paper.* Window: `bank` (exists). Cash, what's owed and
when, costs: on cards. The pay line and receipts on `frame-paper`. The loan desk: `mkt-loan` (queued). The fold for
the token surfaces stays below, unchanged. All money motion is §2.4.

**The month report.** *Your own books at month's end: a ledger on the desk under the lamp.* Cover hero: `ledger-desk`
(new), then the report on paper, every row named, figures in mono. Opening the report is the one place a page-turn
plays (the paper slides up 24 px and fades in, 300 ms). Nothing animates on its pages.

**Intel and the public report.** Intel: *the truck-stop lounge where talk is,* window `lounge` (exists); the company
rows as today. The public report (the published monthly): *a trade paper,* the masthead `masthead-s1..3` (queued; the
art role picks one) and the section spots `report-*` / `spot-*` (queued), on `--paper`. The month report is your
ledger; the public report is the paper everyone reads; they never share a look.

**Staff.** *The hiring hall.* Window: `plan-hiring` (queued; until then `lounge`). People rows carry their portrait
loops (exist) at 48 px, first frame only in a list (loops only in a person's own card, one at a time).

**The brokerage.** *Grows with you:* the window is the brokerage's stage, from the kitchen table to the floor
(`brk-stage1..4`, queued). Reaching a stage is a hero moment. The tender and the covered/fell-through scenes
(queued) are the result cards' pictures.

**What now?** *Iuliia leans in.* A sheet with her at 96 px (breathing), her line, and up to three choice cards; each
card carries a 64 × 36 crop of the screen it leads to (from that screen's window), so the choice reads as a place.
No hero art of its own.

**Iuliia's page.** *Her office.* Window: `guide` (exists). Her portrait at 128 px with the faces; her lines as a column
of dated notes on paper.

**The walkthrough.** *The road ahead.* The welcome hero (`welcome`, exists) on its first step; then a road strip
under the step card: mile markers, one per step (code), and the small loading rig (`loading/rig.loop`, exists) at
the current marker. A step done: the rig drives to the next marker (translateX, 600 ms, `--ease-out`) and the marker
lights. One Do at a time, as the bible says.

**Coming screens.**
- **The windows screens** (0.25.0, the director's note): the gate pass and the dock clock on the load sheet (above);
  the gate scene `shp-gate` (queued) as the window when a truck is checking in; a lost load's result card carries
  `shp-lost-closed` / `-refused` / `-gone` (queued) as its picture. The release-or-keep ask in Needs you is a dialog
  with no art. Deadlines are clock times and never tick.
- **Standing with a shipper:** *a plaque on the dispatcher's wall.* The card's top shows the band's plaque (queued
  `std` masters, 128 px at 64 px on the card), the tier numeral drawn in code on it, the line "Standing with Dallas
  shippers · Preferred, tier 5 of 10 · steady" beside it. A tier reached is a hero moment: the plaque at 128 px, the
  shine sweep once, Iuliia's line. A tier lost: no animation; the plaque shows its new tier and her line.
- **The Back Lot** (a later beta): *the same world after dark.* Its screens swap the Sunset tokens for **Night**:
  `--accent` sodium amber #ffb454, `--sun` cold neon #6fd6ff, backgrounds a step darker and bluer. Window
  `blt-nightlot` (queued). Until its day, its teaser card is as the bible says: "a later beta", nothing about crime,
  the night lot's still at 60% opacity, no loop.

---

## 4. Rules that keep it a game people can run a company in

1. **Figures are still while they matter.** No figure animates: no counting, rolling, typing, sliding or pulsing
   digits. A changed figure swaps in place; any highlight happens behind it or beside it. A figure's box has a fixed
   width (`min-width` in `ch`) so a new value never reflows its line.
2. **Nothing animates over a number being read.** Every figure sits on a solid surface (panel, paper or chip, ≥ 95%
   opaque), never on a backdrop. Accents (stamps, sparks, shines) land in corners and rims, clear of figures by at
   least 8 px; the spark's path avoids panels. Backdrops live only in windows and heroes.
3. **One accent at a time per screen.** Accents go through one queue (the "stage"). Priority: pay landing > bid result
   stamp > Iuliia's new line > tier or stage reached > a stamp on the player's own act > a gleam. A waiting accent
   older than 3 s is dropped (except pay landing, which always plays; its toast carries the news anyway). Ambient
   loops are not accents, but a screen runs at most **two** ambient loops at once (its window and Iuliia); a third
   (a portrait in a card) shows its first frame.
4. **Taps never move.** Nothing under a finger moves between touch and release, or for 500 ms after. Every image box
   is reserved before it loads (aspect-ratio). Lists never reorder or insert above what's on screen while a sheet is
   open: new items wait behind a pill. Buttons never translate or resize on press or when busy. Toasts and chips
   never land on the tab bar, a pinned action row, or a figure.
5. **Legible first.** Contrast ≥ 4.5:1 for all text and figures (§1.1), 15 px minimum for figures on a phone, Pixelify
   Sans never for a figure or a sentence longer than a heading.
6. **Decoration never blocks.** No animation delays an action: a tap acts at once and its animation follows. Nothing
   waits on art; every screen is complete with the art missing (CSS borders, the average colour in the window).

---

## 5. The budget

### 5.1 The two sites' limits, today

- **The test page (Pages, `dist/site`):** 798 files, 447 MB now; 383 MB of it is `cityviews`. Its builds stall.
  The menu system adds little to that; the cure for the stalls is the producer's open item (move or thin the city
  views), not this pass.
- **The live page (published artifact):** each binary ≤ 15 MB, a version ≤ 256 MB and 511 files; the page itself
  ≤ 16 MB (the scene stills are inlined in it today by `build.mjs`). Before publishing the menu pass, the producer
  lists the live version's files to check the room.

### 5.2 The menu system's budget

| Item | Size | Bytes (PNG, indexed ≤ 256 colours) | Files | Loads |
|---|---|---|---|---|
| **Kit atlas** `ui/kit.png` + `kit.json`: six frames (48 × 48 each), six button states (48 × 24), tab icons and lit frames (4 × 5 frames at 64 px), hour badges (4 at 64), stamp ring (128), small badges | ≤ 1024 × 1024 | ≤ 320 KB | 2 | with the title screen, before the first panel |
| **FX atlas** `ui/fx.png`: spark 8 × 32 px, dust 6 × 48, shine 8 × 64 | ≤ 512 × 256 | ≤ 60 KB | 1 | after the first panel paints |
| **A window's still** | 256 × 144 | ≤ 40 KB | 1 per scene per season | on the screen's first open |
| **A window's loop** | 16 frames as a 4 × 4 sheet, 1024 × 576 | ≤ 180 KB | 1 per scene per season | after its still, if Motion is Full and `navigator.connection.saveData` is not set |
| **A hero** | 512 × 288 still; loop 16 frames 2048 × 1152 only if under the cap | ≤ 120 KB still, ≤ 600 KB loop | 1–2 | on the moment, laptop and phone |
| **Iuliia's breathing loop** | 8 frames at 128 px, one row | ≤ 50 KB | 1 | with the kit |
| **Plaques, medallions** | 128 px | ≤ 15 KB each | in an atlas per family | on the screen's first open |

- **Per screen, first view:** ≤ 250 KB of new bytes (the window still, the screen's icons and plaques; the kit is
  cached). **Fully alive:** ≤ 700 KB (adding the loop and portraits).
  - **Amended 2026-11-14 (UX's picks, ux-menu-picks-2026-11-14.md; the producer):** the windows' stills ship in
    family atlases, not one file each, to fit the live page's file count. The first screen of a family loads its
    family's atlas, up to 700 KB, once; that family's other screens then add only their own icons and plaques
    (≤ 250 KB). The live pass adds 32 files (about 9 MB) and retires 39 (the old scenes' 27 season loops, whose
    seasons become stills in the season atlases, and the 12 files in icons/, folded into the kit and icon atlases),
    so the live version goes from 477 to 470 of its 511 files.
- **Decoded memory on a phone:** ≤ 40 MB of live bitmaps per screen. A 1024 × 576 loop sheet decodes to 2.4 MB. Keep
  the loops of at most two screens alive (the current and the last); drop the rest's references.
- **The whole menu system, new art only:** ≤ 16 MB on disk across all seasons and ≤ 90 files on the test site; on
  the live page ≤ 10 MB and ≤ 40 files (summer stills and loops for the first-hour screens, the kit and fx; the rest
  fall back to the CSS season tint and stills inlined like today's scenes). Atlases over single files wherever the
  pieces load together.
- **Lossless WebP** for loop sheets saves roughly a third and every target browser shows it; engineering's call. The
  budget above is in PNG so it holds either way.
- **The page stays near its size:** no new art inlined into the page except the six frames (≈ 30 KB as a small
  atlas), so the first panel has its rims before the kit arrives.

### 5.3 Lazy loading per screen

| When | What |
|---|---|
| The title | the kit atlas, Iuliia's breathing loop, the fonts |
| The first panel paints | the fx atlas; the current tab's window still |
| A screen's first open | its window still at once; its loop on idle (`requestIdleCallback`, 300 ms fallback); its plaques/medallions |
| On idle after the first minute | the stills (not loops) of the other three phone tabs' windows |
| A hero moment | its still with the moment; if not decoded within 400 ms, the moment plays on the window instead |
| Never pre-fetched | the Back Lot, brokerage stages beyond the current, report spots beyond the open section, seasons not in force |

### 5.4 Frame rate

- **The floor:** on a mid-range phone (reference: an iPhone 11 or SE 2022, a Pixel 6a or Galaxy A54), **no frame over
  33 ms** during a screen change, a sheet snap or a pay landing, and a median of 55 fps or better. No main-thread task
  over 50 ms while one plays.
- **How it holds:** loops step by CSS `background-position` at their own 8 fps (no per-frame JavaScript); motion is
  transform and opacity only; at most two ambient loops and one accent run at once; the map canvas stops its own
  animation while a full sheet or dialog covers it.
- **How QA checks it:** Chrome's performance panel at 6× CPU slowdown on the Mac Studio for every screen and every
  accent, and one pass on a real mid-range phone. A screen that misses the floor drops to Calm until fixed.

---

## 6. The art list for the art role (priority order)

Generation costs as measured: Pro 256 × 144 = 10, Pro 128 = 10, Pro 512 × 288 = 25, a 16-frame loop = 2, a VFX lite
≈ 1, a season edit = 25. Balance 5,743; the queue holds 4,453. Every Pro call keeps `title.png` as the style image.
Loops: 16 frames for scenes (shown at 8 fps, 2 s), 8 frames for accents (12 fps, played once), 4 frames for lit icons.
Small motions only in every loop; the sky, the light and the colours never change.

**P1 — the kit (every screen needs it; ≈ 230 with one retry each)**
1. Nine-slice frames, Pro 256 × 144 each, then cropped by the art role to a 48 × 48 tile with 12 px corners and a
   seamless 24 px edge, a flat interior: `frame-panel`, `frame-card`, `frame-dialog`, `frame-ticket` (queued) and new
   `frame-sheet` (a rounded top lip only) and `frame-paper` (cream paper with a painted clip). The rims: dark wood
   and teal enamel, rivets at the corners, a warm rim light on the top edge.
2. Buttons, Pro 256 × 144, cropped to 48 × 24 nine-slice: `button-primary` (teal enamel, apricot rim),
   `button-secondary` (plum), `button-danger` (brick) (queued), and new pressed states of each (the bevel inverted,
   one step darker; Pro with the rest state as the style image). New `toggle` on and off (128).
3. The tab bar: new `icon-more` at 128 in the style of `assets/icons`; a 4-frame lit loop for each of `fleet`,
   `loads`, `money`, `more` (2 each).
4. Hour badges, new, 128: `hour-dawn`, `hour-day`, `hour-dusk`, `hour-night` (a sun on the horizon, a high sun, the
   title's sunset, a moon over a road).
5. `stamp-ring`, new, 128: an empty round ink stamp, no letters, slightly uneven ink.
6. FX, new (VFX lite): `fx-spark` (a warm spark with a short trail, 8 frames, 32 px), `fx-dust` (stamp dust puff,
   6 frames, 48 px), `fx-shine` (a diagonal shine sweep, 8 frames, 64 px), all on transparency.
7. Iuliia, new: `iuliia-proud` and `iuliia-concerned` at 128 with `portrait.png` as the style image; `iuliia-breathe`,
   an 8-frame loop of the portrait (2).

**P2 — the first hour's windows (≈ 150)**
8. New `road-golden`, 256 × 144 + loop: the open interstate at golden hour, empty, no vehicles (the rig is laid over
   it), focal point low centre.
9. Move up from the queue, with their loops: `plan-restarea`, `plan-repair`, `plan-breakdown`, `plan-hometime`,
   `shp-detention`, `shp-docks`, `shp-factory`, `shp-coldstore`, `shp-dc`, `shp-produce`, `shp-steel`, `shp-lumber`.
10. For every window (existing and new) the art role records `focalX`, `focalY` and the average colour in the bank's
    manifest, so engineering's crop and placeholder need no guessing.

**P3 — money and moments (≈ 160)**
11. New `showroom-floor` 256 × 144 + loop: a dealer showroom stage under spotlights, empty (the rig is laid on it).
12. New `ledger-desk` 256 × 144 + loop: a ledger open under a desk lamp at dusk (the month report's cover).
13. From the queue: `mkt-keys`, `mkt-usedrow`, `mkt-loan`, `plan-hiring`, and one masthead of `masthead-s1..3`.

**P4 — the coming screens (≈ 260)**
14. Windows: `shp-gate`, `shp-lost-closed`, `shp-lost-refused`, `shp-lost-gone` (queued); new `dock-clock`, 128: a
    painted dock clock face with no hands and no numerals' text (plain tick marks), an amber lamp on its rim off;
    and the same with the lamp lit.
15. Standing: the three band masters (queued; pick one of each three). **Recommend:** draw the tier numerals in code
    on the band's plaque, and skip the thirty `tierNN-s1/-s2/-small` jobs (≈ 300 generations back for P1–P3 retries).
    The 48 px small plaque per band (3, not 10) stays.
16. Milestone medallions, new, 128: first load, first truck, first driver, first contract, first month in profit
    (5; shown at 64).

**P5 — after the above (as queued)**
17. The report spots (`report-*`, `spot-*`), the brokerage stages and scenes (`brk-*`), the 512 × 288 heroes for
    laptops.

**P6 — last**
18. The Back Lot (`blt-*`), a later beta.

**Season edits (`fill.jsonl`, 1,350):** recommend they wait until P1–P4 are in; until then the client tints seasons in
CSS as it does for the city views. If generations run short before the plan ends, the fill block is the first to cut.

---

## 7. For engineering, in build order (after 0.25.0)

1. The Sunset theme and the type (tokens only; a screenshot pass on every screen).
2. `data-motion` and the Motion setting; strip the infinite gleam, breathe, bob and twinkle.
3. The frames and buttons as `border-image` from the kit, with today's borders as the fallback.
4. The window component (crop, focal point, hour grade, placeholder, lazy loop) and the accent stage (queue, priority,
   drop after 3 s).
5. The money motion (§2.4) and the stamps (§2.3).
6. The per-screen windows (§3) as the art lands; heroes last.
7. QA's frame-rate pass (§5.4) and a phone playtest against rule 4.4 (taps never move).

## Open for the producer

- Fonts: Pixelify Sans for headings is a new web font (~25 KB). The alternative is Space Mono, which the page
  already loads. I recommend Pixelify Sans.
- The `std` tier jobs and the `fill` seasons: my recommendation in §6 reorders and cuts the art role's queue; that's
  the producer's call with the art role.
