> **Status (the producer, 2026-11-13):** all eight findings were fixed in 1919cc3 (engineering), passed the ten-seed gate on that commit, and went live with ruleset 0.25.0-phase0.43 (6ce2203, live page v51). QA's replay on the test page confirmed 3 and 4 on screen and saw 1's release burned; the rest are covered by engineering's tests (bundle-fixes, stopintown-midleg, days-off).

**Not clear.** One blocker: under windows a release claim is a payment from one player to another that nothing taxes, that repeats on one load without hauling it, and that posts below zero. 300 book-and-release cycles in one game minute moved 88,299 FD to a brokerage from a company left at −83,599, whose debt the restart then writes off from a faucet. Three more must be fixed first, each a line or two: the mid-leg town night adds its detour every hour the night lasts; rule H lets a resting driver be called out; lost NPC loads raise a hub's pay, and a player can lose them on purpose.

# Red team: exploit pass on ruleset 0.25.0's mechanics (2026-11-13)

**What was read:** the code at bdc8a9b with engineering's uncommitted fee follow-ups (the refund, `unburn`), as the checkout has them.

**What was run:** seven probes of the live world's own builder (`newWorld`, the 580 bots, the warm start).
- Every bundle key was on: windows, the fee, expedite, H, C, I and the mid-leg night.
- They ran in a scratch worktree at bdc8a9b plus that diff, gated, one at a time, with the repo's own tsx.
- The unlock ladder was off in those processes, so a brokerage could form at once. Nothing else about the rules changed.

**Not touched:** the live page, its store and the checkout. Nothing is staged, and the worktree is removed.

**Since then:** HEAD moved to 74fe366, the writer's copy only. The checkout now also carries engineering's uncommitted AI brokers' fix in board.ts, windows.ts and the config: the broker tally with windows off, and the walk's reach. None of it touches `claimOn`, `releaseLoad`, `noteLost` on a no-show, `homeBlock` or `nightInTown`, so every finding below stands on it.

## Ranked

| # | finding | gained | reaches live | sure | smallest fix |
|---|---|---|---|---|---|
| 1 | **A release claim moves FD from one player to another**: any sum, no fee, no tax, no haul, below zero | unbounded transfer between two accounts; FD created when the payer's debt is written off; it counts as the receiver's profit | yes, from the switch-on, once the receiver has a facility (game day 28) or a brokerage (day 91) | certain: code and probe | in `claimOn`: a cancel claim always goes to the sink, and no claim overdraws the carrier |
| 2 | **The mid-leg town night adds its detour every hour of the night**, and picks towns hundreds of miles off | nothing, for anyone: an honest player who chose the town loses miles, hours and deadlines | yes, for any player who picks the town | certain: code and probe | call `nightInTown` once a night (behind `parkForTheNight`'s guard), and cap the detour |
| 3 | **Rule H is bypassed by booking a pickup after the days off**: the truck leaves at once | a resting hired driver called out; the honest player who books "past the days off" loses them too | yes, from the switch-on | certain: code and probe | a resting truck's booking waits at home until the days off end; until then, H refuses every hand booking |
| 4 | **Lost NPC loads raise a hub's reference, and a carrier can lose them on purpose** (book, then no-show) | +6% to +28% on a hub's NPC pay for 3 loss a day (two seeds), +45% for 10 a day; the AI brokers' cover rule trips the same way | yes, from the switch-on, any carrier | sure of the lever; its profit varies by seed | a load that was ever booked joins neither the memory nor the brokers' tally when it is lost |
| 5 | **Rule C measures "toward home" from the leg's origin when booking ahead** | a past-due driver booked further out | yes | certain: code and probe | measure from where the truck will be free, as the dispatcher does |
| 6 | **The fee: a brokerage's tender to its own carrier pays none on the whole haul** | 1% of every self-tendered haul; brokers' margins are never charged | yes, from day 91 | certain: code | charge the haul once when the owner's own brokerage tenders it |
| 7 | **A breakdown's ask keeps the 10% release open until the pickup closes** | a cheap way to hold, then lose, a load | yes | certain: code | the ask's early share lasts a round, then the usual shares apply |
| 8 | **Rule I can seat a driver who is on days off** | nothing: the truck it fills then can't be booked | rare | code only | skip drivers with days off left |

## 1. A release claim moves FD from one player to another

**The probe (case A, seed 11, day 10):**
- A main's brokerage posted a held tender at 0% margin: Dallas to Amarillo, 452 mi, book-now 2.60/mi.
- A second player's truck ran empty toward Houston. An empty run is a busy truck, and a busy truck books ahead.
- It then booked the load and released it 300 times in game minute 15,480. Nothing was refused.
- Each release paid a claim of 294 FD (25%: the load was in its last 48 hours).

| | before | after 300 cycles |
|---|---|---|
| the main's brokerage | 4,700 FD | 92,999 FD (+88,299), none of it spend-only |
| the second player | 4,700 FD | **−83,599 FD** (under zero from cycle 16) |
| settlement fee · service-failure sink | — | +0 · +0 |
| the brokerage's operating result | — | +88,298 |
| the second player's reputation | 0.850 | 0.027 (300 failures) |

**Why it works:**
- **A release puts the load straight back on the board** (`releaseLoad`, then `reopenLoad`), and nothing stops the same truck booking it again at the same book-now.
- **Who gets the claim:** `claimOn` posts it to the poster: a re-poster, else the broker, else the player shipper. It burns only when the poster is an NPC or the carrier's own other company.
- **The ledger lets a company go below zero:** "it may take the carrier under zero". A week later the second player read −84,511 FD with 1 week in debt.
- **The debt never comes back:** after 4 weeks in debt and 14 days more, the restart forgives it from `faucet:bankruptcy_writeoff`. That is new FD, and the second player starts again on the free path.
- **Nothing on the way charges it:** neither the settlement fee, nor the sales tax, nor the brokerage rule's 3% transfer fee, which the spec calls "the one way to move money untaxed by freight".
- **It counts as the receiver's profit:** the claim is booked as the poster's revenue. `operatingResult` reads that for the airdrop's beta-profit share, and the logbook reads it for its profit milestones (profit100k, profit1m).

**Who can do it:**
- **The receiver** needs a facility (the businesses layer, game day 28, about 7 real days after the restart) or a brokerage (day 91).
- **The payer** can be any carrier with one truck.
- **Two accounts are needed:** two players, or one person with two accounts (the identity hole the brokerage rule leaves to the server). One owner's own two companies send the claim to the sink.

**Fix (two lines in `claimOn`):**
1. A cancel claim always goes to `sink:service_failure`. A release costs the poster nothing, because the load is back on the board. This alone ends the repeat on one load.
2. No claim takes a carrier below its free FD. Anything over that goes to the sink, or isn't charged.

**Optional:**
- A carrier can't book again a load it released.
- A claim received isn't operating revenue for the profit readers.

The no-show and late claims stay as they are (one per load, and a real loss to a player poster), under the overdraft cap.

## 2. The mid-leg town night adds its detour every hour of the night

**The bug:** in `moveTrucks`, the night's branch runs every hour while the truck is off duty. On the mid-leg branch, `nightInTown` (which adds the miles there and back to the leg) is called before `parkForTheNight`, and only `parkForTheNight` has the once-a-night guard (`restShiftT === shiftStartT`). So each off-duty hour adds another detour.

**What compounds it:** each detour also lengthens `legMiles`. `truckLatLon` then places the truck further back on its straight line, and the next hour measures from there.

**Engineering's test** calls `nightInTown` once, directly, so it can't see this.

**Probe (cases F and G, seed 11, every carrier set to the town to read the geometry; no bot chooses it in play):**
- **Repeated additions:** 255 of 1,174 town nights added the detour again in the following hours (p90 20 hours in a row, max 45: a weekly restart).
- **One loaded truck:** its leg grew from about 1,150 to 1,475 mi in six hours, with 636 mi still to go.
- **Each addition alone** is often far: 17,771 additions in a week, one way median 18 mi, p90 149, p99 617, max 986. 2,286 were over 100 mi, and 2,229 of those on loaded trucks.
- **Why so far:** the town is the nearest place "not ahead" of a straight-line point between the leg's ends. That point can sit over the Gulf or a desert, and nothing caps the distance.

**Who it hurts:** a player who picks "town" in good faith, through fuel, wear, pay and hours. Under windows those hours become late claims (20%) and spoiled reefer loads. Nobody gains. Bots never choose the town, which is why the economy's identity check saw nothing.

**Fix:**
1. Guard `nightInTown` with the same once-a-night test, or call it after `parkForTheNight`'s guard.
2. Cap the detour: over a few dozen miles each way, the night stays on the shoulder as before.
3. Optional: find the town from the road's point (`legMile` on the route), not the straight line.

## 3. Rule H is bypassed by booking a pickup after the days off

**The rule:** H refuses a hand booking for a resting hired driver unless "the pickup comes after the days off end" (`homeBlock` compares the load's `readyT` with `homeUntilDay`).

**The bypass:** an idle truck's booking starts the job at once (`assign`, then `startJob`). The truck leaves home, reaches the shipper, and waits there "loading" until the load is ready. `dailyDrivers` counts home only for a truck standing idle, parked or in the shop within the home radius, so every day off after that is lost.

**Probe (case B, seed 11):** a bot fleet's truck stood idle at Milwaukee, with its driver home until Mon 00:00.

| booking | result |
|---|---|
| a pickup before Mon 00:00 | refused ("…home until the days off end") |
| load #17700 at Elmwood Park, 93 mi away, ready Mon 07:00 | allowed; the truck left that day |

Over the next four days the truck stood "loading" at Elmwood Park. The driver had 0 rest days, and days away went 1, 2, 3, 4.

**Two sides of it:**
- **The bypass:** a hired driver called out in the middle of the days off.
- **The trap:** an honest player who reads the board's line ("Ana is home until Thu 00:00; this pickup is Wed 14:00") and books a later pickup does exactly the same thing without knowing it.

**The same mechanism without H:** any idle truck that books a load ready days ahead parks at the shipper until then. This is how windows already work, but it surprises at home.

**Fix:**
- **The better one:** a resting truck's hand booking is filed as its next load (`nextLoadId`) and starts when the days off end.
- **Until that exists:** H refuses every hand booking while the driver rests (drop the `readyT` clause).

## 4. Lost NPC loads raise a hub's reference, and a carrier can lose them on purpose

**The mechanism:** a no-show is lost the same way an unbooked load is (`noShow`, then `giveUp(…, true)`).
- Its NPC freight joins the hub's lost-load memory (`noteLost`). The memory counts as open loads in the hub's ratio (weight 1, half-life 7 days).
- An AI broker's load also counts in the brokers' cover tally (`b:{hub}`).

The batch-4 comment says only NPC freight counts "so no player can post loads to be lost and raise a hub's rate". But a player can book NPC loads and not show.

**Probe (case D):** K lost loads a day were added to the Dallas vans' memory, exactly as `noteLost` adds them, from the warm start for 14 days. The table compares days 8 to 14.

| Dallas, NPC vans | seed 11 · K = 0 | seed 11 · K = 3 | seed 11 · K = 10 | seed 12 · K = 0 | seed 12 · K = 3 |
|---|---|---|---|---|---|
| reference, FD/mi | 4.38 | **5.63 (+28%)** | **6.36 (+45%)** | 3.65 | 3.88 (+6%) |
| ratio (clamp 6) | 2.79 | 4.75 | 6.00 | 1.68 | 2.29 |
| memory | 17.6 | 36.5 | 83.2 | 9.2 | 24.2 |
| loads a day | 11.7 | 12.0 | 11.7 | 11.6 | 11.6 |

**The cost:** a no-show claim of 25% of the booked pay.
- The memory counts every lost load as one, so a ring loses the cheapest: Dallas's cheapest open van loads paid 1,760 to 2,400 FD, so a claim of 440 to 600 FD.
- Three a day cost 1,300 to 1,800 FD.

**The gain:** on seed 11 that buys about +1,000 FD on each of Dallas's ~9 other NPC van loads a day. A fleet hauling two or three of them a day breaks even. On seed 12 it doesn't pay.

**What the probe leaves out:**
- It doesn't remove the lost loads from the board. A ring's bookings do, which tightens the hub further.
- It doesn't count the second lever: a quarter of the AI brokers' loads lost at a hub in a week sends every brokered tender there to the board. Those tenders pay the board's memory-lifted reference instead of the memory-free contract less the margin.

**Who pays:** the cap. When it binds, that means carriers at other hubs, plus the AI brokers (fall-off charges).

**Fix:** set a flag on a load when it is booked (`assign`). In `giveUp`, a flagged load joins neither the memory nor the brokers' tally. The memory then reads only freight nobody took. A load released in its last hours and lost unbooked is flagged too.

## 5. Rule C measures "toward home" from the leg's origin

`homeBlock` passes the truck as it stands to `homeward`, which reads `t.hub`, the origin of the leg in hand. The dispatcher passes the truck as it will be free (`dispatchPlan`'s `at`).

**Probe (case C, seed 11, day 20):**
- Hired drivers on a job were set past due under the player's default home rule (21 days). Bots carry no home rule, so it was added for the reading.
- Of 3,031 bookings ahead those trucks could make, **589 pass C by hand while the dispatcher's own test says they lead away from home**.
- Example: a leg from MSP (995 mi from home) to MEM (448 mi). A load MEM to ABQ ends 741 mi from home, and passes because 741 ≤ 995 − 100.
- One was booked ahead by hand: accepted.

**Fix:** for a truck on a job, `homeBlock` measures from `freeOf`'s place. One line.

## 6. The fee: a brokerage's tender to its own carrier pays nothing on the whole haul

**Where it charges:** `deliver` charges the carrier on `paid`, with the buyer `load.brokerId ?? …`. `samePerson(carrier, its brokerage)` returns 0.

**Where it doesn't:** what the NPC shipper pays the brokerage is never charged, for any broker. So the three chains for the same haul pay:

| chain | fee |
|---|---|
| NPC direct | 1% |
| an AI broker's load | 1% (the carrier's leg) |
| a player brokerage's load to a stranger | 1% |
| a player brokerage's load to its own carrier | 0 |

**What follows:**
- A carrier that forms a brokerage and tenders to itself saves the economy's 79 FD a truck-week on that freight.
- Legal brokers' margins are never charged, while a double-broker's spread is.
- `samePerson` is set only between a carrier and its own brokerage at formation, so two people can't share it, and it launders nothing between them.

**Fix:** when the payer is the hauler's own brokerage, charge the haul once anyway (or charge the brokerage on what the shipper paid it). Keep `samePerson` for capital transfers.

## 7, 8 and smaller notes

**7. The breakdown's ask** (`afterBreakdown`):
- Any release while the ask stands is at the early share (10%), even in the last hours. The ask stands until it is answered, the job starts, or the pickup closes.
- So a load booked ahead with no slack, then a breakdown, is an option to hold it to the close and drop it for 10%.
- Low; the fix is in the table.

**8. Rule I** (`seatPaidDrivers`) doesn't check `homeUntilDay`. A driver unseated during the days off can be seated into an empty truck. The truck then reads as resting: the dispatcher skips it and H refuses it. From the code; not run.

**The release shares, for the economy:** with two rounds a day and `urgencyRounds` 4, a load is "urgent" for its last 48 hours.
- A first-come load (48 hours to the close) is urgent from the moment it's ready.
- A same-day load is urgent from posting.
- So the early 10% applies only to loads two or more days out. Most releases pay 25%.

## What came back clean

- **The fee's refund on a player shipper's paper:**
  - It is capped at the fee paid, pro rata on the part lost.
  - It applies only while the carrier still holds the paper, through one write-off path.
  - `unburn` gives back only from the fee's own tag.
  - A ring could only trade a shipper's wind-up for 1%.
- **The fee's other exemptions:**
  - Laundering a truck through the NPC costs the lot's haircut and markup, far over 1%.
  - A company's own freight (and the goods its facility sells to the NPC market) pays no fee end to end. That is by the spec, and it is not a channel between people.
- **Early delivery:**
  - No path cancels an order (`w.orders` loses one only at delivery or at the lease swap), so a fee can't come back.
  - Taking slots gains nothing. In the restarted world's first weeks the floor is 2 slots a week, so a griefer could hold a week's slots for two fees plus a trailer's resale loss: a nuisance.
- **The same-day premium:** it applies to NPC loads at posting, and a release reopens the load as it stands. Nothing found.
- **A player brokerage's holds:**
  - The window opens at the hold's end with the lead it was drawn with, and the margin cap holds.
  - Held tenders count as open demand in the ratio, as they did before windows.
  - Nothing new.
- **Booking ahead to block rivals:**
  - It is one load ahead per truck, at 10% or 25% for each release.
  - Players see every lead day, while the bots' dispatcher looks 12 hours ahead, so players get first pick of long-lead loads. An edge, not a hole.
- **Rule C by deleting the home rule:** the driver's days away still build fatigue, and the player pays for it.

## Files

- **The probe:** `…/scratchpad/b250/probe_wsim.ts` (the red team's scratchpad; not in the repo), run with `--root <worktree> --case A|B|C|D|F|G [--k N] [--seed N]`.
- **The gated runner:** `run-b250.sh`, beside it.
- **The logs**, beside it:
  - `probes1.log`: B; D at K 0, 3 and 10; F. Its case A misfired: the truck stood idle.
  - `probes2.log`: A; C; D on seed 12; F's split.
  - `probes3.log`: G.
- **The worktree** `…/scratchpad/wt-b250` is removed.
