# The next screens: standing, the shipper and broker rooms, the lot's end, the Back Lot (ux, 2026-11-15)

For the producer, engineering, the art role and the director (who reviews all of it; part 4 especially). The spec
it extends is `studio/specs/menu-system.md`; its picks are `ux-menu-picks-2026-11-14.md`. Phone first. Strings
here are drafts in the house voice; the writer owns them (a new `copy-standing.ts`, and so on). No new generations
exist: every picture below is in the bank already, or is a hand edit of one.

**Order:** Part 1 (standing) went to engineering first. Parts 2–4 follow in this note. The build order for all
four is §5, the live budget §6.

**Ruled (director, `director-sprint-2026-11-15.md` §7 and §8), amended in place:**
- §1.6, the tier moments: five heroes, each the first time anywhere, with the director's guards.
- §1.7, the badges: approved.
- Part 4: approved with four changes (its head lists them), and Channel 19 moves into the Back Lot.

---

## Part 1. Standing with a market's shippers

The rules are the director's (`studio/reviews/director-standing-final.md`, on top of `director-standing-10.md`):
- one scorecard per origin market, "Standing with Dallas shippers";
- a 180-day window, floors of 0/1/2/3/5/7/10/14/20/30 loads, and on time at 70% from tier 3 rising to 90% at tier 10;
- a claim, a no-show or a release costs two loads; a late delivery costs one;
- a weekly review moves at most one step; decay after eight weeks without a load;
- perks at 3 (dock priority), 5 (net-15), 7 (first call), 9 (contract offers), 10 (a dedicated lane);
- the bands Approved 1–4, Preferred 5–8, Core 9–10.

This part is where those show, and how. Nothing here changes a rule.

### 1.0 When it appears (the first hour stays clean)

Nothing of standing shows until the player's **first on-time direct delivery**: the first line, the director's
"Dallas shippers noticed…". From then on, standing has a row in More, cards, a line on the load sheet, and so on, as
below. A player who only hauls brokered loads never sees it. Standing isn't a layer, so it has no teaser: the row
simply isn't there before.

### 1.1 The scorecard card

One card per market where the player has a scorecard. The card frame is `frame-card`; the badge sits at the left;
the words are the director's.

```
┌───────────────────────────────────────────────┐
│ [badge 64]  Standing with Dallas shippers      │
│             Preferred · tier 5 of 10 · steady  │
│                                                │
│  Next: tier 6 at 7 loads, 76% on time.         │
│  You have 6 loads, 86%.        ▓▓▓▓▓▓░  6/7    │
│                                ▓▓▓▓▓▓▓  86/76% │
│  First call at tier 7.                         │
│  ─────────────────────────────────────────     │
│  86% on time over 180 days · 6 loads           │
│  (2 on contract) · 0 claims                    │
│  [amber chip, only when due: No Dallas load    │
│   in 7 weeks · drops a tier Tue]               │
└───────────────────────────────────────────────┘
```

- **Line 1:** "Standing with {market} shippers": the market's name, never a shipper's (the director's ruling).
- **Line 2:** band · "tier N of 10" · the trend word (rising / steady / slipping, from the last four reviews), in
  text with no arrow animation. Band words are coloured: Approved `--text-secondary`, Preferred `--accent`, Core
  `--sun`. At tier 10 the band reads "Core · dedicated" (the director's name, 11-15 §2).
- **"Next" block:** the next tier's two floors and the player's two figures, each with a static code bar (`.bar`),
  full when met. Both figures are in mono and both have explain keys (how the score is built, what moves it: the
  director's ask). At tier 10 the block reads "Top tier. Keep the floors: 30 loads, 90% on time." with the
  player's figures against them, because tier 10 can still fall.
- **The next-milestone line:** the next milestone at or above the next tier ("First call at tier 7."). It's absent
  at 10. (No string anywhere in standing says "unlock", "level up" or "achievement": the director's rule.)
- **The record line:** on time over the window · loads (on contract) · claims. These are the director's words.
- **The decay chip** shows from a week before decay (amber, steady, never blinking; rule 4.1). It disappears on
  the next load from that market.
- **A tap** opens the market's ladder sheet (§1.2).
- **Empty figures:** a market with 0 loads in the window still shows its card while its tier is above 1.
  At tier 1 with nothing in the window, the card drops out of the list. It comes back with the next load.

### 1.2 The ten-tier ladder (a sheet from the card)

The ladder sheet opens from a card. On a phone it's a full sheet; on a laptop, the rack panel.

```
┌ Standing with Dallas shippers ────────── × ┐
│ [window: shp-office, 72 px]                 │
│                                             │
│ CORE                                        │
│ 10  30 loads · 90%    A dedicated lane      │
│  9  20 loads · 87%    Contract offers       │
│ PREFERRED                                   │
│  8  14 loads · 84%                          │
│  7  10 loads · 81%    First call            │
│  6   7 loads · 76%          ← next          │
│  5   5 loads · 73%    Net-15    [badge 48] ←│ you
│ APPROVED                                    │
│  4   3 loads · 72%                          │
│  3   2 loads · 70%    Dock priority         │
│  2   1 load                                 │
│  1   —                                      │
│                                             │
│ How it moves: reviewed every Monday 06:00,  │
│ one tier at most. A late delivery costs     │
│ one load, a claim, no-show or release two.  │
│ Eight weeks without a load costs a tier.    │
└─────────────────────────────────────────────┘
```

(The floor figures in the drawing are placeholders. The real ones come from the config: the loads floors as
ruled, on time interpolated by the engine.)

- **Top to bottom, 10 to 1:** the ladder climbs the way a ladder does.
- **Rows:** 48 px tall, the whole row a tap target opening that tier's explain card. Each row reads
  tier · floors · perk, with the perk only on milestone rows.
- **Reached tiers:** the band's colour as a 3 px left rule, figures in `--text-primary`.
- **Tiers above:** `--text-secondary`.
- **The player's row:** the `card.sel` treatment (accent inset rule), the tier badge at 48 at its right, and "you"
  for screen readers.
- **The next tier:** an outlined row with "next" (no motion).
- **Band headings** (CORE, PREFERRED, APPROVED) are `.label` rows.
- **The foot:** the rules in four sentences (the review day and hour from the config).
- **Opening the sheet:** it scrolls so the player's row sits mid-screen. No animated climb, ever (rule 4.4: a
  ladder that moves under the finger moves taps).

### 1.3 Where standing lives

| Place | What shows |
|---|---|
| **More → Standing** (a new row, icon `standing`, already in `ui/icons.png`) | The **Standing screen**: the `shp-office` window (part 1's one new picture); the cards (§1.1), sorted by tier, highest first, then by the nearest next tier. Its header line: "Standing with shippers in {n} markets." |
| **Company** | The player's highest-tier card, alone, under the company's figures, with "All markets" → Standing. |
| **The city pane, Market tab** | One line for that market, when the player has a scorecard there: "[badge 24] Your standing here: Preferred, tier 5 of 10." Tapping it opens the ladder sheet. |
| **The load sheet** | §1.4. |
| **The board** | The first-call card (§1.5); the load cards gain nothing (they stay lean). |
| **Needs you** | A first call (§1.5); a decay a week away. |
| **Money** | The contract offer at tier 9 and the dedicated lane at 10 are offers in Money, as Iuliia's line says. Their cards carry the badge at 32. |
| **The month report** | A **Standing** section: every tier change that month with its cause ("Dallas: 6 → 5 after a no-show, Mon 12"), as the director asks. No section when nothing moved. |
| **The return card** ("While you were away") | A tier change while away is one line with the badge at 24. A hero owed (§1.6) adds "See it", which opens Standing and plays it; with a tier-1 item open, the line shows without "See it". |

### 1.4 On the load sheet and the bid

Only **direct and contract loads** build standing; brokered loads don't. The sheet says which, and what is at stake.
These are three lines, in the sheet's existing blocks; none moves, and none shows before §1.0's first line.

1. **Under the poster line** (direct or contract, at a market with a scorecard):
   "[badge 24] Counts toward your Dallas standing: Preferred, tier 5 of 10."
   For a direct load at a market with no scorecard yet: "Counts toward your standing with Dallas shippers."
   For a brokered load, once the player has any scorecard: "Brokered: it builds no standing with a shipper."
2. **In "What you're agreeing to"** (the windows block), the standing cost joins each claim line:
   - "Deliver by Thu 14:00, or it's late: claim 690 FD, a mark on your record, and one load off your Dallas standing."
   - "Pick up by Tue 20:00, or it's a no-show: claim 1,150 FD and two loads off your Dallas standing."
   - "Release it before Mon 20:00: 460 FD and two loads off your Dallas standing."
   Brokered loads keep today's lines.
3. **Perks in force** show where they act. Each is a plain chip, not a badge:
   - tier 3 and up: "Dock priority" on the sheet's dock line;
   - tier 5 and up: "Paid in 15 days (net-15)" on the pay block, where it now says 30.

**The bid:** standing doesn't price a bid, and the sheet doesn't pretend it does. The bid row is unchanged. After
the round, a **WON** result card for a direct load adds one line: "Delivered on time, it counts toward Dallas: 7
of 7 loads for tier 6." The figure is the player's count after this load. Nothing is added to LOST.

### 1.5 First call (tier 7 and up)

The shipper's direct load reaches the player a round before the board (only loads the truck can make, with a day
or more of life after the round: the rule).

- **On the board:** a pinned card above the list, before the bid-in card, on `frame-ticket` with the tier badge at
  32 in its top-left corner:
  ```
  [badge] FIRST CALL · Dallas shippers · answer by 18:00
          Dallas → Tulsa · 257 mi · 4,180 FD · pick up by Tue 20:00
          [ Book it ]   [ Pass ]
  ```
  - "Book it" opens the load sheet with the first call's terms. Its Book is the action.
  - "Pass" opens a Confirm: "Passing counts against your Dallas standing ({cost from the config}). Pass on this
    load?" The buttons are "Pass" (danger) and "Keep it".
  - A lapse counts the same as a pass. The card says so in its foot: "No answer by 18:00 counts as a pass."
- **Several first calls** stack, each its own card, soonest deadline first. They never push the board's list
  while it's on screen: they wait behind the new-loads pill like any new item (rule 4.4).
- **Needs you:** "First call from Dallas shippers · answer by 18:00", with the actions Open and Pass. It ranks with
  the other time-bound asks (the director's What now? ranking places it; I suggest just under a breakdown's
  release-or-keep).
- **No moment and no stamp** for a first call's arrival; the toast lane carries "First call from Dallas shippers"
  once. Booking it stamps BOOKED as any booking does.
- **Open question for engineering:** can a first call be bid on, or only booked at its rate? This spec assumes
  "only booked". If a bid is allowed, "Book it" becomes "Open", and the sheet keeps its bid row.

### 1.6 The tier-reached moments (ruled: director 2026-11-15 §8, which amends §2; §2's other guards stand)

**A hero is earned once in a company's life.** Each milestone tier gets a hero the first time the company reaches
it in any market. In a later market, or on climbing back after a fall, the same tier is a stamp. At most five
heroes ever.

| Tier reached (up) | The first time anywhere | Later markets, or back after a fall |
|---|---|---|
| 3 · dock priority | **hero** on `shp-appt-wall` (the dock appointment board) | stamp |
| 5 · Preferred, net-15 | **hero** on `bank` (existing scene) | stamp |
| 7 · first call | **hero** on `shp-office` (the shipper's traffic office) | stamp |
| 9 · Core, contract offers | **hero** on `brk-ratecon` (a contract signed) | stamp |
| 10 · Core · dedicated, a lane | **hero** on the market's own live city view (CityPicture: the painted hub at the hour and the weather) | stamp |
| 2, 4, 6, 8 | toast: "[badge 32] Dallas standing: tier 6 of 10." | toast |

**"The first time anywhere," for engineering:** a hero plays only when the new tier is a milestone and higher than
the best tier the company has ever held in any market. That takes one figure per company, its best tier ever. It
never goes down. The owed hero is kept in the engine's company record, not in the client, so a reload or a second
device never replays it and a missed one is never lost. Seeing it clears it.

**The hero** is spec §1.3's hero frame. It runs, in order (one accent):
1. the painting fades in, dimmed 40%;
2. the new tier's badge sits at 128, centre-top;
3. the fx glint plays once at the badge's corner;
4. under it, on `frame-paper`: "Standing with Dallas shippers · Preferred · tier 5 of 10", then the perk in one line
   with its figure (below), then Iuliia's line at 32 px with her proud face;
5. one button: "OK", plus "See the ladder" for the sheet.

**The stamp** is a toast: the badge at 32, "Dallas standing: Preferred, tier 5 of 10", the perk in one line (with
its figure), and Iuliia's line in her 32 px strip. It has no painting and no glint. A stamp is the mark on a
scorecard, not a trophy.

**Every hero and stamp says what changed, in figures, from the player's own books** (§2's guard). The figure comes
from the scorecard or the ledger. If the engine has no figure for a perk, the line names the perk alone, never an
estimate. The writer drafts; these show the shape:
- 3: "Your trucks go to the front of the line at Dallas docks." Add the dock hours Dallas cost the player last
  month, if the engine counts them by market.
- 5: "Your Dallas invoices now pay in 15 days, not 30. On last month's loads that's 6,200 FD two weeks sooner." (The
  director's line.)
- 7: "Dallas shippers will call you first, a round before the board. You hauled 10 of their loads to get here."
- 9: "Dallas shippers will offer you contracts. 20 loads, 87% on time, brought you here."
- 10: "A lane of your own out of Dallas." Add the lane's name, if the engine names it at the offer.

**When a moment shows:**
- **One hero per review at most.** If a weekly review moves several markets, the hero goes to the highest tier that
  is a first. Everything else in that review is one toast:
  - with one other change, that change's own toast or stamp;
  - with more, "Standing moved in 3 markets", which taps to Standing.
- **Present at the review:** the hero plays when no sheet or Confirm is open. It never covers an open load sheet or
  bid.
- **Missed while away:** the hero plays once, the next time the player opens Standing or the card in Company. The
  return card also gets one line with "See it" (§1.3). It is never queued into the title or the first screen.
- **Never over trouble:** while a tier-1 item is open (a payment about to miss, a repossession), an owed hero waits.
  It plays at the first chance after the item closes, by the rules above. Stamps and toasts aren't held.
- **A step down** (as UX specified; the director's §8 adopts it). A fall is never a moment:
  - no hero, no glint, no red flash; the badge swaps;
  - **a lost milestone** is a plain notice with its cause, and Iuliia's falling line with her concerned face. It
    goes in the return card if it happened while the player was away;
  - **a fall between milestones** is a toast with its cause: "Dallas standing: tier 6 of 10, after a late
    delivery."
  - The cause always shows, in words. Every fall also goes in the month report's Standing section (§1.3).
- **Reduced motion (Calm, Still):** the hero shows without the fade and the glint, as the spec's §2.6 says.

**How the names feel** (the director's words, for the writer). The voice is the market's, through Iuliia, never the
game's:
- **Approved (1–4):** you're on the list. Plain, matter-of-fact; a door open, nothing more.
- **Preferred (5–8):** they know your name. Warmer: the first sign of a relationship.
- **Core (9):** they plan around you. Weight and trust.
- **Core · dedicated (10):** a lane that's yours. A partnership, said quietly.
- **Within a band,** a step is a notch, "tier 6 of 10", with no name of its own.

### 1.7 The tier badges (art, by hand from the existing three; approved, director 2026-11-15 §8)

**Shipped in bb2469f** (set 1, with set 2's tier 10 for its halo: §7 call 1). The director's conditions, all met:
no digit on any badge, marks lit in order, and the tier always in words beside it.

Ten badges, one per tier, at 128 × 128 on transparency. They are made from the three band masters already in
`ui/badges.png` (`std/master-approved.png`, `master-preferred.png`, `master-core.png`), keeping each master's
canvas position. **No digit is painted on any badge:** the tier is always said in words beside it (rule 4.1). On the
badge, a band's tiers read as marks lit in order:

| Tiers | Base | Marks (hand edit) |
|---|---|---|
| 1–4, Approved | the steel shield | four brass studs in a row on the plate under the grille. Tier N has N polished (bright brass, a highlight pixel), the rest dull steel sockets |
| 5–8, Preferred | the silver winged shield | the blue band's five stars repainted as **four** evenly spaced. Tier N has N − 4 lit (white), the rest navy outlines |
| 9–10, Core | the gold laurel plaque | the five top stars repainted as **two** larger stars. Tier 9 has one lit (white-gold), tier 10 both |

- **Every mark at least 10 px across at 128,** with at least 4 px between marks, so the count reads at 48 CSS. Unlit
  marks stay visible (dimmed, never removed), so the band's length shows.
- **Shown at:** 24 (inline lines: the marks don't need to read there, the words do); 32 (cards, toasts); 48 (the
  ladder); 64 (the scorecard); 128 (the moment).
- **Shipping:** they replace the three masters' cells in `ui/badges.png`. The atlas becomes 15 cells: ten tiers and
  the five medals, 1024 × 256. It stays one file. `kit.json` names them `tier-1` … `tier-10`.
- **Until the art lands** (engineering's placeholder): the band master at the given size, with a code row of N
  small dots (4 px, `--text-secondary` dim, `--sun` lit) under it, counting the tier within the band.

### 1.8 Strings to the writer (new; the director's words kept as written)

- The More row "Standing" and the screen's header line.
- The card's "Next…", "You have…", "Top tier. Keep the floors…" and next-milestone lines, and the decay chip.
- The band names as the director has them, "Core · dedicated" at 10 included. The voice is §1.6's "How the names
  feel". No "unlock", "level up" or "achievement" anywhere.
- The ladder's foot (the four rules sentences).
- The load-sheet lines: counts toward / brokered / the three claim lines with standing / the two perk chips.
- WON's extra line.
- First call: the card, its foot line, Pass's Confirm, the Needs you line, the toast.
- The moments:
  - the hero's paper lines, and the five perk lines with their figures (§1.6);
  - the stamp, Iuliia's five milestone lines, and the "Back to Preferred in Dallas" form for a climb back;
  - the toast for 2/4/6/8 and "Standing moved in {n} markets";
  - the lost-milestone notice with Iuliia's falling line, and the step-down toast;
  - the return card's line and "See it".
- The month report's Standing section and its row.
- The city pane's line.

### 1.9 Art and budget for part 1

| Piece | Bank file | Ships in | Live? |
|---|---|---|---|
| Standing window | `shp/shp-office.png` (+ its `-dusk`, `-night` where banked) | `windows/rooms.png` (§6), its variants in `windows/after-dark.png` | live |
| 3's hero | `shp/shp-appt-wall.png` | `windows/rooms.png` | live |
| 9's hero | `brk/brk-ratecon.png` (+ `-night`) | `windows/rooms.png` | live |
| 5's and 10's heroes | `bank` (existing), the city views (existing) | — | live already |
| tier badges ×10 | hand edits of `std/master-*.png` | `ui/badges.png` (same file, 1024 × 256) | live |
| `shp-office` loop | `shp/shp-office-loop` if banked and it passes the gate | `windows/shp-office.loop.png` | test only |

A window is looked up by name across the base families that `menuart.ts` lists (`BASE_FAMILIES`). Engineering
adds the new families of §6 to that list: `rooms`, `lot`, `report`, and `after-dark`, which holds the new dusk
and night cells, to the night and dusk lookups. The three stills therefore sit in `rooms.png`, not `screens.png` as
my first message to engineering said. `screens.png` stays at its 18 cells and under its cap.
**Live files for part 1: 0**: it rides on part 2's `rooms.png`.

---

## Part 2. The broker's and the shipper's rooms, and the report's pictures

Two kinds of use, and the spec keeps them apart:
- **Windows:** a screen's standing picture. They change with the hour (dusk and night variants) and carry loops.
- **Moments:** a picture that marks one event: a result card's picture, a Confirm's window, a hero. Moments use
  the base painting with the hour grade only, since an event's picture needn't change with the reader's hour. That
  keeps the dusk and night stills to the windows (§6).

### 2.1 The brokerage (the player's second company)

What exists today (`screenwindows.ts`): the Brokerage tab shows its stage (kitchen → floor), Book shows `brk-board`,
Carriers shows `brk-handshake-carrier`. Added:

| Where | Picture | Kind | Bank |
|---|---|---|---|
| **Book, at night** | `brk-headset` (the broker on a headset at the board after dark) | window, night variant of Book | `brk/brk-headset.png` (+ `-dusk`, `-night`) |
| **Book, while a shipper's tender waits for an answer** | `brk-tender` (the tender arrives) | window, by state, as the truck card does | `brk/brk-tender.png` |
| **The tender sheet** (`TenderSheet`: tender a load to a carrier) | `brk-phone` (the broker on the phone) | the sheet's 72 px window | `brk/brk-phone.png` |
| **A tender's result: covered** | `brk-covered` | the result card's picture (the lost-load cards' pattern), with the stamp **COVERED** (new word) | `brk/brk-covered.png` |
| **A tender's result: the carrier fell through** | `brk-fellthrough` | the result card's picture, with no stamp; the line says what is left to do ("Re-tender before 18:00 or it's lost") | `brk/brk-fellthrough.png` |
| **A brokerage founded** | `brk-handshake-dock` (broker and shipper at the dock) | hero, once, after "Start a brokerage" | `brk/brk-handshake-dock.png` |
| **A stage reached** (kitchen → office → room → floor) | the new stage's painting | hero, once per stage (the menu system §1.3 already lists it) | already in `screens.png` |
| **The owner's office** | `brk-corner-office` | Company's window (unchanged) | — |
| **A contract signed** | `brk-ratecon` | standing tier 9's hero (part 1); also the hero when a brokerage's shipper contract is signed, if the engine has one (engineering confirms) | `brk/brk-ratecon.png` |

Rules:
- One accent at a time, as everywhere. A covered tender's stamp is the accent; the picture just appears.
- The broker's results never show on the carrier's screens. The company switch decides whose results the toast
  lane carries, as it does today.

### 2.2 The player as shipper (facilities)

A player who owns facilities (warehouse, cold storage, factory: `FacilityType`) posts freight as a shipper. Today
facilities are opened from the Dealer and listed in Business's sales card and Intel. Added:

- **Business gains a "Shipping" section** (when the player owns a facility). Its window is the shipper's stage, by
  how many facilities the player owns: 1 `shp-own-1` (a workshop), 2–3 `shp-own-2` (a small plant), 4–7
  `shp-own-3` (a plant with its own docks), 8 and up `shp-own-4` (a campus with its own DC). The thresholds are
  display only, tuned by the producer, like the brokerage's stages (`STAGE_LOADS`). Reaching stages 2–4 is a hero,
  once each, as the brokerage's are.
- **Each facility a card** (the facility's figures as engineering has them: output, upkeep, the freight it posted).
  A tap opens its sheet, whose window is the facility's inside by type: warehouse `shp-warehouse`, cold storage
  `shp-coldstore-in`, factory `shp-factory-floor`.
- **The facility's freight on the board** shows the player's company as the poster, as any shipper's does. There is
  no picture on the card.

### 2.3 The truck card, unloading (a change to the menu system's truck windows)

Today loading and unloading both show `dock` (outside). Inside the receiver is truer for unloading, and it uses the
four interiors. The window goes by the load's kind, with the same pattern as the load sheet's `FACILITY` table:

| The load's kind (the `FACILITY` group) | Unloading window |
|---|---|
| frozen and cold, fresh produce | `shp-coldstore-in` |
| retail, and dry and general | `shp-dc-in` |
| manufactured, metal, building materials | `shp-factory-floor` |
| anything unmapped | `shp-warehouse` |

Loading stays `dock`; waiting for a load to be ready stays `shp-detention`. The interiors paint no truck of ours,
so the rig doesn't lie over them (rig: false).

### 2.4 The published monthly report (Intel → the report)

`EconomyReport` is the paper everyone reads, under the masthead (already live). The bank has nine section photos
(`mkt/report-*.png`) and nine spot icons (`mkt/ui/spot-*.png`).

- **Each section heading carries its spot** at 32 px, left of the heading:

  | Section | Spot |
  |---|---|
  | Freight | `spot-rates` |
  | Trucks | `spot-capacity` |
  | Companies | `spot-lanes` |
  | Work | `spot-people` |
  | Money | `spot-settlement` |
  | Wealth | `spot-demand` |
  | Announced | `spot-outlook` |

- **The lead photo:** one photo under the masthead, the month's story, chosen by a plain rule (engineering, from
  figures the report already has):
  1. the first month of a season → `report-seasons`;
  2. otherwise the fuel price moved 5% or more in the month → `report-fuel`;
  3. otherwise posted loads moved 10% or more → `report-demand`;
  4. otherwise → `report-rates`.

  Its caption is one line in the paper's voice (the writer), naming the story ("Fuel up 6% in March").
- **Section photos, laptop only** (two-column paper): Freight `report-rates` (unless it's the lead), Trucks
  `report-capacity`, Companies `report-lanes`, Work `report-people`, Money `report-settlement`, Announced
  `report-outlook`. On a phone only the lead photo shows: the paper stays a quick read on a small screen.
- **Photos are prints:** no hour grade, no loops. A newspaper photo doesn't change with the reader's hour. The
  frame is `frame-paper`'s 1 px ink rule around each.
- Nothing animates on the paper (the menu system §3).

### 2.5 Strings to the writer

- The COVERED stamp; the fell-through line.
- The founding hero's paper lines.
- Business's "Shipping" section head and its stage names (workshop, small plant, plant with docks, campus).
- The lead photo's captions (four story kinds).

### 2.6 Art and budget for part 2

| Piece | Bank | Ships in | Live? |
|---|---|---|---|
| `brk-tender`, `brk-covered`, `brk-fellthrough`, `brk-phone`, `brk-headset`, `brk-handshake-dock`, `shp-own-1`…`4` | `brk/`, `shp/` | `windows/rooms.png` | live |
| `brk-headset`, `shp-own-1`…`4`: `-dusk`, `-night` | the same | `windows/after-dark.png` | live |
| `shp-warehouse`, `shp-factory-floor`, `shp-coldstore-in`, `shp-dc-in` | `shp/` | `windows/shp.png` (re-packed, 14 cells) | live |
| the four interiors' `-dusk`, `-night` | the same | `windows/after-dark.png` | live |
| `report-*` ×9 | `mkt/report-*.png` | `windows/report.png` (new) | live |
| `spot-*` ×9 | `mkt/ui/spot-*.png` | `ui/icons.png` (re-packed, 96 px cells) | live |
| the loops of all of the above that pass the gate (`brk-handshake-dock` r1, `report-settlement` r1) | `*-loop*.loop.png` | `windows/<id>.loop.png` | test only (the report's photos never loop, so their loops don't ship) |

---

## Part 3. The lot's end: trade-in, scrapyard, repossession, clearing (and the early delivery)

Each of these is a **moment** of a decision or an event that already exists in the game; none gets a screen of its
own. The pictures go where the player meets the decision.

### 3.1 The trade-in (`mkt-tradein`)

The Yard's truck row has "Trade in · 48,200 FD" (`trade_in`, the best dealership's offer). It acts at once today,
with no Confirm.
- **Fix:** a trade-in can't be undone, so it gets a Confirm, as Scrap has. The house rule is a Confirm before
  every irreversible act.
- **The Confirm's window:** `mkt-tradein` at 72 px (a Confirm may carry a window when its act is a place's
  business: the trade-in, the scrapyard and the early delivery, in this pass). The Confirm's lines: what the truck
  is worth, the offer, the dealership and its town, and what happens to its trailer and load (the engine's rules).
- **After:** the pay-landing motion (the menu system §2.4), since cash comes in. The toast is "Traded in: Truck 2 ·
  +48,200 FD · Dallas Truck Center". There is no hero: a truck leaving is a decision, not a celebration.

### 3.2 The scrapyard (`mkt-scrapyard`)

Scrap a tractor or a trailer (the Yard; a danger Confirm exists).
- **The Confirm's window:** `mkt-scrapyard` at 72 px; the season's still where it has one (it has all three).
- **After:** a small pay landing ("Scrapped: Truck 2 · +3,100 FD"). There is no hero, and the laptop's
  `mkt-scrapyard-hero` isn't shipped.

### 3.3 Repossession (`mkt-repo`)

Missed payments past `missedPaymentsToRepossess` and Equipment Finance takes the truck to sell it.
- **Before** (the warning): Needs you already carries the missed-payment ask. The Finance loan card in arrears
  gains one amber line, "One more missed payment and Equipment Finance takes Truck 2". There is no picture, and the
  line is steady, not flashing.
- **The event:** a serious sheet, not a hero:
  - `mkt-repo` at full width;
  - the facts on `frame-paper`: "Equipment Finance repossessed Truck 2 on Tue 12 after 3 missed payments. It goes to
    the used lot; what it sells for pays the loan, and anything over comes to you.";
  - the buttons "OK" and "See the loan".
  - It always plays in Calm motion, whatever the setting: fade only, no glint, no stamp. Iuliia's concerned face is
    at 32 with her line (the writer's).
  - If it happened while the player was away, the return card carries one line and the sheet shows at the next
    open of Money.
- **When it sells:** Money's ledger rows carry it as they do any posting. There is no second moment.
- **In the used row:** a repossession listing (seller 0) carries a chip, "Repossession · Equipment Finance". The
  card gets no picture, since cards stay lean.

### 3.4 The clearing house (`mkt-clearing`): the settlement fee

The fee (1% of a delivery's pay) is live and shows as the cost chip (`−41 FD · settlement fee`). A tap goes to Money's
rows; each fee row has an explain key.
- **The settlement fee's explain card** carries `mkt-clearing` as a 72 px window at its top: where the 1% goes,
  shown as a place. On the laptop's explain card, the same 72 px. This is the only explain card with a picture in
  this pass, so engineering's explain component gains an optional window.
- No burn imagery anywhere (the art's own brief).

### 3.5 The early delivery at the factory (`mkt-early`)

Expedite (`assets.expedite`, live): an ordered truck brought forward from the factory for a fee, from the Dealer's
order row.
- **The Confirm's window:** `mkt-early` at 72 px (seasons as banked).
- **When the truck arrives,** the existing "a hero for any new owned truck" (batch M1) shows, unchanged.

### 3.6 Strings to the writer

- Trade-in's Confirm lines.
- The trade-in and scrap toasts.
- The arrears line.
- The repossession sheet's lines and Iuliia's line.
- The repossession chip.

### 3.7 Art and budget for part 3

| Piece | Bank | Ships in | Live? |
|---|---|---|---|
| `mkt-tradein`, `mkt-scrapyard`, `mkt-repo`, `mkt-clearing`, `mkt-early` | `mkt/` | `windows/lot.png` (new, 5 cells) | live |
| the seasons of `mkt-tradein`, `mkt-scrapyard`, `mkt-early` | `mkt/*-{autumn,winter,spring}.png` | `windows/autumn.png`, `winter.png`, `spring.png` (re-packed) | live |
| their loops (`mkt-repo` r2, the others if they pass) | | `windows/<id>.loop.png` | test only |
| heroes `mkt-repo-hero`, `mkt-scrapyard-hero`, `mkt-clearing-hero` | | — | not shipped (none of these is a hero moment) |

---

## Part 4. The Back Lot

Kept out of the public repo with the rest of the bad-actor design (the shared notes folder holds it; the director approved it with four changes on 2026-11-15).

## 5. Build order for engineering

1. **Standing (part 1):** now, behind its switch, against the placeholders (§1.7).
2. **The art drop** (the art role re-packs; engineering wires it):
   - add the families `rooms`, `lot`, `report`, `after-dark` to `menuart.ts`;
   - add `after-dark` to the night and dusk lookups;
   - add the tier badges to `badges.png`.
   It's data, plus a small change to the lookups.
3. **Part 3:**
   - the trade-in's new Confirm (a fix, so first);
   - the Confirm's optional window (trade-in, scrap, early);
   - the repossession sheet and the arrears line;
   - the settlement explain card's window.
4. **Part 2:**
   - the brokerage's windows by state and night, the tender sheet's window, the result pictures, the COVERED
     stamp, the founding hero;
   - Business's Shipping section and the facility sheets;
   - the truck card's unloading interiors;
   - the report's spots, lead photo and laptop photos.
5. **Part 4, §4.2, live-relevant now (approved):**
   - the theft notice as a Needs-you and return card, tier 2, carrying the place;
   - `blt-hit-shoulder` as its shoulder picture, and text at a rest area or truck stop until the aftermath edits
     land;
   - Iuliia's next step, by §4.2's order;
   - the atNight line in `pickWindow` (already asked for).
6. **Part 4, §4.1 and the switch-on half of §4.2 (approved), behind `robbery.lot`, test site only:**
   - the Back Lot screen, with Channel 19 moved in from the Logbook;
   - the three files loaded only with the switch on (rule 8);
   - the `backlot` family's own dusk lookup;
   - the Security row and the yard's rows;
   - the engine's two notice fixes: the hirer's results go to the lot's feed (rule 3), and the victim gets the
     theft notice only, never the Channel 19 line (§4.1).
   No Part 4 string goes in before the director has seen it (rule 9).

## 6. The live budget

| | Files | About |
|---|---|---|
| Live today | 465 of 511 | — |
| `windows/rooms.png` (13 cells: shp-office, shp-appt-wall, brk-ratecon, brk-tender, brk-covered, brk-fellthrough, brk-phone, brk-headset, brk-handshake-dock, shp-own-1…4) | +1 | 340 KB |
| `windows/lot.png` (5 cells) | +1 | 160 KB |
| `windows/report.png` (9 cells) | +1 | 280 KB |
| `windows/after-dark.png` (the dusk and night stills of the new *windows* only: shp-office, brk-headset, shp-own-1…4, the four interiors; about 22 cells) | +1 | ≤ 800 KB |
| re-packs: `shp.png` (+4), `screens.png` (+1, `blt-logbook`), `truck.png` (+1 `blt-hit-shoulder` now, +2 aftermath edits later), the three season atlases (+3 each), `badges.png` (+10 tiers), `icons.png` (+9 spots, +3 security); `heroes.png` unchanged (no Back Lot hero, §4.4) | 0 | +≈ 600 KB |
| **Live after parts 1–3 (and 4.2)** | **469 of 511, 42 spare** | **≈ +2.2 MB** |
| The Back Lot's day (its three files: `windows/backlot.png`, `ui/backlot.png`, `ui/backlot-people.png`) | 472 of 511, 39 spare | ≈ +1.1 MB |

No new loop goes live: every new loop is test-only, so live stays well clear of 511. The test site gains about 35
loops (≤ 180 KB each, about 6 MB) and the four new atlases.

---

## 7. The art sprint's three calls (ux, 2026-11-15, answering `art-sprint-2026-11-15.md`)

**1. The tier badges: set 1, with set 2's tier 10.** The bible wants three bands so ten steps read at a glance, and
set 1 keeps exactly three metals. Set 2 changes the metal at every tier:
- Its tier 1 is a dark brown iron, the badge every new company starts with, and it reads as rust on our dark
  panels.
- Its tier 4 takes a gilded edge, which borrows Core's gold one band early.
- At 32 px, where the marks no longer count, set 2's within-band steps don't read either. Its 5–8 silver-to-platinum
  steps are barely visible even at 128.

The one place a change of silhouette earns its keep is the top: tier 10's halo of rays tells it from tier 9 at 32 px,
where the two stars can't. So ship `tier-1` … `tier-9` from set 1 and `tier-10` from set 2. (Approved by the
director, 11-15 §8, and shipped in bb2469f.)

**2. The 25 dusk stand-ins.** Dusk stills are for *windows* only (§2): a moment uses its base painting with the hour
grade.
- **Ship 7, live, in `windows/dusk.png`** (cells named by the painting's id, so today's dusk lookup finds them with
  no code change): `plan-breakdown`, `plan-hiring`, `plan-hometime`, `plan-skyline`, `bg-iuliia-s2`,
  `road-golden`, `ledger-desk`. That takes `dusk.png` from 373 KB to about 580 KB, under its cap.
- **Hold 3** in the bank and pack them with the Back Lot, in its own atlas: `blt-chop-out`, `blt-fence`,
  `blt-bountyboard`.
- **Cut 7:** `bg-dealer-s1`, `bg-dealer-s2` and `bg-iuliia-s1` aren't shipped at all; `blt-stash`,
  `blt-hit-truckstop`, `blt-hit-shoulder` and `blt-recovered` are moments, or unshipped.
- **The 8 night paintings: agreed, the base serves as its own dusk, and its own night too.**
  - **Implementation:** no duplicate cells. Instead, a flag on the painting's `kit.json` cell, `atNight: true`, which
    `pickWindow` reads as "no hour grade at dusk or night" (today a night painting with no night cell gets the night
    grade on top, which makes it too dark).
  - **Where it matters now:** `bg-board-s2` (the board's night window, live), `showroom-floor` (live), and
    `blt-logbook` (live with this drop). Then `blt-nightlot`, `blt-hit-reststop`, `blt-arrest` and `blt-chop-in`
    when they ship. `bg-board-s1` isn't shipped.
  - **The split:** the art role writes the flags; engineering adds the one line in `menuart.ts`.
- **The +4 cells offered for `after-dark`** (`brk-ratecon`'s and `shp-appt-wall`'s dusk and night): not needed. Both
  are moments (standing's heroes), so they keep the base with the grade.

**3. Placement: confirmed.** `shp-office`, `shp-appt-wall` and `brk-ratecon` go in `rooms.png`, as §6 has it and as
the corrected §1.9 says. `screens.png` and `night.png` stay unchanged.

**Path changes accepted (art, 2026-11-15):**
- The Back Lot faces' atlas ships as `ui/backlot-people.png`, not `people/backlot.png`, because `build.mjs`'s people
  rule drops other names.
- Face loops ship as `people/<id>.loop.png`.
- These loops failed the gate and ship as stills:
  - the report's: fuel, capacity, seasons, settlement (they never loop anyway, §2.4);
  - the Back Lot's: stash, fence, bountyboard, chop-out, nightlot;
  - the faces': robber-5, robber-7, blt-biz-2, blt-biz-5;
  - and shp-appt-wall, brk-fellthrough, shp-own-2, mkt-clearing, mkt-early.
