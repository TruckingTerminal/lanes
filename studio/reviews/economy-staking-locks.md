# Economy review: staking locks, and truck prices as the entry fee (2026-11-02)

Economy designer, for the producer. Jeff: "I see that we require staked FD to grow the fleet, to buy more assets. Is
this a good idea or should we just keep truck prices as the entry fee? Staked FD should give discounts on things
purchased based on the time locked, for the duration of the lock, with early withdrawal incurring a large slash
penalty that is burned, the slash is a multiple of discounts used and then some."

Nothing is committed. Live levers and the ruleset are untouched. Batch: v58-a against v57-0, two years, seeds
1, 4, 8 (`runs/compare-v58.md`).

## 1. The answer: truck prices are the entry fee

The stake tiers (20k FD to run ten trucks, 100k for thirty) gate a growth path that is already expensive:

- trucks at 140–214k new or about 48k used, bought on loans priced by credit;
- a yard past five trucks: 60k plus a 30k bond for ten, 250k plus 100k for thirty;
- a maintenance manager from the fifth truck and an operations manager from the eighth;
- the fleet overhead.

A stake on top of that is a second entry fee that buys nothing. In the beta it makes no difference either: the AI
fleet is capped at its starting size. In v58-a, with the gate gone, the largest fleet after two years was seven
trucks and one carrier ran more than five. The managers, the yard and the cap bind, not the stake.

What the tiers did well was give FD a reason to be bought and locked. The locks keep that reason, and make it
voluntary. The broker licence stake stays: it is a bond, and under the factoring contract it backs a broker's
payables.

## 2. The rule as built

**Switch:** `token.staking.lockDiscounts.enabled` (off), under `token.staking`. With it on:

- **No size gate.** `truckCap` and `facilityCap` ignore the tiers, `nextTruckTier` returns none, and nothing parks
  for being under a tier. The operations managers' cap stays.
- **A stake may be locked for a term** (`stake_fd` with `months`, and `roll` to renew). A plain stake with no term
  stays a stake: the broker licence, the AP cap's bond, and the slash on revocation are all unchanged.

| Term (game months) | Discount | Budget: the most it can give over the term, as a share of the lock | As a yearly yield |
|---|---|---|---|
| 1 | 3% | 1% | 12% |
| 3 | 6% | 4% | 16% |
| 6 | 9% | 10% | 20% |
| 12 | 12% | 24% | 24% |

- **The discount** holds for the whole term on everything the tier discounts covered: fuel (on the road, idling,
  at a site, the reefer unit), maintenance, rebuilds, refurbishments, insurance premiums and board fees. It also
  covers NPC purchases: the dealer's tractors and trailers, the used lot, and the catalogue (yards, upgrades, yard
  security). Player dealerships' sales are transfers and carry no discount.
- **The budget** caps every discount, so a small lock can't take 12% off a fleet's spending or a 214k truck: a 5k
  lock gives at most 1,200 FD. With several locks, the best rate with budget left applies.
- **Leaving early** (`unstake_fd` with `breakLocks`) burns a slash of `discountMultiple` 2 × the discounts the lock
  has given, plus `baseShare` 10% of the lock, capped at the lock. It goes to `sink:lock_slash`, a forfeit burn
  added to the ledger's burns and the report's. The rest is ordinary stake. Locks break soonest-ending first, only
  until the FD asked for is free, and FD still under a lock never leaves.
- **At term end** a lock rolls at the term's then-current discount with a fresh budget, or matures into free stake
  that leaves with no slash.
- **The exit queue and the instant haircut stay, for stake that is free:** a matured lock, a broken lock's
  remainder, a plain stake.
  - The queue (28 days, 2% of all stake a day) still guards against a run on the pool after the launch, which
    locks don't change.
  - The haircut (25% burned) is still the price of skipping the queue.
  - The slash is only the price of breaking a term, so an early exit through the queue pays the slash alone.
- **The tier discounts** (`staking.discounts`) don't apply while the switch is on.

**Bots** (`ruleBots.ts manageLocks`), once a week:

- A bot with cash over twice its cushion locks half the spare, but no more than its own last month of spending could
  use up the budget on. The term is the persona's: conservative 12 months and rolling, greedy 3, the rest 6.
- Free stake goes home through the queue.
- A bot heading for liquidation breaks its newest lock, takes the slash, and leaves instantly.

**Tests:** five, at the end of `engine.test.ts`:

- The gate removed: past five trucks with no stake, while the tiers still gate with the switch off. The broker
  licence stays.
- The term's discount on a dealer truck, the budget capping a small lock's discount on a big purchase, no discount
  once the budget is spent, and a matured lock leaving with no slash.
- The slash arithmetic (2 × 1,000 + 10% of 50,000 = 7,000 burned, 43,000 to the queue), a refusal without
  `breakLocks`, the burn in the circular ledger, and that breaking costs more than it gave at every term.
- Several locks broken for one unstake, with locked FD never leaving.
- The switch off changing nothing.

## 3. Can the discount be farmed?

**Breaking early never pays.** At any term, a lock that has given discount D burns min(L, 2D + 0.1L). That exceeds
D by D + 0.1L, at least a tenth of the lock. In v58-a the 157 broken locks had given 169k FD of discounts and burned
541k.

**Holding to term earns at most the budget,** 1 / 4 / 10 / 24% of the lock over 1 / 3 / 6 / 12 months, that is 12–24%
a year. That is a fair return for FD taken out of the float, and far below what the same FD earns as a truck (3k a
week). Short locks are kept poor on purpose. A month at 3% with a 1% budget can't be used to buy a fleet cheap: to
take the full 3% off a 182k rig, the lock would have to be 546k. An earlier build applied the rate to the whole
charge that exhausted the budget, so a 5k lock could take 21.8k off a truck. Every discount is now capped at the
budget left, and tested.

**After the launch the lock is also the shelter from the holding cost** (2% a week on cash above a month of
spending). Stake accounts aren't charged, so a prudent company's cushion is better locked than held. That is
intended, and it is option D of the population review's prudence section; but it makes locks more attractive after
the launch than this beta batch shows.

## 4. What v58-a shows

| Measure (mean of 3 seeds, two years) | v57-0 (tiers) | v58-a (locks) |
|---|---|---|
| Carriers over 5 / 10 trucks at end; the largest fleet | n/a (report predates) | 1 / 0; 7 |
| Owned trucks / trucks in service at end | 615 / 648 | 594 / 670 |
| Locks made, 1 / 3 / 6 / 12 months (FD over the run, re-locks included) | | 0 / 2,912 (63.3M) / 1,309 (19.5M) / 1,030 (8.5M) |
| Locks rolled / matured / broken | | 438 / 3,258 / 157 |
| Discounts given / slashes burned | (tier discounts, not counted) | 5.8M / 541k |
| Sinks with burns ÷ faucets, whole run | 87% | 87% |
| Operating sinks ÷ faucets by quarter | 85% (75–103%) | 86% (74–99%) |
| Supply before the year-1 close | 82.9M | 93.0M |
| Liquidations / companies liquidated at least once | 327 / 142 | 339 / 150 |
| Free path: median days to a first truck; bought within 84 days | 52; 289 | 54; 279 |
| Avg wealth: owner-operator / fleet / broker | 70k / 208k / −409 | 66k / 207k / −273 |
| Token: price at launch → end (day 729 → 730) | $0.0012 → $0.0013 | $0.0010 → $0.0012 |

**What the numbers say:**

- **Everyone with spare cash locks, mostly for three months.** That is the greedy and random bots, re-locking as
  their budgets run out. The discounts they took, 5.8M FD over two years, are under 1% of the sinks: the budgets
  keep them small. The whole-run sink ratio doesn't move (87%).
- **Supply runs higher.** Locked FD still counts as outstanding (stakes do), and the discounts are sinks not taken,
  so supply before the year-1 close is 12% higher.
- **The launch burns every lock.** The batch ends on the launch day, and the launch reset burns stakes, locks and
  all, as beta FD. Locked FD at the end is 240k, and the reset's burn is 12.6M higher than in v57-0. That is the
  lean launch's rule, not a slash.
- **No fleet growth.** Removing the gate frees nothing in the beta: the AI fleet's cap holds.
- **No price path.** The beta ends on day 729, so the price moved for one day.

**Before switching it on, a four-year pair is needed** (v58-b and a control): the post-launch price, the locks as the
holding-cost shelter, and growth once the beta cap lifts.

## 5. For the producer

- **To switch it on:** `token.staking.lockDiscounts.enabled` with the ruleset bump and a restart with no players.
- **Engineering:**
  - The Money tab's stake row: term, roll, the discount and the budget left, and the slash shown before breaking.
  - The tier copy goes ("stake more to run more trucks").
  - The truck-cap notice now names the yard and the managers only.
- **For Jeff:**
  - The four terms, the discounts and the budgets.
  - The slash: 2× and a tenth.
  - Whether the minimum lock (5k) should be higher.
