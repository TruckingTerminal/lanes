# Economy review: the used lot's cadence, the Reserve, the hoarding rule, cash now, and two rule questions (2026-11-02)

Economy designer, for the producer. These are Jeff's decisions of today, in the producer's order: the used lot
first, because it blocks step 9, then the Reserve and the hoarding rule. Two rule questions close it.

Nothing is committed. Live levers, the ruleset and the config version are untouched. Every new rule sits behind a
switch that defaults off. With them off, the tree reproduces the v59-a run to the byte (a 240-day check, seed 3).

## 1. The used lot's cadence (step 9)

**The question.** QA's phone replay found the NPC used lot empty for a whole session. A lessor at step 9 (day ~52)
held 20.4k cash and a 15.9k deposit credit. On a loan, the cheapest new rig needed 56.8k and a tractor alone 43.7k.
Eight weeks later its cash had stalled near 25k while list prices rose.

**The measure.** A diagnostic (`apps/sim/src/diag-lot.ts`, scratch only) runs the live profile for 150 days. It
records, day by day:
- the lot's stock and price;
- every free-path lessee that could buy the lot's rig on a purchase loan: cash and deposit credit over the down
  payment, the loan's stake, the tax and a 1k buffer;
- when each lessee owned a truck.

There are five seeds of today's lot, and three of each variant (`runs/v59-lot`).

**Today's lot can't serve step 9.** It holds 30 rigs and takes in 15 a week, all at once at the week's end.

| Today's lot (`perWeek` 15, `stock` 30, weekly) | |
|---|---|
| Lot price at day 52 | 48.9k: about 15k cash on a loan, well inside the QA lessor's 36k |
| Lessees who could buy it on a loan | 393 of 400, from day 12 (median) |
| Lessees still waiting at day 52 | 320 |
| Lot empty, days 28–149 | 59% of days; a rig on the lot in 45% of weeks |
| Empty spells | median 69 days, longest 83 |
| Stock at day 52 | 0 on all five seeds |
| A lessor arriving on days 40–90: wait for a rig | median 35 days, p90 56; within a week only 4% of the time |
| First owned truck, day-0 owner-operators | p25 day 28, median day 42, p75 day 63 |

Price isn't the problem; supply is. Every lessee wants the cheapest rig, the whole free path can afford it within
two weeks, and 15 a week can't keep up. What QA saw follows from that. With the lot bare, the only other truck is
the dealer's, at 57k cash on a loan and rising. The used board is thin early.

**The variants** (a rig counts as "on the lot" if it is there at a day's end):

| Variant | Empty days | Weeks with a rig | Arriving days 40–90: wait median / p90 / within a week | Stock at day 52 | First owned truck p25 / median |
|---|---|---|---|---|---|
| Today: 15 a week, 30 | 59% | 45% | 35 / 56 days / 4% | 0 | 28 / 42 |
| L1: 30 a week, 60 | 34% | 71% | 4 / 25 / 57% | 0 | 21 / 35 |
| L3: 30 a week, 60, daily | 32% | 69% | 2 / 24 / 61% | 0 | 17 / 35 |
| **L2: 60 a week, 120** | **6%** | **98%** | **0 / 0 / 100%** | **101–115** | **13 / 21** |
| L4: 60 a week, 60, daily | 12% | 92% | 0 / 0 / 100% (longest 5) | 58–60 | 14 / 25 |

**Recommendation: `usedMarket.npcLot.perWeek` 60 and `usedMarket.npcLot.stock` 120, as live levers.** It is the
smallest change on the existing keys that keeps a rig on the lot in practically every week. A day-52 lessor finds
one on arrival on every seed, at a price its deposit credit and a loan reach. No new code is needed, and the
first-truck loan's down payment can stay.

- The daily cadence (`usedMarket.npcLot.daily`, new, default off) does the same with half the stock (L4). It stops
  the lot emptying on restock day and standing bare for the six days after. It's the better shape if Jeff wants a
  smaller lot; it isn't needed for step 9.
- The lot only replaces NPC leases with owned rigs, so it adds no capacity. Its sales are sinks.
- **A four-year check of L2** (`runs/v59-lot2`, seeds 1–3, against the same seeds of v59-a) passes:

| Seeds 1–3 | Today's lot | L2 |
|---|---|---|
| Free path: median days to an owned truck | 43 | 24 |
| Lot sales over four years, a seed | 340 | 513 |
| Purchase loans made | 82.0M | 72.7M |
| Board cleared rate | 3.946 | 3.940 |
| Rate dial (rateMult) at day 365 / at the end | 0.62 / 0.51 | 0.60 / 0.51 |
| Population dial: entrants; days over / under the band | 30; 39 / 10 | 45; 67 / 7 |
| Sinks ÷ faucets: whole run; after the launch | 90.5%; 95.7% | 90.2%; 95.7% |
| Supply at the end (ceiling) | 57.7M (62.4M) | 58.8M (60.5M) |
| Liquidations | 377 | 379 |
| FD price at the end | $0.00094 | $0.00108 |

  Nothing fails. A used lot rig replaces a new truck on a loan, so lending falls by a tenth. Lessees own trucks
  sooner, so freight runs a little tighter per truck, and the population dial lets in 15 more entrants over four
  years. The prudent-against-greedy ranking doesn't move.

**A good owner-operator's first truck.** Bots that play the free path well, with the dispatcher waiting for the
first bid by hand and the factoring contract on, are ready to buy the lot's rig on a loan by about day 12. With L2
they own one by day 13 (p25), the median by day 21. Today the p25 is day 28, and a lessor who reaches step 9 at day
52 waits until about day 87. On the dealer's new rig alone, with no used truck, the QA lessor's numbers say a good
player is still short at day 108.

## 2. The Reserve

**The rule as built** (`packages/engine/src/cashReserve.ts`, new). Switch: `cashReserve.enabled` (off), with
`capWeeks` 13 and `settleDays` 1.

- **An account beside cash** (`co:cashreserve:<id>`). A deposit (`reserve_deposit`) is instant. A withdrawal
  (`reserve_withdraw`) is free and lands in cash the next day.
- **The shelter.** Up to the cap, 13 × the company's average week of spending (the `weeklySpend` weeks the
  working-capital rule reads), the Reserve is exempt from the weekly holding cost and the season close's burn. Above
  the cap both apply as they do to cash.
- **The week's lowest balance decides the shelter.** A first deposit counts from the next week, and a withdrawal
  lowers the week's mark, so cash can't dip in for the weekly check.
- **No yield.** It counts toward the credit score's cover as capital (`credit.ts`). It can't be pledged, staked or
  posted as a bond, because those draw only on cash.
- **Two things put it back in cash:** the launch reset, where it's beta FD like the wallet beside it, and a
  liquidation, where its creditors come first.
- **Reports and tests:** `report.cashReserve` gives what is held by persona, its cap, and what it paid in holding
  cost and burns. Tests: `packages/engine/test/reserve.test.ts`.
- **The prudent bot** keeps its cushion there, up to the cap. It keeps two weeks of spending in cash for the bills,
  and draws on the Reserve when cash falls under half that.

**The pair with the Reserve on** (`runs/v59-r`, ten seeds, against v59-a):

| | After (v59-a) | Reserve on (v59-r) |
|---|---|---|
| Prudent net worth: all / owner-operators / fleets | 63k / 44k / 128k | **74k / 51k / 152k** |
| Greedy net worth: all / owner-operators / fleets | 99k / 31k / 335k | 99k / 35k / 321k |
| Seeds prudent richer in net worth: owner-operators / all | 9 / 0 of 10 | 10 / 0 of 10 |
| Prudent liquidated: owner-operators / fleets | 17% / 41% | 20% / 35% |
| All-in, a prudent / greedy company | $166 / −$78 | $156 / −$56 |
| Held in Reserves at the end | – | 3.15M (prudent owner-operators 13.4k each against a 122k cap; fleets 20.6k against 149k) |
| Holding cost / burns taken from it | – | 0.37M / 0.34M (deposits made the week before the close, and over the cap) |
| Season-close burns, all | 45.0M | 42.2M |
| Holding cost, all | 2.92M | 2.46M |
| Operating sinks ÷ faucets: whole run / after the launch | 90.8% / 95.8% | 90.7% / 95.3% |
| Post-launch months inside the live target [1.0, 1.04] | 7.9% | 10.8% |
| Rate dial (rateMult) at the end | 0.51 | 0.52 |
| Supply at the end (ceiling) | 58.2M (61.9M) | 61.8M (64.5M) |
| Liquidations | 366 | 347 |

**Does prudence win with it?** Not yet in FD, but it gets closer.
- The Reserve lifts the prudent bot's net worth by 17% and cuts the pooled gap from 36k to 25k.
- Prudent owner-operators beat greedy ones on every seed.
- Prudent fleets are liquidated less often (35%, against the greedy fleets' 32%).
- The greedy fleet's lead is still its outside dollars (`economy-prudence.md` §2).
- All-in the prudent bot still wins on every seed.

**The sink-to-faucet target.** The Reserve moves the after-launch ratio by half a point (95.8% to 95.3%). The live
target [1.0, 1.04] wasn't met before it either: the after batch sits inside it in 8% of post-launch months, the dial
pinned at its 0.5 floor. The Reserve keeps 2.9M FD from the burns, about 6% more supply at the end, still under the
supply ceiling.

**The cap.** 13 weeks doesn't bind the prudent bot: its cushion fills a tenth to a seventh of it. The cap matters for
a player who hoards. At the end of these runs, every company's cap together came to 85.9M, more than the whole supply
(61.8M). So the cap, not the bots, decides how much of the supply could escape the burn. Two sizes:

- **13 weeks, Jeff's proposal: keep it, with the year-end burn.** No yield means sheltered FD earns nothing, so a
  hoard costs its owner its use. The supply ceiling's path holds, and the Reserve moved supply 6% in the batch.
- **8 weeks, if the beta shows hoarding.** It still covers the prudent cushion twice over and cuts the world's
  possible shelter to about 53M.

I didn't run the 26-week probe. Since the bots fill a seventh of 13 weeks, it would change nothing for them.

**The red team's E3-CAPINFLATE (fixed).** A refundable NPC lease deposit counted as spending: it was paid into a sink
(`sink:lease_deposit`, ref `deposit:`). So it raised the weeks of spending that set working capital and the
Reserve's cap, with FD that comes back. 182k of deposits gave 1.10M of shelter.

The fix: `ledger.ts` leaves `deposit:` out of the outflows that make `weeklySpend` (`NOT_OUTFLOW`).
- The lock rules don't change: a deposit still spends locked FD first.
- It applies with or without the Reserve. The working-capital half of the hole was there before the Reserve, so it is
  a base change for the ruleset bump.
- A lessee's protected working capital no longer counts the deposit weeks.

## 3. One hoarding rule: the holding cost in place of the year-end burn

**The rule** (no new code beyond a switch): `seasonClose.burn` (new, default true). False keeps the close's purchase
lock, reputation decay and Miles snapshot, but burns nothing. `holdingCost.withSeasons` true puts the weekly holding
cost (2% a week on cash over working capital) on through the beta too. Batch `runs/v59-h`: ten seeds, the Reserve on,
both switches set.

| | Burn (v59-a) | Reserve on (v59-r) | Hoarding rule (v59-h) |
|---|---|---|---|
| Season-close burns / holding cost | 45.0M / 2.9M | 42.2M / 2.5M | 0 / 47.9M |
| Operating sinks ÷ faucets by year | 82 · 92 · 96 · 96% | 82 · 93 · 95 · 95% | 85 · 94 · 92 · 94% |
| After the launch; months inside [1.0, 1.04] | 95.8%; 7.9% | 95.3%; 10.8% | **92.8%; 3.8%** |
| Supply at the launch (day 729) | 47.2M | 50.0M | **65.8M** |
| Supply at the end (ceiling) | 58.2M (61.9M) | 61.8M (64.5M) | **84.9M (76.6M)** |
| Post-launch days over the ceiling | 4% | – | **28%** |
| Rate dial at the end | 0.51 | 0.52 | 0.58 |
| FD price at the end | $0.00110 | $0.00111 | **$0.00074** |
| Liquidations | 366 | 347 | **261** |
| Prudent / greedy net worth | 63k / 99k | 74k / 99k | **106k / 112k** |
| Prudent / greedy fleets liquidated | 41% / 30% | 35% / 32% | 25% / **50%** |
| Seeds prudent richer, all / owner-operators | 0 / 9 | 0 / 10 | 3 / 8 |

**What it does to prudence.** It is the closest prudence comes to winning in FD:
- 106k against 112k pooled;
- prudent owner-operators richer on eight seeds of ten;
- the greedy fleets liquidated half the time, against the prudent fleets' quarter.

A weekly charge on idle cash punishes the hoard gently and every week. The year-end burn takes it all at once, and
it takes it from whoever happens to be holding cash that day.

**What it does to the money: the target doesn't hold.**
- After the launch, sinks cover 92.8% of faucets, against 95.8% today. The live target is met in 4% of months.
- Supply reaches the launch at 65.8M instead of 47M and ends the four years at 84.9M: 46% more than today, and 11%
  over the published ceiling. It sat over the ceiling on 28% of post-launch days.
- The FD price ends a third lower.
- The balance dial can't pull it back. The ceiling's dial won't take NPC rates under their launch level
  (`supplyCeiling.rateFloor` 1), and the holding cost, though it collects about what the burns did (48M against
  45M), takes it slowly: 2% a week of the excess, against all of it once a year.

**Recommendation: keep the year-end burn.** The hoarding rule is the right shape for prudence, but not at today's
holding cost. To hold supply on the path it would need a holding cost roughly two to three times today's, or the
burn kept after the launch. Neither is sized here.

My order: the Reserve at 13 weeks, with the burn, now. The hoarding rule only with a sized holding cost and a batch
of its own.

## 3a. Cash now: any open invoice, cashed today

Jeff: "If a carrier needs it now, he needs it NOW. Waiting would cause them to go bust regardless of the contract."

**The rule** (`packages/engine/src/receivables.ts` `cashNowRate`, `cashInvoice`; the `cash_invoice` action). Switch:
`token.payment.cashNow.enabled`, off.

- **What can be cashed:** any open invoice a company holds can be sold to the NPC factor today.
  - The fee is a sink (`sink:factoring_fee`). The factor collects at the due day as it does factored paper.
  - Only paper that can't leave the factor unpaid: an NPC shipper's (it always pays), or a broker's (its bond and AP
    cap stand behind it, as today).
  - Refused: a player shipper's paper (no bond), paper between one owner's two companies (never factored), paper due
    today, and a company being wound up.
- **The price** is a share of the invoice's face:

| Paper | Rate | Aging surcharge |
|---|---|---|
| Under a factoring contract | the contract's own rate (6% at one truck down to 2.5%) | + 0.1% a day since the invoice was raised, at most + 3% |
| Without a contract | **8% spot** (`spotPct`), above the contract's 6% at one truck and the broker's flat 5%, under quick pay's 10% at delivery | the same |

- **Why aging grows with the invoice's age.**
  - It prices the factor's risk the way aging buckets do: an invoice held unsold for weeks is the one its holder
    wasn't sure of.
  - It tells a carrier that needs the cash to take it when it delivers, not to wait and see.
  - The guide's "collect" lever (the director's rule 1, "oldest first") should therefore offer the **freshest**
    invoices that clear the line, not the oldest: under this surcharge the oldest cost the most. The director and
    the writer should know before the strings settle.
- **The bots** (any carrier) cash their freshest invoices once their cash goes under zero, until they are 2,000 clear.

**Does it keep an honest operator out of the wind-up during the invoice gap?** Yes, where there is a gap.
`apps/sim/src/diag-cash.ts` (scratch) follows every day-0 owner-operator from its first owned truck: 180-day runs,
seeds 1–5, `runs/v59-cash`.

| Five seeds, about 1,800 first trucks | In the red some day of the first 60 | Red truck-days | Liquidated within 90 days | Cash now: invoices / face / fees |
|---|---|---|---|---|
| Live profile (contract on), cash now off | 4.0% | 492 | 1.4% | – |
| Live profile, cash now on | 3.9% | 509 | 1.6% | 130 / 361k / 28.6k |
| **Net terms (the contract and quick pay declined), off** | **10.5%** | **3,259** | **6.3%** | – |
| **Net terms, cash now on** | **5.2%** | **500** | **1.3%** | 4,165 / 14.1M / 1.17M (8.2%) |

- **Under the live profile the factoring contract already closes the gap.** The bots sign it when cash runs thin, and
  it buys every invoice on delivery, so cash now is barely used (26 invoices a seed) and changes nothing.
- **For an owner on net terms**, the player who declined the contract, which is QA's step-9 lessor:
  - the first month on its own truck sends one in ten into the red and one in sixteen into a wind-up within 90 days;
  - with cash now, red truck-days fall by 85% and wind-ups to 1.3%, the contract's own level;
  - the cost is 8.2% of what it cashes, about 640 FD per new owner across all of them, against a truck lost.

That is Jeff's "NOW".

**Can anyone farm it?** No. The probe (`apps/sim/src/redteam/cashnow-probe.ts`, scratch, on the red team's harness,
seed 1, 200 days) runs two worlds:
- in A, every carrier cashes every invoice it can, every day;
- in B, the bots use cash now only in the red.

| | A: everyone, every invoice, daily | B: only in the red |
|---|---|---|
| Invoices cashed | 5,986 (34.2M face) | 6 |
| Fees (a sink) | 2.76M | 0.0M |
| A second cash of the same invoice | refused, 5,986 of 5,986 | – |
| The harness's invariants (money conserved, the cap identity) | 0 breaks | 0 breaks |
| Carriers' cash / supply at day 200, A − B | +1.44M / +1.71M | |

- **Cashing never adds FD.** The factor's advance is the same mint the shipper's payment would have been at due, only
  earlier, and the fee is a pure sink.
- **A − B is timing, not a gain.** At the day-200 snapshot, A holds as cash the 30 days of invoices B still holds as
  paper, less 2.6M more of fees. Everyone cashing everything costs 8% of revenue for a month's head start.
- **"Cash, re-deliver, cash" has nothing to loop.** An invoice is raised once per delivery, and once cashed it is the
  factor's: refused on every second try.
- **The two loops that could have paid are closed by eligibility:**
  - a player shipper's paper (a colluding shipper never paying the factor) can't be cashed;
  - neither can own paper.
- **Broker paper is safe for the factor.** The bond pays it first and the AP cap keeps it inside the bond. In the
  launch batch only 10k a seed went uncovered, and none with the kept bond paying first.

**The pair** (`runs/v59-n`, seeds 1–5, the live profile with cash now on, against the same seeds of v59-a). Under the
live profile the contract does the work and cash now changes little:
- prudent net worth 62k against 60k, greedy 103k against 90k;
- liquidations 387 against 383;
- sinks ÷ faucets 90.7% in both, and supply 1M higher at the end.

The greedy figure moves on five seeds, and I wouldn't read it as an effect.

**Sizes:** `spotPct` 8%, `agingPerDay` 0.1%, `agingCap` 3%; under a contract, the contract's rate plus the same
aging. `botsNetOnly` is the batch's scenario switch, not a rule. My recommendation: switch it on with the next bump.
It costs nothing to honest operators who don't need it, it brings a declined contract's wind-up rate down to the
contract's, and it can't be farmed.

## 4. Two rule questions

**A hand bid whose load leaves the board before the round: should the engine report it?** Yes.

Today `manualRoundBids` (board.ts) drops the bid silently when its load is gone (booked on book-now by someone else,
expired, or tendered away) or when the truck is no longer idle. The player sees nothing, and the truck sits out a
round, about half a day of idle cost. Worse, `place_bid` has already set `firstHandBidDay`, so for a new player
(`freeEntry.firstBidByHand`) the dispatcher starts as if the owner's first call had happened. The money is small; the
confusion falls exactly on a new player's first bid.

My rule:
- a notice on the board topic, "Load #x left the board before the round; your bid for truck N didn't go in", with
  the reason;
- the hand-bid mark (`firstHandBidDay`) set only by a bid that entered a round, or by a booking.

There's nothing to size.

**A truck parked on the shoulder when no legal site is within the day's hours: should it plan an earlier stop?** Yes.

`planNight` (sites.ts) already stops a truck early at the last site with room the hours reach. But it reads the
reach from the hours left times an average pace, and it plans nothing when the leg's end seems within the hours.
A slower leg (grades, the speed policy, a breakdown) runs out of hours short of the next site. On v59-a that is:
- 9.4% of all nights on the shoulder: 20 a truck-year;
- a third of them ticketed at 250 FD, 6.6 tickets and about 1,650 FD a truck-year;
- 4.9M FD a seed over four years, 0.3% of all sinks.

An honest driver pays it for the planner's optimism, not for a choice it made. My rule:
- plan with the leg's real pace and a margin, e.g. 90% of the miles the hours reach;
- when no site with room lies inside that, stop at the last one passed if it is within the day's last two hours.

Only when neither exists does the truck park on the shoulder, and then the ticket stays. The sink loss is under a
third of a percent, so the rate stabilizer won't notice it.

## Files

- `packages/engine/src/cashReserve.ts` (new): the Reserve. Hooks in `solvency.ts` (holding cost, liquidation),
  `season.ts` (the close, and `seasonClose.burn`), `token.ts` (the launch), `credit.ts` (capital), `step.ts` (daily
  settle, weekly low), `report.ts` (`cashReserve`), `actions.ts` (`reserve_deposit`, `reserve_withdraw`), `types.ts`
  and `world.ts`.
- `packages/engine/src/receivables.ts`: cash now (`cashNowRate`, `cashInvoice`), with the `cash_invoice` action
  (`actions.ts`, `types.ts`).
- `packages/engine/src/dealer.ts`, `step.ts`: the used lot's daily cadence (`usedMarket.npcLot.daily`, off).
- `packages/config/src/economy.config.ts`: `cashReserve`, `seasonClose.burn`, `token.payment.cashNow`,
  `usedMarket.npcLot.daily`, all off or unchanged.
- `packages/agents/src/ruleBots.ts`: the prudent bot's Reserve, bots cashing invoices in the red, and the net-terms
  scenario.
- Tests: `packages/engine/test/reserve.test.ts`, `packages/engine/test/cashnow.test.ts` (new).
- Scratch only, not in the tree: `apps/sim/src/diag-lot.ts`, `diag-cash.ts`, `diag-prudence.ts`, `diag-rates.ts` and
  `redteam/cashnow-probe.ts`, in my worktrees.
