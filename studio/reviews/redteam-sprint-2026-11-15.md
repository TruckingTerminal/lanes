**Two live holes on 0.25.1, both sent at once, plus two smaller live ones; standing and reputation each have holes to fix in the build.**
1. Every windows claim can be dodged by moving cash into the Reserve first. The cause is the cap I asked for in the bundle pass.
2. A driver taken off a truck counts as "home" wherever they stand. That defeats the home rule, rule C, and rule 3's "an owner's fatigue builds", with no trip home and no per diem.
3. Under one deadline the logbook's "100 loads at 95% on time" milestone is automatic.
4. A perishable can spoil before its "Deliver by", which the guide says can't happen.

The rest are build notes: the top one for standing is a player's own facility building standing, and for reputation, laundering a record by refiling or going bankrupt.

# Red team: the sprint passes (2026-11-15)

**The code:**
- **Live:** e87d249, the engine of the live page v53, ruleset lanes-live-1/0.25.1-phase0.44, its live levers on.
- **Standing:** isn't built yet (no standing code in the checkout).
- **Reputation's three parts:** the director's ruling of 11-14, not built yet.

**Probes:**
- **The builder:** the live world's own (`newWorld`, 580 bots, the warm start), in a scratch worktree at e87d249.
- **How they ran:** gated, one at a time, with the repo's own tsx, seed 11.
- **The state they set directly:** where a probe needed a driver "25 days out and tired" or a hired driver, it set that state directly rather than play weeks of game. Each such line says so.

**Not touched:** the live page, its store and the checkout. Nothing is staged, and the worktree is removed. Filed in the repo once holes 1 and 2 were fixed on the live page (0.25.2 and 0.25.3); L3 was added when its fix went
live in 0.25.4 (2026-11-15).

## Ranked

| # | finding | gained | live? | sure | smallest fix |
|---|---|---|---|---|---|
| **L1** | **Every windows claim dodged through the Reserve** | releases, no-shows and late deliveries cost no FD, so booking ahead becomes a free option on the best loads | **yes** | certain: code and probe | post every claim in full; cap only the part paid to a player |
| **L2** | **A driver off the truck is home anywhere** | full rest (fatigue 0.6 → 0 in 5 days) and days away reset 1,380 mi from home, no per diem; rule C stops refusing | **yes** | certain: probe, owner and hired | a truckless driver is home only inside the home radius |
| L3 | **The logbook's on-time milestone is automatic under one deadline** | 41 of 41 carriers with 100+ loads in 60 days reach it (0 of 39 under the old rule): an airdrop slice (weight 6) for volume alone; "a clean quarter" ignores windows claims | yes | certain: probe | read service failures, not the on-time share |
| L4 | **Perishables can spoil before "Deliver by"** | nothing for anyone: an honest carrier loses the pay and pays a claim of half the cargo, on a load marked on time | yes | probe: 3 of 862 perishable deliveries in 20 days | start the spoil clock at "Deliver by" |
| L5 | **H, C and home-at-once read only the lead driver** | a resting or past-due co-driver is called out | yes | code | read every seated driver |
| L6 | **The laptop board table's open row prints the old appointment as "deliver by"** | a second deadline on screen | yes | code | the row reads the windows line |
| L7 | **A hot load's premium reads the end of unloading**; its mark and claim read arrival | a hot load "on time" can lose its premium | yes | code | read arrival, as the mark does |
| S1 | **A player's own facility builds standing** (or a partner's) | a 45,000 FD warehouse posts about two loads a day: tier 10 at its market in about two weeks, hauling the owner's own goods | at the build | certain: code | count only NPC shippers' loads |
| S2 | **Short hops at half weight** | at EWR, PHL and ABE, 43–60 mi hops count half a load; tier 10 for about a quarter of the hauling | at the build | probe | weight by miles |
| S3 | **First call ranks above the locals-first hold at the starter hubs** | established fleets, bots included, take the long-lead direct loads newcomers need | at the build | design | measure the newcomer's month; cap first call's share |
| S4 | **A first call that looks like a contract tender** could be passed to one's brokerage, or skew tender acceptance | a standing perk becomes a broker's margin | at the build | code path | first calls stay contractId 0, with their own acceptance count |
| S5 | **The dedicated lane** is passable to one's own brokerage (Rule A) and priced from the memory-lifted index | a broker's annuity at a locked rate | at the build | code path | no Rule A on lane tenders; price from `contractIndexBase` |
| S6 | **Decay alone lets a one-load trickle keep a tier** | first call and contracts at a market no longer served | at the build | design | the weekly review enforces the floors downward too |
| R1 | **Experience counts own freight and every hop alike** | about a third of a ~6% price edge, farmed with own loads or short hops | at the build | certain: code | count NPC-paid loads by miles |
| R2 | **A bankruptcy wipes service failures** (keeping authority age); a refile wipes fraud claims | a clean service record for six weeks idle | at the build | certain: code | keep the account's failures for the window |
| R3 | **A refile after a revocation gives a clean safety record** | "safety record clean" after a 30-day bar | at the build | certain: code | the vetting's 365-day lookback, in reputation too |

## L1. Every windows claim can be dodged through the Reserve (live)

**The cause:** in `claimOn` (windows.ts:440) a claim is `min(share × pay, balance(companyAccount))`, the cash account only. This is the bundle pass's fix 1, "no claim takes a carrier below zero", which I asked for.

**Why it can be dodged:** the Reserve (`cashReserve`, live) is its own account.
- A deposit is instant, with no guard (`depositReserve`).
- A withdrawal lands in cash a day later, free.

**The probe (case DODGE):** two players, each with 24,700 FD, each released a load booked ahead.

| | load's pay | claim paid | a day on |
|---|---|---|---|
| Plain Co | 1,167 FD | **117 FD** (10%) | −339 FD with trip costs |
| Reserve Co, all cash moved to the Reserve first | 2,901 FD | **0 FD** | −222 FD; the withdrawal landed in cash |

Both got the same mark (failed 1, reputation 0.773).

**What it opens:**
- A release costs no FD, so booking ahead (two deep a truck) becomes a free option on the board's long-lead loads.
- A no-show costs nothing but the mark.
- A late delivery skips its 20% claim.
- The release claim was the only price on blocking rivals.

**Fix, in `claimOn`:**
- Post every claim in full from the carrier, as any bill. It may take the carrier below zero, which mints nothing when it goes to the sink (the write-off at a restart draws from the reserve the sink fed).
- Cap only the part paid to a player poster (the no-show and late claims) at what the carrier held before it: cash, Reserve and settling. The rest goes to the sink.

**Why not just cap at cash plus the Reserve:** a transfer to one's own brokerage (3%) would still beat a 25% claim.

## L2. A driver off the truck is home anywhere (live)

**The cause:** in `dailyDrivers` (labor.ts), `home = !t || dayOff || standingAtHome(…)`.
- A driver with no truck (`assign_driver` with `truckId: 0`) is home on every day they don't drive, wherever they stand.
- `unseatDriver` already records where that is (`s.lastHub`), and nothing reads it here.
- A home day sets days away to 0, counts a rest day, resets fatigue after five, and charges no per diem: the layover needs a truck.

**The probe (case HOME, with and without `--swap`):**
- **Setup:** four test companies at Dallas sent a truck to Miami, 1,380 mi from home. Probe-set: hired drivers placed as an accepted offer leaves them, and each driver 25 days out at fatigue 0.6.
- **What happened:** six days standing at Miami.

| at Miami, six days | days away | fatigue | FD | rule C after |
|---|---|---|---|---|
| owner, stays in the seat | 26 → 31 | 0.63 → 0.58 | −660 | — |
| **owner, steps out of the truck** | **26 → 0 the next day** | **0.59 → 0.00 by day 5** | **−318** | — |
| hired driver, stays in the seat | 26 → 31 | 0.63 → 0.58 | −680 | refuses the outbound MIA–PHL load |
| hired driver, off the truck, the truck left empty | 26 → 31 | as seated | −680 | refuses: rule I seats him back the same day |
| **hired driver, off the truck, a relief driver in the seat** | **26 → 0** | **0.59 → 0.00 by day 5** | −680 | **allowed; booked by hand** |

**What it dodges:**
- **The home rule's point:** a rest at home.
- **Rule C:** a past-due driver heads home.
- **Rule 3:** with the dispatcher off, an owner's fatigue builds.
- **The trip home:** QA's 1,167 empty miles.

An owner-operator does it alone. A fleet needs one relief driver at the hub, where rule I's guard otherwise puts the driver back.

**Fix, one line in `dailyDrivers`:** a truckless driver is home only when `s.lastHub` is inside the home radius (`hubMiles(s.lastHub, c.homeHub) ≤ map.nearbyRadiusMi`). Anywhere else the day counts as away: road rest, and the layover's per diem. Getting a driver home without the truck is then a Send home, which isn't built.

## L3. The logbook's on-time milestone is automatic under one deadline (live)

**"100 loads delivered at 95% on time"** (weight 6 on the honest path) was calibrated on the old due time. The probe ran 60 days from the warm start (case MILESTONE):

| | carriers with 100+ loads | of those at 95%+ on time | on time overall |
|---|---|---|---|
| one deadline (live) | 41 | **41 (100%)** | 100.0% |
| old due rule (`oneDeadline` off, this process only) | 39 | 0 | 81.7% |

**What follows:**
- **The airdrop slice** is now earned by volume alone, and short loads farm it.
- **"A quarter with no at-fault crash and no claim"** (weight 8) reads `c.claims`, which holds only fraud claims (theft, unpaid). A carrier with fifty windows claims in the quarter still qualifies.

**Fix:**
- The on-time milestone reads service failures: 100 loads with releases, no-shows and late deliveries under 5%, or none.
- "A clean quarter" counts windows claims.
- This needs a dated record of failures, which reputation's build needs anyway (R4).

## L4. A perishable can spoil before its "Deliver by" (live)

**The cause:**
- **The spoil clock:** `appointmentT + spoilHours`, read at the end of unloading (`now` in `deliver`), not at arrival.
- **The appointment** is set at posting as `readyT + window + drive`. That is a whole pickup window (24 or 48 hours) before "Deliver by", until rollovers slide it 12 hours a round.
- **So a load booked early** (fresh produce or dairy, 24 h to spoil, at a first-come dock) spoils up to 24 hours before the card's only deadline.
- **canMake reads only "Deliver by".**
- **A spoiled load counts as on time** (`at <= deadline`).
- **The guide says the opposite:** guide/market.ts:73 puts the appointment at "windowHours after the pickup closes, plus the drive" and spoilage "24 h after the appointment", so 24 hours *after* "Deliver by".

**Probe (case SPOIL, 20 days):** 862 perishable loads delivered; **3 spoiled, all 3 on time by "Deliver by"**. Cargo claims on them came to 18,389 FD, about 6,100 each. Rare, but it costs the whole pay plus half the cargo, on a deadline the card never shows.

**Fix:** start the spoil clock at "Deliver by" (`latestDeliveryT + spoilHours`), and read it at arrival as the mark does. "Deliver by" is then the one deadline, as the director ruled. The guide's line becomes true.

## L5, L6, L7: small, live, from the code

**L5. Team trucks:** `resting`, `homeBlock` (H and C), `dueHomeNow` (home at once) and `assign`'s hold read only `truck.driverId`.
- A co-driver on days off, or past due, isn't seen. So a truck with a resting or past-due co-driver books out by hand, and the co-driver goes with it.
- **Fix:** read every seated driver (`seatedDrivers`).

**L6. The laptop board's table view:** its open row (`LoadDetail`, Loads.tsx:373 and 380) has no windows branch.
- It prints "pick up now" and "deliver by <appointmentT>", beside the row's own columns, which read "Deliver by" = `latestDeliveryT`. Two deadlines on one screen.
- **Fix:** use `windowLine` there, as the board's sheet does.

**L7. A hot load's premium** (`factor` in `deliver`) reads `now > deadline`, which is the end of unloading.
- The mark and the claim read arrival. A hot load that arrives on time at a dock that is slow to unload, or closed, loses part of its premium.
- **Fix:** read `at`.

## Standing with a shipper, before the build

**S1. A player's own facility builds standing** (the top hole for the build).
- **Why a facility's loads would count:** they are direct in the engine's terms: `brokerId` null, with `shipperId` the owner.
- **What "Every direct and contract load from that origin counts" would mean,** if built on `brokerId === null`:
  - a warehouse owner hauling its own goods earns standing at that market;
  - own freight pays 0 but is counted in `deliver` (`delivered++`);
  - so does a partner hauling the owner's loads.
- **The sizes:** a warehouse costs 45,000 FD and posts about two loads a day (`loadsPerRound` 1.0, two rounds a day). Tier 10's floor is 30 load-units in 180 days, about two weeks.
- **What that buys:** first call on that market's NPC tenders, net-15, contract offers and the dedicated lane, all paid from NPC money.
- **Fix:** standing counts only NPC shippers' loads, direct or contract (`shipperId === null && brokerId === null`, or a contract tender), never a player shipper's.

**S2. Short hops at half weight** are cheap to farm where lanes are short.
- **The probe (case LANES, 10 days of NPC direct and contract loads):**
  - 74 of 7,802 were under 100 mi, and 743 under 250 mi.
  - The short ones cluster in the Northeast: EWR posted 17 under 100 mi (shortest 52), PHL 17 (60), ABE 11 (43) and MDT 9 (54).
  - The starter hubs have none under 100 (DAL's shortest is 203 mi).
- **What that buys:** a 52-mile hop pays a few hundred FD and counts half a load, so tier 10 at EWR takes about a quarter of the hauling a 250-mile load gives.
- **Fix:** weight each load by its miles, e.g. `min(1, miles / 500)`, contract still double.

**S3. First call ranks above the locals-first hold.** The locals-first hold is what protects a newcomer at DAL, LAX and PHX.
- With windows, the loads that have "a day or more of life left after the round" are the long-lead ones. Fleets at tier 7 there, bots included, take them before any local.
- **Fix:**
  - the standing pair reads the newcomer's month, on the 24 seeds the economy used for 0.25.1;
  - if it falls, first call takes at most a share of a market's direct tenders a round (half, say), and the rest go to the locals and the board as now.

**S4. Build cautions for first call.**
- A first call made with `tenderedTo`, like a contract tender, must keep `contractId` 0. Rule A (`passTender`) refuses only `contractId === 0`, so a first call with a contract id could be passed to one's own brokerage and posted at its margin.
- First calls get their own acceptance figure. `tenderAcceptance` and `localBanUntilDay` are the contract tenders', and they move contract offers and the locals' ban.

**S5. The dedicated lane** (tier 10, through the `contracts.direct` mechanism):
- **Its tenders are contract tenders,** so Rule A lets the carrier pass them to its own brokerage. The brokerage posts them at up to 90% margin, and the lane counts them covered once booked (`coverPassed`). The perk becomes a broker's annuity.
- **Its price,** "the market's trailing contract level", must read the memory-free index (`contractIndexBase`). The lost-load memory still lifts the market's own contract index on freight nobody books, and a lane signs for a term at the level of the week it was offered.
- **Fix:** no Rule A on dedicated-lane tenders, and price the lane from `contractIndexBase`.

**S6. The weekly review must enforce the floors downward.**
- Decay ("eight weeks without a load") resets with any load, a half-weight hop included. A carrier at tier 10 could keep first call and contract renewals with one hop every seven weeks unless the review also drops a step when the 180-day floors fail.
- The final note's rule says one step a week; the build must apply it down as well as up.

**S7. Notes on the score.**
- **The on-time floors are inert under one deadline** (the probe's 100.0%). The floors are pure volume, and the hits (claims, no-shows, releases, late deliveries) carry the score.
- **A late delivery is both "late" (−1) and "a claim" (−2).** Count it once, at −2 or −1, not −3.
- **A refile (a new authority) should start standing over,** as a liquidation does. Out there, a new MC starts fresh with every shipper.
- **Dock priority** must not move a load's appointment, which the spoil clock reads (L4), nor its ready time. Less dwell and less dock wait only.
- **Net-15** reads the carrier's tier at the load's origin at billing, and applies only to NPC shippers' direct paper, never to a broker's or a player's.

## Reputation's three parts, before the build

**R1. Experience is farmable.**
- `delivered` counts own freight (`deliver` increments it whether or not `own`), and every load counts the same whatever its miles.
- **Two ways to build experience without hauling for anyone else:** a warehouse's own loads, or short hops at the Northeast hubs (S2).
- **What it's worth:** the bid score reads reputation at 0.25 against price at 0.55, so a reputation edge of Δ is worth 0.45 × Δ of the ceiling. The director's ~6% spread is Δ ≈ 0.13. If experience carries a third of it, that is about 2% of the price on every bid, for good.
- **Fix:** experience counts NPC-paid loads, weighted by miles as in S2. Own freight never counts. The cap and decay stay.

**R2. A bankruptcy wipes the service record.**
- **What `restart` (solvency.ts) does:** it sets `failed`, `delivered`, `onTime` and `late` to 0, but keeps `authority.since` (the authority's age) and the safety record.
- **What a free-path carrier with a poor service record can do:** let its cash fall below −2,000 FD for 4 weeks, sit out 14 days, and come back with a clean service record and its authority age intact.
- **What `refile` does:** it also empties `c.claims`, the fraud claims.
- **Fix:** keep the account's dated service failures across a restart and a refile, for the 90-day window the display names.

**R3. A refile launders the safety record.**
- After a revocation and its bar, `refile` gives a new authority with `newSafetyRecord()`: "safety record clean" on the bid sheet. The bar is 30 days for a first unsatisfactory.
- Strict vetting keeps the history for a year ("linked to a revoked authority", `revokedLookbackDays` 365). Reputation doesn't.
- **Fix:** for 365 days after a refile, the safety part reads the old record (kept on `authority`), or sits at its floor.

**R4. Build notes.**
- **No dated failures:** `failed` is a lifetime counter. "2 releases in 90 days" needs a dated list of releases, no-shows, late deliveries and claims.
- **Missing records:** a cargo claim (spoiled, damaged) is recorded nowhere on the company. A spoiled load counts as on time today (L4). Both belong in service failures.
- **The safety record's own windows** (730 days for violations, inspections and crashes; 365 for hidden ones) are already there to read.

## What came back clean

- **Home at once and the dispatcher-off rule, the rules themselves:**
  - Rule 2 starts the days off inside the market as ruled.
  - Rule 3 moves no truck and leaves the player's Send home working.
  - Toggling the dispatcher only brings back the old empty run home, at the player's cost.
  - Keeping a load booked ahead so a truck never stands idle at home avoids the days off, but the fatigue builds, and that is the player's policy, like deleting the home rule.
- **One deadline, for claims and the mark:** the claim and the mark agree to the minute. A late delivery is rare (0.1%), and nothing pays for lateness.
- **The eight bundle fixes:**
  - A release can't be rebooked by its carrier.
  - Booked loads stay out of the memory.
  - The H hold keeps the truck home and takes nothing else.
  - C measures from where the truck will be free.
  - The fee is charged on a self-tender, and the broker-paper refund matches the shipper's.
  - The mid-leg night runs once a night, capped at 30 mi.
  - The ask's share lasts one round, and rule I skips drivers on days off.
  - The one regression is L1.
- **Standing's design, where it holds:**
  - It is kept at the company and goes with a liquidation, and it is never shared between one owner's two companies.
  - Brokered loads don't count, so one's own brokerage builds none.

## Files

- **The probe:** `s15/probe_wsim.ts` in the red team's scratchpad, run with `--root <worktree> --case HOME|DODGE|SPOIL|MILESTONE|LANES [--swap] [--off 1]`.
- **The gated runner:** `run.sh`, beside it.
- **The logs**, beside it:
  - `p1.log`: HOME, SPOIL, MILESTONE on and off;
  - `p2.log`: DODGE;
  - `p3.log`: LANES;
  - `p4.log`: HOME with `--swap`.
- **The worktree** `…/scratchpad/wt-s15` is removed.

## Re-probe of the four fixes at dae2317 (2026-11-15)

**The verdict: L2, L4 and L7 close and open nothing. L1's dodge closes, but its new cap has a gap of its own: one expression to change before 0.25.2 switches it on.**

**How it ran:** a worktree at dae2317, the same probe, seed 11, each switch set in the probe's process only (`--set`), gated, the repo's own tsx. The worktree is removed.

### L1, `windows.claimsInFull`: the dodge closes; the cap needs one change

| case | off (0.25.1) | on |
|---|---|---|
| 1. release with all cash in the Reserve (pay 1,666 FD) | claim 0 | **167 to the sink, cash 0 → −167** |
| 2. no-show on a player brokerage's load, cash in the Reserve (pay 1,985) | claim 0 | **496 to the brokerage, in full** |
| 3. no-show by a carrier holding nothing (pay 2,336) | claim 0 | **584 to the sink, 0 to the brokerage** |
| 4. release after moving the cash to one's own brokerage (3%) | claim 2 | **167 to the sink, cash 2 → −165** |
| 5. the released load booked again | refused | refused |

Cases 2 and 3 count the brokerage's take net of the fall-off charge it pays on a lost load. The table gives the claim itself.

**The gap: a carrier's own debt doesn't count against the cap.**
- **The cap:** the poster's part is capped at `max(0, cash) + reserveHeldFd`. The claim is taken from cash, and the Reserve is never drawn.
- **So once cash is below zero,** every further claim pays the poster up to the whole Reserve again.
- **The probe:** "Reserve Farm" held 300 FD in all (Reserve 300, cash 0) and no-showed two of the brokerage's loads.
  - The brokerage received **600 FD in claims**, 300 each, from a company that never had more than 300.
  - The farm ended at cash −1,209, net −909.
  - At its restart the write-off fills that from a faucet.
- **The blocker returns, slower:** it can't repeat on one load. Each claim needs a booking and a no-show (or a late delivery) on the poster's freight, so a farm mints at most its Reserve per failed load until it's wound up, then starts again.
- **The fix:** `Math.max(0, w.ledger.balance(companyAccount(carrier.id)) + reserveHeldFd(w, carrier.id))`. Signed cash plus the Reserve, floored at zero, so everything a carrier ever pays posters is bounded by what it held.
- **A test to add:** two claims to a player poster from a carrier holding only a Reserve, whose total exceeds it.

### L2, `labor.truckLessHomeByHub`: closed

Owners and the hired driver with a relief in his seat, at Miami, 1,380 mi from home, six days:

| | days away | fatigue | FD | rule C after |
|---|---|---|---|---|
| owner out of the truck | 26 → 31 (was → 0) | 0.63 → 0.58, road rest as seated (was → 0.00) | −468 (was −318): the per diem | — |
| hired driver out, relief in the seat | 26 → 31 (was → 0) | as seated (was → 0.00) | −830 | still refuses MIA–PHL; the hand booking is refused |

**Nothing new opens.** Only `unseatDriver` takes a driver off a truck, and it records where they stood (`lastHub`; driver clocks follow the driver in live). A hire with no truck has no `lastHub` and stays home, as before.

**Two notes:**
- **A stranded driver:** a driver taken off the truck away from home now waits there on a daily per diem until a truck at that hub takes them. Rule I does it for a hired driver beside an empty truck. A Send home for a truckless driver isn't built.
- **For the economy:** the switch can move bots. A bot driver left truckless away from home now pays per diem and doesn't rest, so the pair should read per diem and days off.

### L4, `windows.spoilAfterDeadline`: closed

| 20 days, every carrier | off | on |
|---|---|---|
| perishable loads delivered | 862 | 862 |
| spoiled | 3, all on time by "Deliver by" | **0** |
| spoiled loads' cargo claims | 18,389 FD | **0** |

**Nothing new opens.** The change softens a late perishable: it is paid, less the late claim, until "Deliver by" plus its spoil hours, where before it spoiled. canMake already keeps bookings inside "Deliver by", so a carrier can't plan to be late. The guide's line ("24 h after the appointment", with the appointment at "Deliver by") is now true. The load sheet's commodity row still says "spoils 24 h after" with nothing after "after": "after Deliver by" is the writer's line.

### L7, `safety.hotLoads.premiumFromArrival`: closed

| 30 days, every carrier | off | on |
|---|---|---|
| hot loads delivered | 12, all arrived by "Deliver by" | 12, all arrived by "Deliver by" |
| paid part of the premium only | **2 (2,225 FD of premium lost)** | **0** |

Nothing new opens.

### Files

- **The probe:** the same file, now with `--case FIX|HOT`, `--set path=value` and `--farm-reserve N`.
- **The logs:** `r1.log` (the seven runs) and `r2.log` (the 300-FD farm), beside it.

## Re-probe of the claims cap at cb717a1 (2026-11-15)

**The claims fix is clear for 0.25.2.**

**The change:** the poster's part is now `max(0, signed cash + Reserve + settling)`. A worktree at cb717a1 ran the same probe, seed 11, with `windows.claimsInFull` on.

| case | dae2317 | **cb717a1** |
|---|---|---|
| farm holding 300 FD (all in the Reserve), two no-shows on a player brokerage's loads | the brokerage got 600 FD (300 each) | **300 FD in all** (300, then 0); the other 909 to the sink |
| farm holding 2,000 FD, the same two no-shows (1,209 FD of claims) | 1,209 to the brokerage | 1,209 to the brokerage (within what it held; it ends at net +791) |
| the five cases (Reserve release, Reserve no-show, broke no-show, brokerage-transfer release, rebooking) | pass | **pass, unchanged** |

Everything a carrier pays posters is now bounded by what it held, so nothing is minted at a write-off. The cap counts what is settling out of the Reserve, and the Reserve can only go back to cash, so it can't be spent twice.

**On L2, for the director:** the economy's pair shows the fix strands truckless drivers (owner bankruptcies 74 → 142). The hole only needs the free, instant rest anywhere to go, not the driver held away for good. One shape that closes it without stranding anyone:
- **The ride home:** a truckless driver away from home rides home, one day per 550 mi on the per diem.
- **Then home:** they count as home and their last hub becomes the home hub.
- **Back to the far truck:** re-seating them in a truck at the far hub then needs the truck brought home, or the ride back.
- **The swap is no longer free:** it costs the ride both ways plus the days off, which is what going home costs.

The log is `r3.log`, beside the probe. The worktree is removed.

## Exploit pass on ruleset 0.25.3 (b625c11–7ba1c6d), before its switch-on (2026-11-15)

**Live holes: none in this pass.** The live world runs 0.25.2, and every 0.25.3 rule below is behind a switch that is off.

**Two to fix before 0.25.3 switches on:**
1. A first call lets its holder clear at the ceiling uncontested, 16–20% over the market.
2. §5's forced days off can hold a load booked ahead into a no-show, with no ask.

The rest hold or are low.

**How it ran:** a worktree at 7ba1c6d, on the 0.25.2 live profile with `labor.truckLessHomeByHub`, `labor.busHome`, `windows.releaseCurrent`, `labor.dueHomePlan`, `assets.handOverAtTruck` and `standing.enabled` on (`--set`), seed 11, gated, the repo's own tsx. The worktree is removed.

| # | finding | gained | sure | smallest fix |
|---|---|---|---|---|
| 1 | **A first call clears at the holder's own price, up to the ceiling:** the holder alone may bid at the clearing, and nobody else can | +16% on book-now, +20% on the reference, on every first call taken | probe | a first call clears at no more than its book-now |
| 2 | **§5: forced days off hold a load booked ahead past its pickup** | nothing: an honest player's no-show claim and mark, with no ask | probe | at the hold, the breakdown's ask if the load can't be made after the days off |
| 3 | **§1: a truck waiting at the dock can't release a load not yet ready** | nothing: a player is stuck for days | probe | allow the release while the truck waits for `readyT` |
| 4 | Auto-staff still seats a truckless driver at any hub (known, deferred by §9) | a free ride back after the bus; half a rotation's cost | code | auto-staff seats a truckless driver only at their last hub |
| 5 | An owner who steps out beside his own empty truck in an auto-staffed company gets no bus and no seat | nothing: away and on per diem until seated by hand | probe | the owner counts as the driver that truck needs, or he rides |
| 6 | A cut days-off window still counts undriven days as home anywhere (`dayOff`) | rest away from home for what's left of the window | code | `dayOff` counts only at home |

### 1. A first call clears at the ceiling (standing §14)

**The cause:** a first call is held for its holder through the next clearing (`tenderedTo`, contractId 0). Only the holder may bid on it there, and the clearing has no reserve: a lone bid wins at its own rate, up to the ceiling.

**The probe (case CALL):** a company given tier 7 at Dallas (probe-set, as if earned) with an idle truck there. Its first call was a van to Louisville, 908 mi:

| reference | book-now | ceiling | the holder's bid | cleared at |
|---|---|---|---|---|
| 3.20 | 3.29 | 3.84 | 3.84 | **3.83: +16% on book-now, +20% on the reference** (about 490 FD more than book-now) |

**What this changes:**
- **The intent:** the director calls a first call "a spot offer at a fresh posting's price". The economy sized first call as moving who hauls, not how much is paid.
- **Bots:** they bid at their own floors, so the pair never saw it.
- **A player:** a player at tier 7+ who bids every call at the ceiling turns the perk into a 16–20% rate premium.
- **The free pass (§14) adds to it:** passing or letting a call lapse costs nothing, so the holder takes the best calls at the ceiling and lets the rest go a round later.

**Fix:**
- While a first call is open, the holder's bid clears at no more than the load's book-now (cap it in `manualRoundBids` for the holder's own call), or the call offers only Book now.
- The bots' bids at their floors are unaffected.

### 2. §5's forced days off hold a load booked ahead into a no-show

**The cause (`labor.dueHomePlan`):** `setIdle` now starts a due driver's days off before a load booked ahead, and holds that load (`departHeld`) until the days off end. Nothing checks that its pickup is still open then.

**The probe (case TRAP):** an owner-operator at Los Angeles.
- **L1:** Phoenix → Los Angeles, free Mon 06:00.
- **L2, booked ahead by hand:** Los Angeles → Las Vegas, pickup closing Mon 18:00.
- **The state:** the owner set due (30 days out, probe-set).

| | `dueHomePlan` on | off |
|---|---|---|
| at L1's delivery | "You're home for 5 days off." | L2 starts |
| L2 | held, then "Load #4089 not picked up before its pickup closed: a 621 FD claim." | in transit |
| marks | 1 failed (and −2 standing loads where it counts) | none |

**Who it hits:** owners too, since `departHeld` holds anyone on days off. The dispatcher avoids it (`homePlan` books nothing out of home for a due driver), so it hits hand bookings: a load booked ahead a day or two before the driver came due.

**Fix:** at the hold, if the load can't be made after the days off (`departHeld`'s run from the end of the days off, against `latestPickupT`), give the breakdown's ask (`loadAsk`):
- release at the early share within a round, or keep;
- a dispatcher's own booking is released at once.

**The other way out:** start the days off after that one load, as a loaded truck passing through home does. That is the director's call.

### 3. §1: a truck waiting at the dock can't release a load not yet ready

**What happens:**
- `releaseLoad` takes the current load only while the truck is `toPickup`.
- Under windows, a truck that reaches the shipper before the ready time waits there as `loading`.
- The probe (case RELEASE): a load ready in 68 h, the truck at its dock. Release refused: "only a load not yet picked up can be released".
- The ruling says "until it's picked up". The player is stuck for days with no priced way out, which the ruling exists to prevent.

**Fix:** allow the release while `status === "loading"` and `w.t < readyT`. The truck stands at the shipper's town, with the same shares and mark.

**On the way, it works as ruled:** a release four hours out cost the urgent share (650 FD), the load went back on the board, and the truck ran 11 mi to Antlers.

**Can it be farmed? No, not by one company:**
- `releasedBy` blocks rebooking.
- The claim posts in full to the sink.
- The breakdown's early share lasts one round and needs a real breakdown that breaks the plan.

**A two-player ring against the urgency walk** (one releases into the last rounds, the other books the walked price) pays the urgent 25% to the sink for at most the walk's +46%. That is only if nobody books the load through three or more rounds of the walk. Not worth it; no rule needed.

### 4–6. The bus, the hand-over and the days off

**The bus works as ruled (case BUS):**
- **The trip:** an owner stepped out at Miami, 1,380 mi from home. He waited a day, rode two days with no rest (days away 27, 28), arrived home on the third, and was rested by day 20.
- **The fare:** 82 FD.
- **No way back to the far truck:** seating him again in the Miami truck was refused on the bus ("they're on the bus home") and after it ("they're at DAL, and that truck is at MIA").
- **No teleport:** the bus only goes home, and nothing changes a company's home hub. So it can't take a driver anywhere else.

**What's left, low:**
- **Finding 4, auto-staff's seat-anywhere** (labor.ts `autoStaff`: spare drivers onto empty trucks at any hub, and an owner taking over a hire's truck at any hub).
  - It is the deferred item §9 names. With the bus on, it gives a hired driver a free ride back: bus home, rest, then auto-staff seats him on an empty truck anywhere.
  - A rotation then costs one fare, not two.
  - The same path crews a truck added at a far dealer or listing from any hub (§6).
  - **Fix:** auto-staff seats a truckless driver only at their `lastHub`, until the bus to a truck is built.
- **Finding 5, an owner in an auto-staffed company** who steps out beside his own empty truck (case BUS with auto-staff on):
  - No bus, because "an empty truck at that hub needs a driver". No seat either: auto-staff's spare path doesn't seat the owner.
  - Nine days later he was still truckless at Miami, away 34 days and on per diem, until seated by hand.
- **Finding 6, `dayOff`** (`daysOffFull`, live) counts an undriven day inside the days-off window as home, wherever the driver is.
  - An owner who cuts his days off by driving out keeps that credit at any hub for the rest of the window.
  - Hired drivers are held at home by rule H, so it's owners only.
  - **Fix:** count `dayOff` only where the driver is home (the truck at home, or truckless inside the radius), or clear `homeUntilDay` when the days off are cut.

**§6, the hand-over, holds:**
- A replacement now waits at the dealer.
- The leased truck must stand idle at that hub, so there's no free move.
- What's left is auto-staff's seat-anywhere (finding 4).

### Standing: S1–S7 on the built code, and §13

| check | built | holds? |
|---|---|---|
| S1 player and own-facility loads | `standingLoad`: no broker, no player shipper, no facility, no re-post | yes |
| S2 short hops | weight `min(1, miles/500)` | yes |
| S3 first call above the locals | the pair: the newcomer's month 9,273 FD with standing, 8,538 without | yes (but see finding 1) |
| S4 first call unpassable, its own acceptance | contractId 0; `Scorecard.calls` | yes |
| S5 dedicated lane | `passTender` refuses it; priced from `contractIndexBase` | yes |
| S6 floors downward | yes, with §13's one review on notice first | yes |
| S7 late once, refile and liquidation start over, dock priority and net-15 scope | as specified | yes |

**§13's "on notice" opens nothing.** It holds a tier one more review, so each step down takes two reviews. A carrier that hovers at a floor keeps its tier with half its reviews below. That is by design, and it moves no money.

### Files

- **The probe:** the same file, now with `--case CALL|TRAP|RELEASE|BUS` (`--home`, `--autostaff`).
- **The logs:** `r4.log`, `r5.log` and `r6.log`, beside it.
