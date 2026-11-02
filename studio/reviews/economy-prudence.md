# Economy review: prudent businessmen against greedy ones (2026-11-02)

Economy designer, for the producer. Jeff's decision (2026-11-02): "prudent businessmen must win in the long run over
greedy ones". Option A first: make the conservative rule bot a prudent businessman, not a timid one. Option B only if
A is not enough: loan rates that rise with debt-to-equity, and a bust covenant, behind a switch that defaults off.

Nothing is committed. Live levers, the ruleset and the config version are untouched.

**The batches.** Four years (1460 days), seeds 1–10, the sim's default live profile:

| Batch | What it runs |
|---|---|
| `runs/v59-0` | before: the old persona, at df5426a, with the new report |
| `runs/v59-a` | after: the persona below |
| `runs/v59-b` | the one tune (§4), tried and dropped |
| `runs/v59-c` | after, with option B on (§5) |

## 1. The persona change (option A)

`packages/agents/src/ruleBots.ts`, the `conservative` profile and the cycle rules it reads (`prudent: true`):

- **Prices to win.** It bids its break-even plus 15%, adapting between +8% and +60% with its win rate. It used to
  ask 97% of the board ceiling and lose loads it should have won. Its floor is break-even plus 8%.
- **Borrows only what a bust can carry.** A purchase loan goes ahead only if, after the down payment, the loan's stake
  and the tax, the cash over its cushion covers 13 weeks of every loan payment, the new one included (8 weeks for the
  first truck). No Equipment Finance borrowing, and it no longer parks cash there: it keeps it in hand.
- **Reads the cycle.**
  - At the top (the last four weeks' cleared rate 8% over the year's), it buys no trucks, businesses or
    facilities. It still runs a truck it has parked, since that puts no capital in.
  - At the bottom (8% under), it buys capacity, up to 1.5× its target fleet.
- **A larger fleet target:** 12 trucks, not 8.

What I fixed in the previous agent's diff:

- At the top it refused to unpark its own parked trucks. That leaves money on the table exactly when rates are
  highest, so it now unparks.
- The new helpers had split `worthAnotherTruck` from its comment.

**The report** (`packages/engine/src/report.ts`, `byStrategy`). Wealth as the report defines it counts what a company
holds, not what it owes, so a borrower's truck counts in full. I added, per segment and persona:

- **net worth:** wealth plus the FD locked in stakes, the exit queue, contract and business bonds and loan stakes,
  plus businesses at cost, less purchase-loan and Equipment Finance debt (mean and median);
- **dollars in and out:** the real money a paying bot put in to buy FD and cashed out;
- liquidations per company, trucks running at the end, and median wealth.

**"All-in"** (the summariser, `prudence.mjs` in my scratchpad) is net worth at the run's end price plus dollars out,
less dollars in: what an owner could walk away with, against what it brought.

## 2. The pair, before and after

Means over ten seeds. "Seeds" counts the seeds on which the prudent persona ends richer than the greedy one.

| | Before: prudent | Before: greedy | After: prudent | After: greedy |
|---|---|---|---|---|
| **Owner-operators: net worth mean / median** | 38k / 13k | 32k / 14k | **44k / 23k** | 31k / 12k |
| seeds richer in net worth | 10 of 10 | | 9 of 10 | |
| share liquidated at least once | 24% | 23% | **17%** | 23% |
| dollars in / out per company | $0 / $36 | $48 / $194 | $0 / $87 | $49 / $184 |
| all-in, in dollars | $85 | $187 | $136 | $170 |
| **Fleets: net worth mean / median** | 58k / 44k | 332k / 281k | **128k / 67k** | 335k / 254k |
| seeds richer in net worth | 0 of 10 | | 0 of 10 | |
| share liquidated | 42% | 27% | 41% | 30% |
| dollars in / out per company | $0 / $40 | $2,023 / $765 | $0 / $129 | $2,035 / $727 |
| all-in, in dollars | $116 | −$824 | **$271** | −$941 |
| **All carriers: net worth** | 43k | 98k | **63k** | 99k |
| seeds richer: net worth / all-in | 0 / 10 of 10 | | 0 / 10 of 10 | |
| all-in, in dollars | $91 | −$34 | **$166** | −$78 |

What the whole run did (per seed):

| | Before | After |
|---|---|---|
| Purchase loans made | 98.2M | 83.2M |
| Loan defaults / trucks seized | 339 / 236 | 258 / 185 |
| Liquidations | 398 | 366 |
| Free path: median days to an owned truck | 38 | 45 |
| Operating sinks ÷ faucets, whole run | 90.9% | 90.8% |
| FD price at the end | $0.00129 | $0.00110 |

**The persona change works on the persona.** The prudent bot's net worth rose 47% (43k to 63k), its owner-operators'
liquidations fell from 24% to 17%, and it now beats the greedy owner-operator in the game on nine seeds of ten.

**It doesn't make the prudent fleet richer than the greedy one in FD, on any seed.** The greedy fleets end with 2.6×
the prudent fleets' net worth (335k to 128k).

**Counted with what each owner brought, prudence wins everywhere it matters, before and after.** Each greedy fleet
puts in $2,035 to buy FD: to grow, to post stakes, and to buy its way out of the red before a liquidation. At the
launch price that is about 1.1M FD, eight times the prudent fleet's whole net worth. It takes $727 back out and ends
holding FD worth about $370: an owner $941 down. The prudent fleet puts in nothing and ends $271 up. Pooled, prudent ends
richer all-in on ten seeds of ten.

**The one place greed wins all-in is the owner-operator's FD.** The greedy owner-operator sells everything over its
reserve every week, while the price falls 40% over the two years after launch. The prudent one keeps 70% of its spare
FD in the business. That is a trading result, not a business one, and the token's price path decides it.

## 3. Why the greedy fleet still ends richer in FD

A per-quarter diagnostic of seed 1 (after) shows how it happens:

1. **Outside money.**
   - The greedy fleets put $428 each in during the beta (the dollar window for rigs) and $1,600 more after the
     launch.
   - Their liquidation share (30%) is held down by buying FD whenever they fall into the red.
   - The prudent fleet has no such backstop.
2. **The prudent fleet shrinks with cash in hand.** It runs 3.4 owned trucks on day 90, 1.9 at the end of year one
   and 0.5 at the launch, while holding 150–230k FD. Two things shrink it:
   - The weekly right-sizing sells an idle truck from any fleet whose trailing profit per truck falls under its
     overhead bracket. That bites harder at the prudent bot's thinner margins.
   - Its growth gates rarely open together: the cycle phase, idle trucks at most 30%, the profit hurdle and the
     dealer's 60-day lead-time limit.
3. **Cash burns.** The year-end close keeps only four weeks of spending, and the launch reset does the same.
   - Prudent fleets lost about 90k FD each at the first close and about 100k at the launch.
   - The greedy fleets lost as much, but rebuilt with dollars.

**Option B can't touch this.** The gap isn't bought with debt: greedy fleets carry 30–50k of purchase loans, not
hundreds of thousands. What builds it is outside money, plus cash that the rules burn before a cautious owner spends
it. That is the territory of the Reserve (`studio/reviews/economy-reserve.md`) and of the dollar rules, not of loan
pricing.

## 4. The one tune: "never let cash burn" (v59-b), dropped

The change: in the 45 days before the season close locks purchases (the launch reset falls on the same day), the
prudent bot puts the cash the close would take into capacity, at any phase of the cycle, past its profit hurdle.

| All carriers, ten seeds | After (v59-a) | Tuned (v59-b) |
|---|---|---|
| Prudent net worth | 63k | 61k |
| Greedy net worth | 99k | 99k |
| Prudent owner-operators / fleets | 44k / 128k | 45k / 116k |
| Fleets liquidated, prudent | 41% | 43% |

It is neutral to slightly worse. Trucks bought into a weak market before the close are sold again by the
right-sizing. I took it out: the tree holds the after persona.

## 5. Option B: risk pricing and the bust covenant

**The rule** (`packages/engine/src/purchaseLoans.ts`; `equipmentFinance.purchase.risk`, off by default):

- **Leverage pricing.** Each week every open purchase loan pays its credit rate plus a premium on top. The premium is
  `perDebtToEquity` (0.1% a week) for each unit of the borrower's debt-to-equity over `freeDebtToEquity` (1), up to
  `maxPremium` (0.4% a week, about 21% a year).
  - Debt-to-equity is the lender's reading: purchase loans and Equipment Finance debt, over cash, owned trucks and
    spare trailers, trucks on order and loan stakes, less the debt.
- **The bust covenant.** While the freight cycle reads under `bustBelow` (0.9), a borrower holding less cash than
  `coverWeeks` (8) of its loan payments is in breach. It pays `premium` (0.2% a week) more, and its loans default on
  the first missed payment instead of the second.
- The premium is a sink of its own (`sink:loan_risk`). With the switch off nothing changes: a 240-day check
  reproduces v59-a to the byte.
- The report gives premiums, borrower-weeks paying one and in breach, and the defaults the covenant brought forward
  (`truckMoney.risk`).
- Test: "risk pricing … in a bust the covenant defaults it on the first miss" in `engine.test.ts`.

**The pair with B on** (`v59-c`: ten seeds, the after persona, B at the sizes above):

| All carriers | After, B off | After, B on |
|---|---|---|
| Prudent net worth | 63k | 62k |
| Greedy net worth | 99k | 94k |
| Prudent / greedy owner-operators | 44k / 31k | 47k / 29k |
| Prudent / greedy fleets | 128k / 335k | 112k / 321k |
| Prudent fleets liquidated | 41% | 47% |
| Seeds prudent richer: net worth / all-in | 0 / 10 | 0 / 10 |

**Its cost**, per seed over four years:

| | B off | B on | B three times stronger (3 seeds) |
|---|---|---|---|
| Risk premium paid (a sink) | – | 1.51M FD | 6.78M FD |
| Borrower-weeks paying a premium / in breach | – | 15,776 / 1,499 | 25,530 / 1,549 |
| Loan defaults / trucks seized | 258 / 185 | 340 / 264 | 382 / 303 |
| Defaults the covenant brought forward | – | 235 | 267 |
| Interest paid, all of it | 7.6M | 8.5M | 13.9M |
| Liquidations | 366 | 362 | 373 |
| Free path: median days to a truck | 45 | 46 | 45 |
| Operating sinks ÷ faucets | 90.8% | 90.6% | 90.7% |

The stronger probe sets `perDebtToEquity` 0.3%, `maxPremium` 1% a week and `freeDebtToEquity` 0.5. On its seeds 1–3
the gap doesn't move (prudent 59k, greedy 102k, against 57k and 102k with B off).

**B isn't worth its cost.** It narrows the pooled gap by 4k of 36k and takes about 80 more trucks a seed from
borrowers who miss a payment in a bust. Many of those are prudent fleets: their liquidations rise from 41% to 47%.
It charges every leveraged owner 1.5M FD a seed. Leverage is not where the greedy fleet's lead comes from (§3), so
pricing leverage can't take the lead away.

## 6. Recommendation to Jeff

**Keep option A and leave option B off.**

The persona change makes the conservative bot what Jeff asked for, a prudent businessman:
- it prices to win, borrows only what a bust can carry, and buys at the bottom;
- its net worth rises by half;
- its owner-operators go under a third less often, and out-earn the greedy owner-operators in the game on nine
  seeds of ten.

The greedy fleet still ends with more FD, because it pours outside money in: about $2,000 a fleet, eight times the
prudent fleet's net worth at the launch price. Counted against what each owner brought, the prudent businessman
already wins, on every seed, before the change and after it. He ends about $166 up while the greedy fleet ends
$941 down.

Option B, pricing leverage, narrows the FD gap by a few thousand. It does so at a cost of 1.5M FD a seed and about 80
more trucks seized, many of them from prudent fleets in a bust, so it is not worth switching on.

If Jeff wants prudence to win in FD as well, and not only in what an owner walks away with, the levers are the cash
rules that burn a cautious owner's cushion: the Reserve and the hoarding rule (`economy-reserve.md`). Whether a
dollar should buy as much of the game as it does today is a token question for TOKENOMICS, not a loan-pricing one.

## Files

- `packages/agents/src/ruleBots.ts`: the prudent persona (§1).
- `packages/engine/src/report.ts`: net worth, dollars in and out, liquidations, trucks and median wealth by persona.
- `packages/engine/src/purchaseLoans.ts`, `packages/config/src/economy.config.ts`
  (`equipmentFinance.purchase.risk`, off): option B (§5). The engine test is in `packages/engine/test/engine.test.ts`.
