# The first ten minutes (UX spec, draft 2, 2026-11-02; owner: UX)

Draft 2 rewrites a temporary agent's draft 1 after two sessions of my own (`reviews/ux-first-look.md`). No rule
moves here. Quoted strings are placeholders the writer owns (`specs/copy-audit.md` wins); `{}` numbers come from
config; other figures are one example load.

## Part one: the screens as they stand

Shell: a sticky top bar of up to twelve items (246 px of an 812 px phone), a map, thirteen tabs, the walkthrough
over every panel, a ticker, a toast.

| Tab | Holds | Who needs it: one truck / five / twenty | Fate |
|---|---|---|---|
| Fleet | alerts, tenders, a card per truck, the yard, the eight-rule dispatcher | truck card / alerts / same | **Fleet** |
| Loads | six-field search, ten-column table, load detail | every sitting / same / the dispatcher's | **Loads** |
| Staff | four hiring tables | nothing / drivers / all | section of Fleet, from its trigger |
| Dealer | used lot, showroom, facilities | used lot ~day 35 / trailers / facilities | section of Fleet, from step 9 |
| Money | cash, exchange, airdrop, auction, loans and deposits | cash, owed / loans / all | **Money**, token removed |
| Finance | stake, getting paid, pools, credit | getting paid / stake / all | folded into Money |
| Business | yard mods, shops, truck stops | nothing / the yard / all | section of Company from day 28 |
| Logbook | airdrop milestones, ladder, Channel 19 | nothing | waits for the token layer |
| Back Lot | a locked teaser | nothing | out of the client; the roadmap page |
| Rates | market table, 61 rows | day 3 on / the dispatcher's | "Rates by hub", a sub-screen of Loads |
| Economy | faucets, sinks, supply | the economy designer | out; the Monthly Economic Report |
| Company | stats, safety, contracts, insurance, players | day 35 / insurance / all | **Company** |
| Guide | fifty pages | when stuck | "Help", inside **Iuliia** |

Seen in two stranger sessions: the dispatcher moved the truck within ninety seconds and ticked four walkthrough
steps, but not my own bid; on a phone the first screen is 576 px wide, the first load 1,688 px down, the map
behind "⤡ Restore" and blank for 1–3 s, and a city pane never opened; a lost bid is told only in the ticker, 6,876
px down; the green button on a losing load is "Book now"; at 1366–1440 px the tab labels overprint.

## Part two: the proposal

Principles: the map is the world, the panel one card; five tabs; every order leaves a mark where it was given;
the walkthrough ticks only on the player's own orders (`walkthrough.ts` reads the player's act log, not the world).

### Layout

**Phone (< 900 px).** Draft 1 said 1100; a 1024 px laptop is a laptop.
- **Top strip, 44 px, fixed:** clock ("Tue 06:00"), cash ("4,700 FD"), an alert dot with a count (taps to
  Fleet's "Needs you"), "≡". Test build adds one speed button cycling "Paused · 1× · 10× · 30×".
- **"≡" menu:** "Title screen", "Full screen", "Report a bug or an idea".
- **Bottom nav, 56 px, fixed, five items, icon over label:** **Fleet · Loads · Money · Company · Iuliia**, the
  bible's five. A dot on an item when something waits there (Loads: a bid result; Money: an invoice; Fleet: an
  alert; Iuliia: a new step).
- **Sheet** over a full-screen map: strip (88 px: one state line, e.g. "Truck 1 · Idle at Dallas · round 18:00"),
  half (50 %), full (to the top strip). Drag handle; a nav tap opens half, Loads opens full; tapping the map
  drops the sheet to strip.

**Laptop (≥ 900 px).** One 44 px top row (the strip's items, four test-speed buttons). Map left; a 420 px
panel right, the five as a segmented control (84 px each, never truncated), Iuliia's caption under it. The
footer ticker stays, laptop only.

**Cut from the chrome:** the theme picker (one theme, `cyber-ops`), Miles and "Beta · launch in 730d", the
legend, both Expand buttons, the rack's Report, the locks.

**Iuliia's caption** (both layouts): 32 px portrait, the current step's Do line, "More" opens the Iuliia tab.
On a phone it is the sheet's first line, never between the header and a list.

### S0 Title (0:00–0:40)
Contents: the title loop; "Company name" (default "Lone Star Freight", 32 chars); three hub cards; **Start
hauling**. Each card: hub name, one freight line, one carriers line ("Dallas · freight even · a fair share of
carriers"). The table, its caption and the beta line go; "How you start" stays, test build only. The five
connection cards stay, reworded.

### S1 Arrival (0:40–1:30)
The map flies from the country to the home hub in 1.5 s (none under reduced motion), to a zoom where the hub
label, its roads and the cyan sprite labelled "You" read. AI carriers at 35 % opacity; players full. Sheet at
half: Iuliia's step 1 Do, rewritten as "This is Dallas, your home. Let's find a load.", and **Show me the
board**. Step 1 ticks on that tap.
States: map not drawn yet → the hub's painting with "Finding Dallas…" until the first frame.

### S2 Loads (1:30–4:00)
Header: "Loads from Dallas · 14 · next round 18:00 (in 5 h)". A truck selector only from two trucks.
**Card** (88 px, the whole card a target):
- line 1: "Dallas, TX → Charlotte, NC · 1,085 mi"
- line 2: "2,010 FD · 1.85/mi · 0 mi empty"
- chip: green "+180 FD at book-now", or red "−245 FD at book-now" followed by grey "+338 FD at 2.39"
  (profit at the suggested bid, `suggest` in `Loads.tsx`).

Sort control, three segments: "Nearest" (default) · "Best pay" · "Deliver by". First visit only: loads with
profit at book-now ≥ 0 first. Loads the company can't take go last, dimmed, one chip with the reason from
`vettingBlock` ("Needs 30-day authority · day 1").
**Filter** button opens: Destination (hub list, "Anywhere"), "Empty miles, max" (slider 0–`{MANUAL_BID_MAX_DEADHEAD_MI}`,
default 300), "Commodity or place". Footer link: "Rates by hub".
Laptop: the same cards; a "Table" toggle keeps today's DAT table for dispatchers who want it.
States: truck busy → "Your truck is on the road · loads show when it's free · ETA Jan 7 02:36". Nothing within
range → "Nothing for a dry van within 300 mi of Dallas this round · next round 18:00" and **Widen the search**
(clears Destination and the query). A bid in → that card pinned first in its bid state (S4).

### S3 Load (4:00–5:30)
Full sheet (laptop: the panel), back arrow "Loads". The map draws the empty leg dotted and the lane solid.
Three groups, label/value rows:
- **Route:** "Pick up" (Dallas, TX · now), "Deliver by" (Jan 7 02:36 · Charlotte, NC), "Miles" (1,085 loaded ·
  0 empty), "Driving" (19.6 h), "Reload at Charlotte" (fair · about 57 mi empty to the next load).
- **The money:** "Book now" (2,010 FD · 1.85/mi), "Your break-even" (2.08/mi), "Profit at book-now" (−245 FD),
  "Usually clears near" (2.10/mi), "Ceiling" (2.42/mi).
- **Shipper:** name, "On time" (—).

"More about this load" folds: commodity, cargo value, tolls, two-lane share, season, load number.
**Actions, pinned to the bottom:** **Book now · 1.85/mi · −245 FD**, and a bid control: "−" [2.39] "+" (0.05 a
tap, inside the bid range, shown "2.18–3.63") with **Bid · +338 FD**. Primary style: Book now when its profit is ≥ 0,
else Bid; negative figures red.
States: blocked → both disabled, the reason in red above. Bid in → "Change bid" and **Withdraw**. Live, sent
→ "Sent · in effect 06:02" (`LEAD_MIN`, ~30 real seconds). Refused → the reason in red under it; no toast.

### S4 Booked or bid in (5:30)
**Book now:** the sheet drops to half with "Booked · Dallas → Charlotte · 2,010 FD" and goes to S6.
**Bid:** the sheet drops to half; the load card pinned at its top: "Your bid · 2.39/mi · clears 06:00 · in
10 h", a ring that fills to the round, **Withdraw**. The map draws the lane dashed; the strip line reads "1 bid
in · clears 06:00". Step 2 ticks here.

### S5 The round (at the round, or on return)
The pinned card becomes the result until "OK" or the next bid; Loads gets a dot.
- Won: "Won Dallas → Charlotte at 2.39/mi · 2,593 FD" → the sprite leaves the hub → S6.
- Lost: "Lost to 2.24/mi · your bid 2.39 · your break-even 2.08" and **Bid again** (the board sorted by profit
  at "Usually clears near"). Draft 1's "three of fourteen cleared under…" goes: nothing computes it.

### S6 Rolling (6:00–8:00)
Fleet, one card: the rig, "Dallas → Charlotte · 1,085 mi", a progress bar, "ETA Jan 7 02:36", a chip "On time"
or "Late 3 h". The map follows the truck until the player pans, then shows "Follow". Overnight stop: question 3.

### S7 Delivered (on return)
Result card on Fleet; Money gets a dot. "Delivered Dallas to Charlotte", then the pay line, one row each: "The
load" 2,593 · "Fuel" −612 · "Tolls" −0 · "The lessor's `{npcLeaseShareOfGross}`" −389 · "Held toward your own
truck" −150 (when the deposit applies) · **"Yours" 1,442 FD** · "Paid" (due day). Same rows as the ticker line,
in the open.

### S8 Money (8:00–9:00)
Four groups: "Cash" with the sparkline; "Owed to you" (load, amount, due day; empty: "Nothing owed yet · your
first invoice lands here"); "This week's costs" (lease minimum, insurance, yard, per diem); "Standing" (loaded
miles, the bible's Miles). Under a fold: "Loans" (purchase loans only). Exchange, auction, airdrop, pools,
deposits: not shown in the beta.

### S9 Before you go (9:00–10:00)
After the first hand-booked load, Iuliia's caption: "Next round 18:00. Set your dispatcher before you go." and
**Set the dispatcher** → Fleet › Dispatcher: a switch "Bid for me while I'm away", then three rows: "Bid at
break-even plus" [25] %, "Send the truck empty up to" [150] mi, "Bring me home after" [21] days, then **Save**.
"More rules" folds the rest (floor, book-now, move idle trucks, contracts). The re-post row is hidden until
brokerage opens. Defaults are `DEFAULT_ORDERS` until Jeff answers question 1.

### Map and panel
A hub tap opens a hub card in the sheet or panel (its loads, then its market), never a modal or a tab switch. A
truck tap opens its Fleet card.

### Where everything else lives
- **Fleet:** truck cards, "Needs you" (alerts, tenders, tired, idle), the yard, Dispatcher, "Today" (the last
  eight feed lines). Staff appears when a truck has no driver or at the second truck; "Buy your own truck"
  (the Dealer's used lot) at walkthrough step 9.
- **Company:** stats, safety record, contracts, insurance, home market, players; Business from its layer's day.
- **Iuliia:** the current step in full, the list of thirteen, Help (the Guide), the roadmap page.
- **Walkthrough targets move:** `own` → Fleet; `driver` → Fleet › Staff; `yard` → Fleet's yard; `miles` →
  Money › Standing.

## Questions (the producer routes them)
1. **Jeff, a rule:** standing orders off for a one-truck company until the first hand-booked load. Without it,
   S2–S5 belong to the dispatcher.
2. **Director and economy:** live, a bid resolves at the next round, up to three real hours away, so "wins a load
   inside five minutes" is only possible through a profitable Book now. Does the first board promise one?
   Today Dallas's nearest book-now lost 245 FD.
3. **Engineering:** can the client read a moving truck's overnight stop? If not, S6 ships without it.
4. **Director:** S0's three hubs. Mine: Chicago, Dallas, Phoenix.
