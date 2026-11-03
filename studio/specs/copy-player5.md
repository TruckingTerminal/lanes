# Copy: the return sitting's writer rows (writer, draft 1, 2026-11-03; against `reviews/director-player5.md`)

Strings for R21 (the return card), R22 (one true reason at the wall), R24 (the price on the send buttons) and R25 (the record), plus row 9. R23's stuck rule ("the ways out", priced) waits until the director writes it into `guidance.md`; its lines follow then. Keys are proposed in `copy.ts` style. `{key}` is config; `{x}` is computed. Plain throughout: this card is about money and position. No string over 20 words.

## R21: the return card

After `{guide.returnHours}` real hours away, Iuliia's first line is this card, built from the world. It replaces any tutorial line until the player acts or taps OK. Each part shows only where it applies, in this order.

| Key | Part | String |
|---|---|---|
| `return.hello` | greeting | Welcome back. |
| `return.whereIdle` | where, idle away from home | Your truck is idle at `{place}`, `{mi}` miles from home. |
| `return.whereHome` | where, at home | Your truck is at home in `{hub}`. |
| `return.whereMoving` | where, on a trip | Your truck is `{mi}` miles from `{dest}`, arriving `{eta}`. |
| `return.whereFleet` | where, two or more trucks | `{n}` trucks: `{moving}` on the road, `{idle}` idle, `{home}` at home. |
| `return.whyIdle` | why, idle at a wall | Nothing here is yours to take: `{reason}`. (R22's binding reason) |
| `return.whyIdlePays` | why, idle with loads that pay | `{n}` loads in reach pay over break-even. |
| `return.doingLoading` | what it's doing | It's loading at `{place}`, done around `{hh:mm}`. |
| `return.doingResting` | what it's doing | It's resting near `{place}` and rolls again at `{hh:mm}`. |
| `return.doingDock` | what it's doing | It's waiting at `{place}`: the dock opens `{day hh:mm}`. |
| `return.awayLive` | while away, the live world | While you were away: `{n}` loads delivered, `{fd}` FD in, `{fd}` FD out. |
| `return.awayTrouble` | while away, if anything went wrong | Also `{list}`. (items: a breakdown · a ticket · a late load · a driver who left) |
| `return.awayQuiet` | while away, live, nothing happened | Nothing happened while you were away. |
| `return.awayTest` | while away, the test page | Nothing moved while you were away: the test world waits for you. |
| `return.month` | a month closed while away | `{Month}` closed while you were away: you kept `{fd}` FD. · **Read the month** |
| `return.next` | What now?'s top action | `{action}` · its button |
| `return.ok` | dismiss | OK |

**The three forms, as a player reads them** (examples, not strings):

- **Idle at a wall:** "Welcome back. Your truck is idle at Des Moines, IA, 894 miles from home. Nothing here is yours to take: strict vetting needs 90 days' authority, and yours reaches it Mar 3. Nothing moved while you were away." Then What now?'s top action (R23).
- **Mid-trip:** "Welcome back. Your truck is 312 miles from Charlotte, NC, arriving Fri 14:00. While you were away: 2 loads delivered, 3,980 FD in, 1,240 FD out."
- **Nothing to report:** "Welcome back. Your truck is at home in Memphis. Nothing happened while you were away." Then What now?'s answer, which may be rule 6's "Nothing needs you".

## R22: one true reason, where the wall is

The board shows the first refusal the engine would give, in the engine's order: vetting before local-first.

| Key | Where | String |
|---|---|---|
| `wall.vettingStandard` | load card chip | Needs `{days}`-day authority: yours reaches it `{date}`. |
| `wall.vettingStrict` | load card chip | Strict vetting: `{days}` days' authority and `{n}` loads. You have `{d}` days, `{l}` loads. |
| `wall.vettingStrictDate` | the same, when only the date is short (the director's) | Strict vetting needs `{days}` days' authority: yours reaches it on `{date}`. |
| `wall.localFirst` | load card chip | Local carriers first this round. Open to everyone from `{hh:00}`. |
| `wall.hot` | load card chip | A hot load needs a team. |
| `needs.stuck` | Needs-you item, the moment the truck goes idle with nothing it may take | Truck `{n}` is idle at `{place}`: `{reason}`. · **See the ways out** |
| `needs.stuckPays` | Needs-you item, idle with nothing that pays | Truck `{n}` is idle at `{place}`: nothing in reach pays. · **See the ways out** |

**See the ways out** opens What now? at R23's rule. Until R23 is built, it opens the board sorted by profit.

## R24: every move shows its price before the tap

The cost is fuel, the driver's pay and tolls over the empty miles, from the same parts as break-even.

| Key | Button | String |
|---|---|---|
| `move.home` | Send home | Home · `{mi}` mi empty · about `{fd}` FD · `{days}` days |
| `move.emptyOption` | Send empty's destination list, one option per hub | `{hub}` · `{mi}` mi empty · about `{fd}` FD · `{days}` days · `{n}` loads there |
| `move.empty` | Send empty, the button | Send empty |
| `move.reposition` | Reposition | Reposition to `{hub}` · `{mi}` mi empty · about `{fd}` FD · `{days}` days |
| `move.time` | the time part | 1 day · `{n}` days · under a day: `{h}` h |

Explain entry `move.cost` (now in `guidance-strings.md` section 3): **what** "What this empty run should cost before the next load." · **how** "Fuel, your driver's pay and tolls over the empty miles, at today's prices." · **moves** "The distance, the price of diesel, and the truck's mpg."

## R25: the record lives in the world

| Key | Where | Now | New |
|---|---|---|---|
| `MONEY.nothingOwedLease` | Owed to you, on a lease | Nothing owed yet. Your first invoice lands here. | On a lease, the lessor pays on delivery. Invoices start with your own truck. |
| `MONEY.nothingOwed` | Owed to you, an owned truck, nothing yet | (kept) | Nothing owed yet. Your first invoice lands here. |
| `LOGIN.continueLive` | the title | Continue · `{company}` | Continue · `{company}` · `{Fri Feb 2}` |
| `LOGIN.continueTest` | the title, test page | Continue · `{company}`, day `{n}` | Continue · `{company}` · `{Fri Feb 2}` |
| `YARD.now` | the yard card | Now · `{n}` tractors · `{n}` of your own trailers | Running · `{n}` leased, `{n}` owned · `{n}` trailers of your own |
| `LOADING.title` | the load screen (`main.tsx`) | Loading your test world | Loading your world… |
| `LOADING.detail` | under it | Replaying its history in this browser. | (none) |
| Help, "The live world and test worlds" | a new last sentence | | Your world is rebuilt from its own orders each time it loads, so it always comes out the same. |
| month links | every line that points at the month report | | (removed until the report exists, R10; "Read the month" returns with it) |

## Row 9: the night's rest is announced

| Key | When | String |
|---|---|---|
| `ROLLING.restNow` | the truck stops for its rest | Resting near `{place}` until `{hh:mm}`: the driver's hours ran out. |
