# Economy review: the emission cap (2026-11-04)

Seeds 1 and 2, 120 days, live profile. Before = runs/em-before, after = runs/em-after. Not committed; the ruleset bump is the producer's.

## Diff

- `packages/config/src/economy.config.ts`: `token.emission = { enabled: false, capFd: 1e9 (circular.capFd), genesisFd: 4e8 (the allocations outside the 60% reserve), firstMonthFd: 3e7, multRange: [0.5, 1] }`.
- `packages/config/src/live.ts`: `"token.emission.enabled": true`.
- `packages/engine/src/emission.ts` (new): `budgetFd(m) = 30M × 0.95^m` (r = 1 − first ÷ (cap − genesis); the schedule sums to 600M), `cumulativeBudgetFd`, `emissionMultiplier`, `dailyEmission`. Unspent budget rolls forward, overspend comes out of the next month.
- `ledger.ts`: `npcPaidCents`, which counts faucet:npc_shipper and faucet:npc_factor postings to `co:` accounts. `world.ts`/`metrics.ts`: `stab.emissionMult`, logged daily. `freight.ts`: `rf = reserve × dial × emissionMult`. `step.ts`: the end-of-day hook. `index.ts`: the export.
- Test: `packages/engine/test/emission.test.ts`, 2 tests (the schedule's ratio, its sums and its cap; the multiplier and both clamps). They pass. engine.test.ts: 162 of 162 pass.

## Before → after

| | Seed 1 | Seed 2 |
|---|---|---|
| Sink/faucet, Q1 (days 0–90) | 0.61 → **0.70** | 0.68 → **0.72** |
| Sink/faucet by month (M1–M4) | .57 .61 .65 1.05 → .61 .74 .76 .96 | .62 .67 .76 1.06 → .64 .77 .77 .92 |
| NPC carrier pay by month, M FD | 39.7 36.7 32.3 22.7 → 36.7 27.0 25.8 24.5 | 35.6 31.9 27.6 21.8 → 34.1 26.5 26.3 23.5 |
| Supply at day 120 | 65.5M → **49.2M** | 47.1M → **44.0M** |
| OO median wealth, greedy / conservative / random (k) | 98 / 344 / 99 → 106 / 302 / 69 | 96 / 288 / 79 → 86 / **117** / 82 |
| OO liquidated per mille, g / c / r | 22 / 22 / 15 → 52 / 30 / 7 | 0 / 7 / 22 → 7 / 37 / 22 |

Multiplier path, days 0–59 (seed 1): 1.00 to day 10, 0.96 → 0.50 over days 11–20, 0.50 to day 28; month 2 opens at 0.76, eases to 0.50 by day 46 and holds there. Seed 2 is the same shape: 1.00 → 0.50 by day 23, then month 2 opens at 0.85 and is at 0.50 from day 52.

## Findings

- **The band still fails.** The cap cuts NPC pay 10–27% from month 2, but npc_lessor (32% of faucets, out of scope) and the lag keep Q1 at 0.70–0.72. A load keeps the rate it was posted at, and factoring pays on delivery, so month 1 overspends 22% (36.7M against 30M) and the multiplier sits at its 0.5 floor for the last 8–10 days of each month.
- **The 70% cash guard fails on seed 2's conservative OOs** (288k → 117k, 41%). Seed 1's random OOs sit right at the line (70%). The prudent bots lose the most, which is the wrong direction for Jeff's goal.
- Not run (the two-pair limit): a gentler schedule. Next candidate: `firstMonthFd` 36M (r = 0.94), plus a multiplier read on the backlog's posted rates.

## Not done

Item 2 (risk-priced purchase loans and the bust covenant): not started, for budget. No four-year run. No commit.

# Retune (2026-11-07)

Economy designer, for the producer; itinerary item 1 (`studio/BACKLOG.md`). Seeds 1 and 2, 120 days, the live profile on
0.23.0-phase0.38, the cap turned on with the runner's own override. Baseline = `runs/em2-base` (the cap off, this code; it
reproduces the pre-retune world to the FD at day 120). Nothing is committed; `token.emission.enabled` stays false in
`economy.config.ts` and `live.ts`; the switch is the producer's at the ruleset bump after the gate.

## 1. What the baseline showed

The first sizing failed for a reason the review did not name: the budget saw about 60% of the faucet it was meant to
cap. NPC freight pay in month 1 is 66M (seed 1) / 56M (seed 2): the NPC factor 38 / 33 (every bot signs the contract, so
most pay lands on delivery through the factor), the lessor 27 / 21, net paper 2 / 2. `npc_lessor` is 35% / 28% of all
faucets; the old `npcPaidFd` counted shipper and factor only.

The world is a cold start with freight at 2.5× truck capacity: 57% of posted loads expire unhauled, the load-to-truck
ratio sits at its 2.5 clamp, and an unfilled load's ceiling rises 10% a round for up to ten rounds, so clears average
6.45 / 5.61 FD a mile against a leased owner-operator's break-even of about 2.2–2.6. Sinks over faucets by month: .58 .61
.65 1.06 (seed 1), Q1 0.62 / 0.69. Faucets less sinks in Q1 is 77M / 51M, and that is the carriers' retained profit: the
prudent owner-operator's median wealth at day 120 is 345k / 289k from a 5k grant (the greedy 98k / 97k). The band and
the cash guard are the same quantity seen from two sides; the design checkpoint said so and the producer took the guard
relative (§5).

## 2. The mechanism

- **Accounting at the invoice.** Every FD an NPC shipper commits to a company for freight draws on the budget when the
  invoice is raised (`receivables.ts bill`, `payer 0` on `faucet:npc_shipper`), whichever route pays it: net 30, the factor
  on delivery, the lessor on delivery; NPC detention too (`trips.ts payDetention`). The lessor is in, and the payment
  terms' timing is out of the pacing; what remains is the delivery lag (2–3 days). The ledger's cash counter
  (`npcPaidFd`, now with `npc_lessor`) is the "paid" column. The count runs with the cap off, so a baseline reports what
  it would have capped. Out, for now: `faucet:npc_market` (the NPC market buying a facility's goods; 0 in 120 days; the
  four-year check reports its share), and quick pay's fee (closed under the contract). Out by nature (§14): an NPC's
  advance on a company's paper — the factor or the lessor paying a carrier what a broker owes it, repaid by the broker
  into `sink:npc_factor` at the due day — which is the payer's money, not NPC freight pay; it is tagged apart
  (`receivables.ts NPC_ADVANCE`, `faucet:npc_advance`) so the cash column counts the NPC shipper's money once and the
  ratio can be read without the wash.
- **The schedule** (`budgetFd`), two behind `token.emission.refill`. **G** (refill 0): first × r^m, r = 1 − first ÷ (cap −
  genesis) = 0.94 at 36M, summing to the 600M reserve. **R** (refill > 0): month 0 is `firstMonthFd`; month m re-emits
  `refill` of the sinks of the trailing 90 days scaled to a month — or, with `refillNet`, of those sinks less the trailing
  faucets other than NPC freight pay (loans, deposits, payouts: what the freight faucet need not balance; §11) — plus a
  published subsidy 3M × 0.95^m summing to 60M. What a month leaves unspent carries forward; what it overspends comes out
  of the months after.
- **Pacing, daily** (`dailyEmission`, after the day's metrics close). Available = this month's remainder (carry included)
  plus the next month's share of a rolling 30-day horizon, so a month boundary adds budget instead of ending it. The
  spend a unit of lever has been producing = the last `windowDays` days' commitments over the lever in force `lagDays`
  before each. The target lever product = available ÷ (30 × that); the product moves at most `stepPerDay` a day and
  opens at `pacing.warmStart`, held there until the window holds `lagDays + holdAfterLagDays` closed days (before that
  nothing priced by the opening has been delivered and the spend per lever would read near zero). The first sizing ran
  7 / 0.05 / 3 opening at 1 (§3); the config now carries the gate's values, 14 / 0.03 / 5 opening at 0.5 with the hold
  at 7 days (§4, §4b).
- **The lever, in order** (`leverSplit`). Volume first: `w.stab.emissionVolMult` = max(0.5, product) scales what NPC
  shippers are asked to post in `demand.ts planFreight` (facility loads untouched; contract tenders post uncut). Rates
  only once volume is at 0.5: `w.stab.emissionMult` = product ÷ 0.5, floored at 0.8 (the 1.2× ceiling then sits at
  ~0.96 of the reference, about 1.3× a fresh leased owner-operator's break-even). The product never goes under 0.4.
- **Precedence: the cap wins.** While the cap is on, the two published dials — the volume dial (`volumeMult`) and the
  balance dial (`rateMult`, `step.ts monthlyStabilizers`; the supply ceiling's weekly step on the same dial, `ceiling.ts
  weeklyCeiling`) — either hold where they stand (`dialOneWay` false) or may still cut NPC volume and lower NPC rates and
  never add or raise (true; `emission.ts dialMayMoveTo`), so the economy keeps the published dials' discipline when the
  cap is not binding while nothing can push NPC freight up against ρ and v. The rack spread and the profit-tax
  stabilizer still move. The test "the cap wins" runs a month far under and a month far over the target with the cap
  off, on, and on one-way, and checks that only the off world's dials move both ways and the one-way world's dials move
  down only. §11 and §13 size the choice (the balance dial first, the volume dial after the four-year check).
- **Diff.** `packages/config/src/economy.config.ts` `token.emission` (36M, [0.8, 1], volRange [0.5, 1], pacing 14 / 0.03 /
  5 opening at 0.5 with holdAfterLagDays 2, refill 0, refillNet false, refillWindowDays 90, subsidy, dialOneWay false);
  `packages/engine/src/emission.ts` (rewritten; `dialMayMoveTo`, `trailingOtherFaucetsPerMonthFd`), `types.ts`
  (`EmissionState`), `world.ts` (`stab.emissionVolMult`, `w.emission`), `demand.ts` (planFreight), `receivables.ts`
  (`Bill.npcKind`, the draw in `bill`; `NPC_ADVANCE`, the advance on a company's paper tagged apart), `trips.ts`
  (detention, the kinds), `ledger.ts` (the lessor tag), `step.ts` (the standdown and the one-way dials; `dailyEmission`
  moved after `closeDay` so the metrics log the levers in force that day), `ceiling.ts` (the same rule on the ceiling's
  dial), `metrics.ts` (`emissionVolMult`, `emissionCommittedFd`, `emissionAvailableFd`), `report.ts` (`emission`;
  `byStrategy.medianCashFd` and `firstTruck`; `ratios` and `ratioOf`, the raw and corrected ratio by quarter and year
  — a measurement beside the gate, whose definition is unchanged). `packages/engine/test/emission.test.ts`: 13 tests
  (both schedules and refillNet; the lever order and floors; the horizon, the spend per lever and the step; the draw on
  every route with a player payer, the NPC market and an NPC advance excluded, and the advance repaid into
  `sink:npc_factor`; the volume lever in planFreight; the opening and its lag-tied hold; the day-by-day walk and the
  month roll; R's second month; the precedence both ways and one-way on both dials; the corrected ratio). `freight.ts`
  untouched; `live.ts` untouched.

## 3. Before → after, the cap opening at 1 (`runs/em2-base2`, `em2-g36`, `em2-r36`)

G-36 = the geometric schedule at 36M; R-36 = the refill schedule opening at 36M. Both seeds, 120 days. "Committed" is
NPC freight pay at the invoice; the budget rows are the cap's own. Prudent = the `conservative` persona. Cash = FD in
hand plus the Reserve. NW = net worth (wealth less debt). The free path's median hides the prudent third: it is set by
the bots that buy on day 12 with a loan.

| | base s1 | G s1 | R s1 | base s2 | G s2 | R s2 |
|---|---|---|---|---|---|---|
| S1Q1 sinks ÷ faucets | 62% | 73% | 71% | 69% | 76% | 72% |
| S/F by month M1–M4 | 58% 61% 65% 106% | 63% 80% 80% 95% | 63% 77% 76% 91% | 63% 68% 76% 106% | 68% 82% 78% 87% | 69% 72% 74% 90% |
| Q1 faucets → sinks | 201.7M → 125.0M | 144.8M → 105.5M | 150.1M → 107.0M | 162.5M → 112.0M | 128.8M → 97.5M | 143.5M → 103.3M |
| NPC pay committed M1–M4 | 64.0M 61.8M 52.1M 41.7M | 54.2M 34.1M 29.1M 26.4M | 54.2M 35.2M 35.1M 33.3M | 52.9M 46.7M 37.3M 32.0M | 42.4M 28.4M 31.9M 28.2M | 42.6M 37.5M 37.6M 33.3M |
| … against the budget | off | 151% 101% 91% 88% | 151% 75% 88% 89% | off | 118% 84% 100% 94% | 118% 87% 99% 93% |
| budget M1–M4 | – | 36.0M 33.8M 31.8M 29.9M | 36.0M 47.0M 40.0M 37.2M | – | 36.0M 33.8M 31.8M 29.9M | 36.0M 42.9M 38.0M 35.9M |
| carry after M4 | – | −12.2M | 2.4M | – | 653k | 1.8M |
| lever vol·rate means M1–M4 | 1·1 | 0.71·0.92 0.50·0.80 0.50·0.80 0.50·0.80 | 0.71·0.92 0.50·0.82 0.55·0.94 0.58·0.98 | 1·1 | 0.72·0.93 0.63·0.98 0.70·1.00 0.61·1.00 | 0.72·0.96 0.84·1.00 0.81·1.00 0.75·1.00 |
| days at floor vol / rate | – | 103 / 101 | 68 / 38 | – | 16 / 11 | 12 / 0 |
| posted/day M1 → M4 | 1085 → 617 | 775 → 430 | 775 → 482 | 792 → 502 | 585 → 410 | 585 → 499 |
| cleared/day M1 → M4 | 381 → 324 | 384 → 293 | 384 → 306 | 392 → 316 | 357 → 288 | 357 → 302 |
| expired share of posted | 57% | 38% | 38% | 40% | 31% | 36% |
| avg cleared FD/mi M1 → M4 | 6.45 → 4.94 | 5.68 → 4.02 | 5.68 → 4.45 | 5.61 → 4.17 | 4.97 → 4.10 | 4.98 → 4.53 |
| idle trucks, mean M2–M4 | 120 | 188 | 171 | 175 | 238 | 181 |
| trucks in service day 120 | 811 | 751 | 762 | 811 | 850 | 787 |
| FD held by companies day 120 | 65.6M | 41.8M | 46.2M | 47.1M | 38.3M | 44.4M |
| reserve: net emitted of 600M | 83.9M | 49.9M | 54.9M | 57.8M | 44.3M | 52.3M |
| prudent OO median cash / wealth / NW | 127k / 345k / 311k | 57k / 83k / 83k | 65k / 161k / 145k | 73k / 289k / 250k | 43k / 48k / 48k | 60k / 92k / 92k |
| greedy OO median cash / wealth / NW | 57k / 98k / 69k | 42k / 86k / 57k | 45k / 93k / 64k | 50k / 97k / 68k | 28k / 72k / 42k | 43k / 89k / 60k |
| prudent ÷ greedy: cash, NW | 2.23×, 4.53× | 1.36×, 1.46× | 1.43×, 2.28× | 1.45×, 3.70× | 1.52×, 1.14× | 1.38×, 1.53× |
| prudent OO first truck: bought, median day | 133/133, d49 | 95/133, d99 | 115/133, d94 | 132/133, d78.5 | 50/133, d88.5 | 94/133, d99.5 |
| greedy OO first truck median day | d12 | d12 | d12 | d13 | d13 | d13 |
| OO liquidated: prudent / greedy / random | 2% / 2% / 2% | 3% / 1% / 2% | 2% / 3% / 2% | 1% / 0% / 2% | 4% / 2% / 5% | 4% / 3% / 5% |
| liquidations (oo / fleet / broker) | 33 (8 / 8 / 17) | 16 (9 / 7 / 0) | 17 (9 / 8 / 0) | 8 (4 / 2 / 2) | 21 (15 / 3 / 0) | 22 (15 / 5 / 1) |
| free path: bought, median day | 370/370, 21d | 328/366, 21d | 348/366, 21d | 353/354, 21d | 271/354, 21d | 315/354, 21d |
| NPC pay: spot / brokered / contract | 94% / 4% / 1% | 85% / 14% / 2% | 86% / 12% / 2% | 89% / 9% / 2% | 81% / 16% / 3% | 85% / 12% / 2% |
| open NPC loads a day: spot / contract | 3408 / 35 | 1673 / 24 | 1761 / 25 | 1921 / 28 | 1235 / 27 | 1568 / 31 |
| starter boards, open at day end, week 1 (DAL·LAX·PHX) | 67·150·26 | 67·150·26 | 67·150·26 | 39·89·20 | 39·89·20 | 39·89·20 |
| … lowest week, weeks 2–17 | 75·138·41 | 34·89·23 | 38·99·21 | 37·115·24 | 19·74·15 | 23·88·17 |
| … asked a day, week 1 → week 17 | 39→21 57→27 17→9 | 39→14 57→18 17→6 | 39→20 57→25 17→8 | 30→18 44→23 13→8 | 30→16 44→21 13→7 | 30→22 44→28 13→9 |

**The lever paths** (weekly means, volume·rate, then NPC loads posted a day):

- G s1: w1 1.00·1.00 1102 · w2 0.85·1.00 932 · w3 0.54·0.93 602 · w4 0.50·0.80 536 · then 0.50·0.80 to the end, 519 → 382 a day.
- R s1: as G through w5, then w6 0.50·0.88 · w7–w9 0.50·0.80 · w10 0.50·0.84 · w11 0.55·0.99 · w12 0.61·1.00 · w13 0.53·0.99 · w14 0.50·0.93 · w15 0.51·0.98 · w16 0.61·1.00 · w17–w18 0.70·1.00, 435–540 a day.
- G s2: w1 1.00 · w2 0.89 · w3 0.57·0.96 · w4 0.50·0.80 · w5 0.50·0.86 · then rates at 1 and volume hunting 0.53–0.78 (w6 0.64, w11 0.78, w14 0.53, w18 0.66), 363–490 a day.
- R s2: w1 1.00 · w2 0.89 · w3 0.57·0.97 · w4 0.50·0.86 · w5 0.59 · then rates at 1 and volume swinging 0.63–0.97 on a five-week beat (w7 0.94, w10 0.67, w12 0.97, w15 0.64, w18 0.90), 429–631 a day.

What the pair says, before the warm start (§4):

- **The walk is too slow for the cold start.** The product takes 12 days to reach its floor and the board carries ~4,000
  loads posted at full price that clear for a week more, so month 1 commits 151% / 118% of its 36M. Seed 1 never pays
  that debt back: the product sits at 0.4 for 90 days (the natural spend at the floor is about the budget), the carry
  is still −12M at day 120. Seed 2, with 15% less natural pay, is level by month 3 and holds the budget on volume alone
  (0.6–0.7), rates whole.
- **Volume first works as a rate cut through the market.** Posted loads fall 30–45%, cleared loads 5–10%, and the clear
  falls from 6.45 to 4.0–4.5 FD a mile: the backlog is a third smaller, the expired share 57% → 38%, the rollover
  ladder shorter. Trucks idle more (188–238 a day against 120–175).
- **The band:** Q1 0.62 / 0.69 → 0.73 / 0.76 (G), 0.71 / 0.72 (R); month 4 at 0.87–0.95. The design checkpoint's
  0.75–0.80 was slightly optimistic for Q1, right for month 4.
- **The prudent owner-operator keeps the lead but loses the truck.** Prudent ÷ greedy at day 120: cash 1.4–1.5× under
  either schedule, net worth 1.1–2.3× (on raw wealth, which counts a borrowed truck in full, G seed 1 puts the greedy
  bot ahead, 86k to 83k). Prudent liquidations 1–2% → 2–4% (5 companies of 133 in seed 2, against 1). The pacing guard
  fails under both schedules: the prudent persona buys no truck on credit, saves at a third of the baseline's income,
  and reaches its first truck at day 88–100 (baseline 49 / 78.5), 29–62% of them not at all by day 120. The greedy and
  random personas buy on day 12–15 with a loan under every schedule.
- **R hunts.** With rates whole and the budget following the sinks month to month, seed 2's volume lever swings 0.63–0.97
  on a five-week beat: the posted board breathes ±20% week to week. G seed 2 hunts less (0.53–0.78). The 7-day window
  and 3-day lag are shorter than the board's own memory once a backlog stands.

## 4. The warm start (`em2-g36w5`, `em2-g36w7`, `em2-r36w5`; `em2-g36w5h`, `em2-r36w5h`)

Month 1 overspent 51% / 18%, over the ~10% the producer set, so the lever opened below 1 (`pacing.warmStart`), from
the known oversupply: 0.5 (the volume floor) and 0.7.

| | G | G w0.7 | G w0.5 | G w0.5 held | R | R w0.5 | R w0.5 held |
|---|---|---|---|---|---|---|---|
| month 1 committed ÷ budget, s1 / s2 | 151% / 118% | 140% / 108% | 121% / 102% | **106% / 95%** | 151% / 118% | 121% / 98% | **99% / 86%** |
| months 2–4 committed ÷ budget, s1 | 101 91 88% | 103 97 88% | 98 94 87% | 96 96 94% | 75 88 89% | 89 93 92% | 103 97 96% |
| S1Q1 sinks ÷ faucets | 73% / 76% | 74% / 76% | 75% / 76% | 76% / 75% | 71% / 72% | 72% / 73% | 73% / 74% |
| S/F month 4 | 95% / 87% | 90% / 89% | 90% / 89% | 93% / 84% | 91% / 90% | 91% / 85% | 86% / 85% |
| carry after month 4, s1 / s2 | −12.2M / +0.7M | −10.8M / +1.0M | −1.4M / +1.4M | +2.2M / +1.3M | +2.4M / +1.8M | +2.7M / +1.4M | +1.8M / +1.0M |
| days at floor vol / rate, s1 | 103 / 101 | 103 / 101 | 106 / 89 | 81 / 29 | 68 / 38 | 37 / 15 | 25 / 8 |
| lever vol·rate means M1–M4, s1 | .71·.92 .50·.80 .50·.80 .50·.80 | .67·.92 .50·.80 .50·.80 .50·.80 | .58·.91 .50·.80 .50·.80 .50·.84 | .53·.92 .50·.87 .51·.92 .53·.95 | .71·.92 .50·.82 .55·.94 .58·.98 | .58·.92 .56·.96 .59·.96 .64·1.0 | .51·.92 .67·.99 .66·1.0 .79·1.0 |
| prudent OO median cash, s1 / s2 | 57k / 43k | 50k / 42k | 50k / 43k | 60k / 41k | 65k / 60k | 78k / 53k | 94k / 49k |
| prudent ÷ greedy cash, NW (s1; s2) | 1.36×, 1.46×; 1.52×, 1.14× | 1.56×, 1.35×; 1.60×, 1.07× | 1.69×, 1.37×; 1.59×, 1.03× | 1.38×, 1.81×; 1.49×, 0.94× | 1.43×, 2.28×; 1.38×, 1.53× | 1.58×, 3.81×; 1.24×, 0.96× | 1.57×, 3.51×; 1.33×, 0.96× |
| prudent first truck: bought, median day (s1; s2) | 95, d99; 50, d88.5 | 83, d93; 42, d96.5 | 74, d97.5; 43, d106 | 95, d101; 33, d100 | 115, d94; 94, d99.5 | 128, d87; 57, d95 | 133, d85; 39, d106 |
| OO liquidated prudent / greedy (s1; s2) | 3 / 1; 4 / 2 | 5 / 4; 3 / 1 | 2 / 6; 2 / 4 | 5 / 6; 6 / 1 | 2 / 3; 4 / 3 | 5 / 3; 2 / 2 | 2 / 4; 3 / 3 |
| free path: bought, median day (s1; s2) | 328/366, 21d; 271/354, 21d | 318/368, 21d; 262/353, 21d | 308/367, 21d; 262/352, 25.5d | 329/367, 28d; 258/358, 30d | 348/366, 21d; 315/354, 21d | 366/371, 21d; 282/358, 29d | 373/373, 28d; 269/363, 45d |
| starter boards open at day end, week 1 (DAL·LAX·PHX; s1 / s2) | 67·150·26 / 39·89·20 | 47·109·21 / 33·63·12 | 31·69·15 / 21·34·9 | 23·44·10 / 16·19·6 | 67·150·26 / 39·89·20 | 31·69·15 / 21·34·9 | 23·44·10 / 16·19·6 |
| … lowest week, weeks 2–17 (s1 / s2) | 34·89·23 / 19·74·15 | 30·94·16 / 22·86·9 | 31·91·23 / 24·77·14 | 31·94·19 / 23·80·20 | 38·99·21 / 23·88·17 | 34·106·25 / 21·85·14 | 39·122·23 / 26·81·18 |

- **Opening at 0.5 does what the walk couldn't**: month 1 lands at 121% / 102% (G) and 121% / 98% (R), the carry debt is
  gone by month 4 in every run, and Q1 gains a point or two. 0.7 is too timid (140% / 108%).
- **The opening was being given back.** In the first days nothing has been delivered, so the spend per lever reads near
  zero and the controller walked the product from 0.5 up to ~0.75 by day 5 (weekly means 0.65, 0.71) before the bills
  landed and pulled it down again. The hold fixes that: until the window holds seven closed days the product may fall
  from the opening but not rise above it (`emission.ts dailyEmission`; the test "opens where pacing.warmStart says").
  **Held, month 1 lands at 106% / 95% (G) and 99% / 86% (R)**, inside the producer's ~10%, and the carry is positive
  after month 4 in all four runs.
- **Seed 1 under G at the floor.** Cold, it sits at 0.4 for three months with an unpaid debt; opening at 0.5, the debt
  is gone but the economy at the floor commits about the budget (98%, 94%, 87% of months 2–4) and the product stays at
  0.4; held, the rate lever lifts off (means 0.87, 0.92, 0.95) while volume stays at its floor: 36M × 0.94 is at the
  limit of what the levers can enforce against this seed's 64M of natural pay. Under R the floor binds for a month,
  then releases (0.66–0.79 volume, rates whole); by month 4 of R w0.5 held seed 1 the budget (41M, the sinks having
  grown with the trucks bought) is above what the economy commits and the levers sit at 1.
- **The held opening thins week one at the starter hubs**: Phoenix opens at 10 / 6 open NPC loads at day end instead of
  26 / 20 (3–4 of them vans), Dallas 23 / 16, Los Angeles 44 / 19. Never empty, but the thinnest board of every run,
  and it costs the first truck a week across the board (the free path's median 21 → 28–45 days, the greedy bot's loan
  on day 17–23 instead of 12–15). From week 2 the boards are the cold runs' (§6). Nobody joins the live world on its
  first day, so the trade is right for the restart; it is the number to watch at the gate.
- **The held opening and the prudent persona under G.** Prudent liquidations in G w0.5 held are 5% / 6% (7–8 of 133),
  the highest of any run, against 2% / 3% under R held; the greedy's 6% / 1%. With week one's board at a third, the
  carriers that bid at break-even plus 15% and run no further than 120 miles empty find the fewest loads at the moment
  every company has its 5k grant and a leased truck. Two seeds; the ten-seed gate decides whether it is the opening or
  the noise. If G is kept, open it at 0.65 held (not run).

### 4b. The hunting pair (`em2-g36hp`, `em2-r36hp`; the producer's go after the 120-day report)

`pacing.windowDays` 14, `stepPerDay` 0.03, `lagDays` 5, both schedules, held opening at 0.5, against the current pacing
(7 / 0.05 / 3, held). "Hunting" is the mean absolute change of the weekly mean lever product from week 5, and its range.

| | G held | G held, new pacing | R held | R held, new pacing |
|---|---|---|---|---|
| hunting, s1 / s2 | ±0.05 (0.40–0.59) / ±0.10 (0.54–0.83) | ±0.04 (0.40–0.57) / ±0.06 (0.61–0.89) | ±0.10 (0.47–0.98) / ±0.13 (0.57–0.94) | ±0.04 (0.46–0.78) / ±0.06 (0.63–0.85) |
| S1Q1 sinks ÷ faucets | 76% / 75% | 76% / 76% | 73% / 74% | 73% / 77% |
| S/F month 4 | 93% / 84% | 93% / 86% | 86% / 85% | 88% / 81% |
| month 1 committed ÷ budget | 106% / 95% | 100% / 81% | 99% / 86% | 100% / 77% |
| month 2 committed ÷ budget | 96% / 103% | 96% / 114% | 103% / 119% | 97% / 125% |
| carry at the end, s1 / s2 | +2.2M / +1.3M | +3.0M / +1.2M | +1.8M / +1.0M | +2.7M / +0.6M |
| prudent ÷ greedy cash (s1; s2) | 1.38×; 1.49× | 1.39×; 1.21× | 1.57×; 1.33× | 1.61×; 1.26× |
| prudent first truck: bought, median day (s1; s2) | 95 d101; 33 d100 | 113 d99; 27 d98 | 133 d85; 39 d106 | 130 d91; 27 d100 |
| OO liquidated prudent / greedy (s1; s2) | 5 / 6; 6 / 1% | 3 / 3; 4 / 4% | 2 / 4; 3 / 3% | 5 / 3; 4 / 4% |
| free path median day, s1 / s2 | 28 / 30 | 28 / 46 | 28 / 45 | 28 / 50 |

- **The hunting halves** on both schedules and both seeds, and R's five-week beat is gone: R seed 1's volume walks
  0.50 → 0.78 over seventeen weeks without the 0.98 spike, R seed 2 stays within 0.63–0.85. Q1 is equal or up to three
  points better, month 4 the same within noise, the carry positive everywhere.
- **The cost is the hold's length.** The hold lasts until the window holds `windowDays` closed days, so with the window at
  14 the opening is held twice as long: seed 2's month 1 comes in at 77–81% of budget and month 2 at 114–125% as the
  controller lets go, and the first truck comes a week later again in seed 2 (free-path median 30 → 46–50 days; the
  greedy bot's loan on day 26–28). Seed 1, whose natural pay runs over the budget anyway, is unaffected. The hold should
  be tied to the delivery lag, not the window (`lagDays` plus a few days): a one-line change with a test, not made
  mid-batch; proposed for the gate's build.
- **The guards don't move beyond noise**: prudent ÷ greedy cash 1.21–1.61× (1.33–1.57× before); prudent liquidations
  3–5% against 2–6%; first trucks in seed 1 unchanged or better (G 95 → 113 bought), in seed 2 a few fewer (33 → 27, 39
  → 27 of 133).
- **Verdict: the new pacing wins** on what it was for and loses nothing the two seeds can see; the 240-day pair (§10)
  runs on it.

## 5. The guards

- **The band.** Q1 0.62 / 0.69 → 0.71–0.76 under every variant; month 4 at 0.85–0.95. Not 0.9 in Q1, for the reason the
  design checkpoint gave: Q1's unsunk faucets are the carriers' retained profit, and the cold start's sinks are hauling
  costs at a third of what the boom pays. Q2 needs the 240-day pair.
- **Prudent ≥ greedy at day 120** (the relative guard that replaced the 70% cash guard). On median cash the prudent
  owner-operator keeps 1.24–1.69× the greedy one's (baseline 1.45–2.23×); on net worth 1.03–3.81×, except R w0.5 seed 2
  at 0.96×. On raw wealth, which counts a borrowed truck in full, the greedy bot edges ahead in G seed 1 (86k to 83k). The
  lead shrinks because the lead was the windfall: the prudent bot hauled the boom at the same rates and kept more of it.
- **Prudent liquidations ≤ baseline.** Baseline 2% / 1% (2–3 and 1–2 of 133). Under the cap 2–5% (2–7 companies); the
  greedy persona's rise more under the warm start (1–2% → 4–6%): the loans taken on day 12–15 meet lower rates. Two
  seeds can't separate a doubling from noise at these counts; the ten-seed gate can.
- **The pacing guard (BIBLE: own the first truck inside the first game month) fails under every variant.** The
  prudent persona takes no credit and saves at a third of the baseline's income: its median first truck moves from day
  49 / 78.5 (already past the first month at baseline) to day 87–106, and 29–57% of prudent owner-operators (R w0.5
  seed 1 apart: 128 of 133 by day 87) own no truck at day 120. The greedy and random personas buy on day 12–17 with a
  loan under every schedule, which is why the free-path median stays at 21 days. This is the same conflict as the cash
  guard, seen from the truck: a budget that balances Q1 lengthens the unleveraged path to ownership to about a quarter.
- Absolute figures, for the record (base → G → G w0.5 → R → R w0.5, seed 1 / seed 2): prudent OO median cash 127k / 73k →
  57k / 43k → 50k / 43k → 65k / 60k → 78k / 53k; median wealth 345k / 289k → 83k / 48k → 67k / 45k → 161k / 92k → 294k /
  56k.

## 6. Newcomers and contracts

- **Starter hubs** (open NPC loads at day end, mean a day; "asked" is what planFreight asked the hub to post a day).
  Cold open: week 1 as the baseline (67·150·26 / 39·89·20); weeks 2–17 lowest 34·89·23 / 19·74·15 (G), 38·99·21 /
  23·88·17 (R), against 75·138·41 / 37·115·24 at baseline. Asked a day at week 17: Dallas 14–23 (baseline 21 / 18), Los
  Angeles 18–29 (27 / 23), Phoenix 6–10 (9 / 8). **No board was empty in any week of any run**; Phoenix in seed 2 is
  the thinnest (9–17 open at day end). No per-hub posting floor on this data; if the four-year run or the warm start's
  week one puts a starter hub under ~10 open loads at day end, the floor to propose is a minimum NPC posting per round
  at the three starter hubs that the volume lever does not cut below (planFreight, one line), not built now.
- **Contracts ride uncut, but there is little to ride.** Contract tenders are 1–2% of NPC pay at baseline and 2–3%
  under the cap, 24–31 open a day against 1,200–1,800 spot. Brokered loads are the mover: 4% / 9% of NPC pay → 11–16%
  under every cap variant, because brokers' contract rates trail the spot index and so lag above the capped spot; the AP
  cap bounds them. Spot keeps 81–88%. Newcomers' spot board is not being squeezed by contracts at 120 days; the
  four-year run reads it again as fleets grow sales reps. Scaling new tenders by the volume lever is not needed now.

## 7. R's emission and the supply path

- Under R the budget from month 2 is the trailing sinks plus 2.85M → 2.57M of subsidy (3M × 0.95^m): 42.9–47.0M in
  month 2, 38–40M in month 3, 35–39M in month 4, against G's 33.8 / 31.8 / 29.9M. R's budget follows what the economy
  returns, so S/F lands at 0.85–0.91 by month 4 in every R run and the carry turns positive; G's fixed path holds the
  levers at the floor in seed 1 and overshoots to 0.95 in month 4.
- The reserve (genesis 600M) at day 120: baseline 516.1M / 542.2M (net emitted 83.9M / 57.8M); G 550.1M / 555.7M (49.9M /
  44.3M; w0.5 46.5M / 43.5M); R 545.1M / 547.7M (54.9M / 52.3M; w0.5 56.0M / 50.1M). FD held by companies: 65.6M / 47.1M →
  40–42M (G), 43–47M (R). R emits 5–10M more than G over four months and about 60% of the baseline.
- Against the schedule's own arithmetic (§2): G's gross budget is 314M in year one, 150M, 71M, 34M after; R's is the
  sinks plus 60M of subsidy over the lifetime (30M of it in year one) plus the opening month's 36M, so its net emission
  is bounded by about 100M plus the slack between one month's sinks and the next's. Jeff's call (item 7); the four-year
  check gives the supply path for both.

## 8. Open findings, and the red team's vectors

1. **The controller hunts** under the first pacing (7 / 0.05 / 3): under R the volume lever swings 0.55–0.97 on a
   five-week beat (seed 2), under G 0.53–0.86; the posted board breathes ±20% week to week. The 7-day window and 3-day
   lag are shorter than the board's memory once loads wait several rounds. The pair at 14 / 0.03 / 5 halves it (§4b)
   and is the pacing to switch on; the hold's coupling to the window is the open piece (§4b).
2. **G at the levers' limit.** Seed 1's natural pay (64M in month 1, 62M in month 2) holds the product at its 0.4 floor
   for three months; a seed with more freight than this one would overspend G's path whatever the levers did. The floor
   is the design's promise to carriers (volume no lower than half, rates no lower than 0.8 of the reference); the budget
   has to live inside it.
3. **The unleveraged first truck** takes a quarter under a balanced budget (§5). The levers are the bible's rule ("own
   the first truck and end the lessor's cut" inside a game month), the prudent persona's refusal of credit, or the
   budget's size in Q1; none is the economy designer's alone.
4. **Brokers earn a cap premium** (brokered share of NPC pay 4–9% → 11–16%) because the contract index lags the capped
   spot. Harmless at 120 days; a player brokerage would feel it as a tailwind.
5. **Facilities under the cap.** With freight paying less, bots with cash bought 14 facilities in G seed 1 (0 at
   baseline); `npc_market` is still under 0.2% of faucets. The four-year check reports its share (item 6).
6. **The population dial.** NPC loads posted per truck in service fall to 0.5–0.6 under the cap, the band's floor is
   0.55, and the dial acts from day 112: the four-year run will show bot carriers retiring to fit the budget. Under G's
   declining path that is the fleet shrinking toward nothing; under R it is the fleet settling where sinks balance.
7. **The red team's vectors**, as I see them:
   - *Timing the lever.* The product moves at most 5 points a day and is logged daily; a many-truck player who reads
     the board thinning (or the panel, if it ever shows ρ and v) hauls hardest while the product is high. The rolling
     horizon makes a month boundary a step of about 3% of the budget, so there is no month-end cliff to ride; the
     cold-start walk was the one big window and the held warm start closes it.
   - *Contracts.* Direct tenders post uncut; a fleet with sales reps locks volume the spot board loses. Bounded today by
     `contracts.direct.loadsPerTruckWeek` and the stake, and 2–3% of pay; scale new tenders by v if the four-year run
     shows it growing (item 4).
   - *Facility freight.* A facility's loads are paid from `npc_market`, outside the budget, and the owner pays the
     carrier: a ring of facilities routes NPC money around the cap. Item 6's 5% threshold is the tripwire.
   - *Parking to lift the ceiling.* Fewer idle trucks lift the ratio and the ceiling, but under a fixed budget NPC pay
     is zero-sum among carriers: the controller cuts volume to hold the budget, so a parking cartel gains share only
     from the carriers it starves, and the dial retires bots, never players. Worth a red-team run with a 30-truck player.
   - *Sinking to grow the budget (R).* Every FD sunk raises next month's budget one for one, for everyone; a whale buying
     and scrapping trucks pays the scrap discount and gets a share of its own money back. No private gain found.
   - *Detention.* NPC-paid detention now draws on the budget; a player who waits at closed docks on purpose earns 60
     FD an hour to 8 hours from the NPC shipper, as before, now inside the cap.
   - *Commitment without delivery.* None: the draw is at the invoice; a spoiled load pays and draws nothing, a late hot
     load less; a re-posted load's upstream commitment counts once and the re-post is a transfer; a defaulting NPC
     shipper draws nothing (the broker still owes its carrier from its own cash).

## 10. The 240-day pair (`em2-240-base`, `em2-240-g`, `em2-240-r`; the producer's go)

Base (cap off), G held and R held, both on the 14 / 0.03 / 5 pacing, seeds 1–2, 240 days (eight months; Q2 is days
91–182). Same shape as §3; the hunting measure is the mean absolute change of the weekly lever product from week 5.

| | base s1 | G s1 | R s1 | base s2 | G s2 | R s2 |
|---|---|---|---|---|---|---|
| S1Q1 sinks ÷ faucets | 62% | 76% | 73% | 69% | 76% | 77% |
| **S1Q2 sinks ÷ faucets** | 88% | **92%** | 81% | 85% | 82% | 79% |
| S/F by month M1–M8 | 58 61 65 106 72 88 113 83 | 73 73 80 93 87 93 98 78 | 73 70 73 88 83 71 85 64 | 63 68 76 106 75 81 84 66 | 70 78 77 86 78 81 92 78 | 70 80 77 81 77 79 99 77 |
| Q2 faucets → sinks | 109.6M → 96.2M | 111.8M → 102.4M | 136.6M → 110.9M | 112.1M → 95.2M | 113.9M → 93.0M | 117.7M → 93.5M |
| NPC pay committed M5–M8 | 31.5 27.3 25.6 31.6M | 27.1 29.9 24.9 25.0M | 37.9 42.4 41.8 37.9M | 34.1 39.3 42.7 41.3M | 29.7 29.2 32.1 33.3M | 35.2 35.0 32.2 32.3M |
| … against the budget M5–M8 | off | 97 113 100 107% | 93 104 108 105% | off | 106 110 129 **143%** | 104 109 98 94% |
| budget M5–M8 | – | 28.1 26.4 24.8 23.3M | 40.8 40.6 38.9 36.1M | – | 28.1 26.4 24.8 23.3M | 34.0 32.1 33.0 34.2M |
| carry at day 240 | – | −1.2M | −1.0M | – | **−20.3M** | −0.9M |
| lever vol·rate means M5–M8 | 1·1 | .66·1 .61·1 .57·1 .50·.89 | .94·1 1·1 .95·1 .71·1 | 1·1 | .57·1 .50·.87 .50·.80 .50·.80 | .70·1 .54·.96 .50·.83 .50·.81 |
| hunting from week 5 | – | ±0.04, 0.40–0.76 | ±0.04, 0.46–1.00 | – | ±0.03, 0.40–0.89 | ±0.04, 0.40–0.85 |
| days at floor vol / rate | – | 113 / 16 | 32 / 1 | – | 104 / 71 | 88 / 27 |
| posted/day M1 → M8 | 1085 → 604 | 555 → 390 | 552 → 535 | 792 → 750 | 464 → 522 | 438 → 511 |
| cleared/day M1 → M8 | 381 → 342 | 364 → 287 | 365 → 322 | 392 → 339 | 329 → 333 | 319 → 335 |
| avg cleared FD/mi M1 → M8 | 6.45 → 3.84 | 4.36 → 4.07 | 4.36 → 5.17 | 5.61 → 4.66 | 4.00 → 4.56 | 3.91 → 4.14 |
| trucks in service day 240 | 820 | 756 | 822 | 836 | 809 | 833 |
| FD held by companies day 240 | 69.3M | 47.4M | 75.1M | 72.7M | 57.7M | 54.1M |
| reserve: net emitted of 600M | 101.7M | 61.1M | 99.5M | 97.0M | 71.4M | 71.0M |
| prudent OO median cash / wealth / NW | 86k / 113k / 87k | 72k / 100k / 79k | 102k / 129k / 99k | 96k / 119k / 96k | 80k / 107k / 94k | 76k / 109k / 87k |
| greedy OO median cash / wealth / NW | 72k / 97k / 73k | 43k / 69k / 45k | 92k / 117k / 93k | 86k / 111k / 87k | 38k / 77k / 46k | 36k / 68k / 43k |
| prudent ÷ greedy: cash, NW | 1.20×, 1.19× | 1.67×, 1.75× | 1.11×, 1.06× | 1.12×, 1.10× | 2.13×, 2.03× | 2.11×, 2.01× |
| prudent OO first truck: bought, median day | 133/133, d49 | 133/133, d103 | 133/133, d92 | 133/133, d79 | 131/133, d145 | 132/133, d141 |
| greedy OO first truck median day | d12 | d18 | d18 | d13 | d26 | d28 |
| OO liquidated: prudent / greedy / random | 8 / 8 / 7% | 9 / 7 / 6% | 8 / 7 / 6% | 8 / 3 / 11% | 7 / 5 / 8% | 8 / 4 / 11% |
| liquidations (oo / fleet / broker) | 65 (31 / 12 / 22) | 64 (30 / 21 / 4) | 60 (29 / 17 / 9) | 40 (28 / 6 / 4) | 43 (26 / 4 / 3) | 53 (31 / 5 / 2) |
| NPC pay: spot / brokered / contract | 90 / 9 / 2% | 85 / 12 / 2% | 90 / 8 / 2% | 91 / 7 / 2% | 84 / 13 / 3% | 86 / 12 / 3% |

The lever paths (weekly volume·rate): G s1 holds 0.50 with rates 0.80–1.00 through week 16, eases to 0.76·1 by week 22,
then walks back to 0.50·0.81 by week 34. R s1 walks 0.50 → 1.00 by week 21 (the cap not binding, weeks 21–28), then
down to 0.67 by week 34. G s2 0.50 → 0.89 (week 7) → 0.50·0.80 from week 25 to the end. R s2 0.50 → 0.85 (week 12)
→ 0.50·0.80–0.86 from week 25. All four within ±0.03–0.04 a week.

What the pair says:

- **Q2 (the first quarter after the cold start) is 0.85–0.88 at baseline on its own**: the boom fades under the
  published dials (volume at its 0.75 floor, the balance dial walking rates down) and the economy balances to within a
  few points of the band without a cap. G lands at 92% / 82%, R at 81% / 79%. Neither schedule is in the band on both
  seeds; R is under the baseline on both.
- **G's path outruns the floors by month 6.** The budget falls 6% a month (28.1 → 23.3M over months 5–8) while the
  economy at the floor (volume 0.5, rates 0.8) still commits 30–33M in seed 2: months 7–8 at 129% and 143% of budget
  with both levers pinned, the carry at −20.3M and growing. The floors are the design's promise to carriers; inside
  them the geometric 36M × 0.94 is enforceable for about five months on these seeds, after which "capped" means only
  that the debt grows. Seed 1 holds it (97–113%) because its natural pay has already fallen to the budget's level.
- **R at refill 1 overshoots the other way once the boom ends.** Its budget (trailing sinks + subsidy: 36–41M in months
  5–8) sits above what the uncapped economy pays in those months (26–32M in seed 1), so with the dials standing down the
  levers sit at 1 for two months and NPC pay runs 38–42M a month: more than the baseline, and S/F 0.64–0.85 by month.
  Two causes, both in the design: (1) the budget re-emits the whole of the sinks although faucets also carry loans,
  deposits and payouts (3–6M a month), so faucets ≈ sinks + subsidy + those and S/F ≈ 0.85 at best by construction;
  (2) the standdown. The balance dial was doing useful work in the baseline's months 4–8 (walking rates down through
  year one); with the cap on and not binding, nothing walks them down. "The cap wins" was framed as both dials holding
  in both directions; the cost shows here.
- **The guards at day 240.** Prudent ÷ greedy on cash: baseline's own lead has shrunk to 1.20× / 1.12× by month 8 (the
  greedy's loans are paid, rates normal); G 1.67× / 2.13×, R 1.11× / 2.11×. Prudent liquidations have converged with
  the baseline's (8% / 8% at baseline; 9% / 7% G; 8% / 8% R) — the Q1 doubling was the opening, not a persistent
  effect. The first truck: every prudent owner-operator owns one by day 240 under every schedule, at median day 92–103
  (seed 1) and 141–145 (seed 2) against 49 / 79 at baseline: the quarter's delay of §5 is confirmed, not deepened.
- **FD held and the reserve at day 240**: baseline 69M / 73M held, 102M / 97M net emitted; G 47M / 58M, 61M / 71M; R
  75M / 54M, 100M / 71M. R seed 1 emitted as much as the baseline.

**What this changes in the recommendation (§12).** The pacing is right and the hunting is fixed; the schedule is not
settled. G as specified cannot be the gate's schedule (unenforceable at the floors from month 6). R needs one of two
small changes before it can: (a) `refill` below 1, sized so that faucets with their other sources land in the band —
about 0.85 on this pair (0.85 × 33M + 2.5M + 4M of other faucets ≈ 33M ≈ the sinks); or (b) the balance dial kept
one-way under the cap (it may lower NPC rates, never raise them), so the economy keeps walking toward balance when the
cap is not binding while the cap still cannot be fought upward. (a) is a number, (b) is a rule change to §2's
precedence and its test. The pair to run next, on the producer's go: R held at refill 0.85 and 0.9, 240 days, seeds
1–2, with and without (b) — four pairs, 8 sims.

## 11. The sized refill and the one-way dial (`em2-240-r85`, `-r85d`, `-r90`, `-r90d`, `-rnet`, `-rnetd`; the producer's go)

Four R variants, each with the balance dial holding under the cap and with it one-way (`dialOneWay`: it may lower NPC
rates, never raise them): `refill` 0.85 and 0.9 of the trailing sinks, and the principled base (`refillNet`: the
trailing sinks less the trailing faucets other than NPC freight pay — loans, deposits, payouts — at refill 1). All held
at 0.5 with the hold now tied to the lag (7 days), pacing 14 / 0.03 / 5, 240 days, seeds 1–2; "R 1.0" is §10's run at
refill 1 with the old window hold, for continuity. Cells are seed 1 / seed 2.

| | base | R 1.0 | R 0.85 | R 0.85 one-way | R 0.9 | R 0.9 one-way | R net | R net one-way |
|---|---|---|---|---|---|---|---|---|
| S1Q1 sinks ÷ faucets | 62 / 69% | 73 / 77% | 75 / 78% | 75 / 78% | 74 / 77% | 74 / 77% | 77 / 79% | 77 / 79% |
| **S1Q2 sinks ÷ faucets** | 88 / 85% | 81 / 79% | 88 / 83% | **88 / 84%** | 85 / 82% | **88 / 83%** | 86 / 82% | 84 / 83% |
| S/F M4–M8, s1 | 106 72 88 113 83 | 88 83 71 85 64 | 90 88 86 89 71 | 93 83 86 95 73 | 91 84 82 83 67 | 92 88 79 91 69 | 88 83 85 90 69 | 89 82 82 98 70 |
| S/F M4–M8, s2 | 106 75 81 84 66 | 81 77 79 99 77 | 87 82 80 87 78 | 86 86 81 94 84 | 84 81 81 88 80 | 85 82 81 97 88 | 85 82 80 82 83 | 85 81 82 95 83 |
| budget M5–M8, s1 | – | 40.8 40.6 38.9 36.1M | 32.5 32.1 32.7 30.2M | 32.1 31.3 31.5 29.8M | 35.5 35.5 34.9 32.4M | 35.1 35.2 34.2 32.5M | 33.9 33.3 34.5 33.8M | 33.5 32.9 32.7 33.0M |
| committed ÷ budget M5–M8, s2 | off | 104 109 98 94% | 107 111 113 120% | 106 109 100 97% | 107 110 108 110% | 105 110 97 96% | 106 107 113 115% | 105 110 99 103% |
| carry at day 240 | – | −1.0 / −0.9M | −1.1 / **−13.3M** | −0.8 / −2.6M | −1.8 / −9.3M | −0.1 / −0.9M | −1.1 / −12.2M | −0.8 / −4.1M |
| lever means M5–M8, s2 | 1·1 | .70·1 .54·.96 .50·.83 .50·.81 | .56·1 .51·.90 .50·.80 .50·.80 | .60·1 .52·.94 .50·.80 .50·.80 | .60·1 .51·.89 .50·.80 .50·.80 | .67·1 .55·.97 .50·.84 .50·.80 | .57·1 .50·.91 .50·.80 .50·.80 | .69·1 .55·.96 .50·.80 .50·.80 |
| days at floor vol / rate, s2 | – | 88 / 27 | 89 / 67 | 82 / 59 | 89 / 69 | 78 / 22 | 93 / 67 | 84 / 55 |
| hunting from week 5 | – | ±0.04 / ±0.04 | ±0.04 / ±0.02 | ±0.05 / ±0.03 | ±0.04 / ±0.03 | ±0.03 / ±0.03 | ±0.04 / ±0.02 | ±0.03 / ±0.03 |
| FD held by companies day 240 | 69 / 73M | 75 / 54M | 58 / 56M | 56 / 48M | 66 / 56M | 62 / 48M | 59 / 54M | 57 / 49M |
| reserve: net emitted of 600M | 102 / 97M | 100 / 71M | 76 / 68M | 72 / 59M | 87 / 69M | 80 / 61M | 74 / 67M | 71 / 60M |
| prudent OO median cash | 86 / 96k | 102 / 76k | 78 / 80k | 79 / 69k | 89 / 83k | 89 / 69k | 84 / 79k | 83 / 70k |
| prudent ÷ greedy cash, NW (s1; s2) | 1.20, 1.19; 1.12, 1.10 | 1.11, 1.06; 2.11, 2.01 | 1.18, 1.12; 2.21, 2.23 | 1.21, 1.12; 2.14, 2.07 | 1.10, 1.12; 2.17, 2.01 | 1.10, 1.04; 1.89, 1.88 | 1.38, 1.43; 2.26, 2.31 | 1.36, 1.22; 2.41, 2.17 |
| prudent first truck: bought/133, median day | 133 d49 / 133 d79 | 133 d92 / 132 d141 | 132 d97 / 129 d151 | 133 d97 / 130 d155 | 133 d88 / 129 d150 | 133 d94 / 132 d143.5 | 132 d107.5 / 130 d151.5 | 133 d111 / 132 d168.5 |
| greedy OO first truck median day | d12 / d13 | d18 / d28 | d17 / d22 | d17 / d22 | d17 / d23 | d17 / d23 | d17 / d22 | d17 / d22 |
| OO liquidated prudent / greedy (s1; s2) | 8 / 8; 8 / 3% | 8 / 7; 8 / 4% | 7 / 9; 7 / 7% | 8 / 9; 9 / 7% | 10 / 7; 8 / 8% | 8 / 7; 10 / 7% | 10 / 9; 9 / 6% | 8 / 10; 7 / 6% |
| liquidations (oo / fleet / broker), s1; s2 | 65 (31/12/22); 40 (28/6/4) | 60 (29/17/9); 53 (31/5/2) | 77 (32/22/8); 53 (34/5/2) | 82 (33/27/9); 59 (40/4/2) | 63 (29/20/8); 55 (36/3/2) | 75 (30/25/9); 58 (37/5/0) | 74 (31/21/7); 51 (36/6/0) | 70 (29/21/2); 56 (33/5/2) |
| NPC pay: spot / brokered / contract, s2 | 91 / 7 / 2% | 86 / 12 / 3% | 82 / 15 / 3% | 80 / 18 / 3% | 83 / 14 / 3% | 82 / 16 / 2% | 82 / 15 / 3% | 80 / 18 / 3% |

What the eight runs say:

- **Sizing the refill brings Q2 back to the baseline's level, not into the band.** R 1.0 paid more than the uncapped
  economy in Q2 (81 / 79% against 88 / 85%); at 0.85 and 0.9, and with the principled base, Q2 is 82–88%: the baseline's
  own 85–88% within noise, 2–8 points under the band's floor. Month 8 dips to 67–73% in seed 1 under every variant (the
  baseline's is 83%): the controller let the product rise to 0.6–0.9 in months 7–8 after months 5–6 came in under budget,
  and seed 1's month-8 sinks are low; the two-seed pair cannot say whether that is the horizon's slow monthly cycle or the
  month.
- **Without the one-way dial the sized budgets are not enforceable in the leaner seed.** Seed 2's refill budgets
  (27–31M a month) sit under what the economy at the floors (volume 0.5, rates 0.8) still commits (28–36M): months 6–8 at
  108–120% of budget with both levers pinned, the carry −9 to −13M at day 240 — G's failure again, milder.
- **The one-way dial makes them enforceable and costs nothing visible.** With the balance dial free to lower NPC rates
  (it walks `rateMult` down through months 4–8 as it does at baseline) the same seed commits 96–103% of budget in months
  7–8 and the carry closes to −0.9 … −4.1M; Q2 gains 0–3 points (0.85: 83 → 84; 0.9: 85 → 88 and 82 → 83); the rate
  lever sits at its floor on fewer days (69 → 22 at 0.9); hunting stays ±0.03. Its costs: the prudent owner-operator's
  first truck comes 4–17 days later in seed 2 (lower rates, slower saving), 0–6 days in seed 1; net emission is 5–9M
  lower over eight months; brokered freight's share rises two points more (the contract index lags the walked-down spot).
- **Among the three bases with the dial one-way**: 0.9 is the gentlest (first truck d94 / d143.5, carry −0.1 / −0.9M,
  Q2 88 / 83%) and has the thinnest prudent lead in seed 1 (cash 1.10×, below the baseline's own 1.20×); 0.85 holds the
  lead at the baseline's (1.21× / 2.14×) with Q2 88 / 84% and the carry −0.8 / −2.6M; the principled base has the best Q1
  (77 / 79%, its month-2 budget subtracts month 1's 10M of purchase loans) and the strongest prudent lead (1.36× / 2.41×)
  but the latest first truck (d111 / d168.5) and Q2 84 / 83%. In steady state the principled base and 0.85 are the same
  budget (the other faucets run 10–15% of sinks: 33–34M against 32–33M in seed 1); they part only where the other faucets
  move.
- **The guards at day 240 hold under every variant**: prudent ÷ greedy ≥ the baseline's own lead in seed 2 (1.9–2.4×
  against 1.1×) and within it in seed 1 (1.10–1.38× against 1.20×); prudent liquidations 7–10% against 8% at baseline,
  the greedy's 6–10% against 3–8%; every prudent owner-operator but one to four owns a truck by day 240, at median day
  88–111 (seed 1) and 141–169 (seed 2) against 49 / 79.

**Recommendation for the four-year check: the principled base with the one-way dial** (`refill` 1, `refillNet` true,
`dialOneWay` true), with 0.9 one-way as the gentler alternative if the first truck weighs more than the principle. The
case for the principled base is that it aims at the sinks the freight faucet has to balance and follows the other
operating faucets as they move — purchase loans as fleets grow, write-offs in a bust, insurance payouts, scrap, the fence
— where a fixed fraction of the sinks ignores them. (A correction to the 240-day report's wording: the airdrop's slices
and the vest are mints outside the operating faucets, `metrics.ts MINT_TAGS`, so neither the band nor the net base sees
them; the launch changes the economy around the cap, not the budget's arithmetic.) On eight months and two seeds it is within
noise of 0.85 on every row but the first truck. G runs beside it on one seed, as agreed, so Jeff sees the geometric path
to the end. The band's floor (0.90) is not reached in Q2 by any variant on these seeds; the baseline's own Q2 is 85–88%,
and the ten seeds decide whether the cap holds a quarter at 0.90 that the dials alone put at 0.85.

## 13. The two-seed four-year check (`em2-y4-base`, `-rnetd`, `-r90d`, `-g`; data, not the gate)

1460 days: base (cap off), R net one-way (refill 1, refillNet, dialOneWay) and R 0.9 one-way on seeds 1–2, G held on
seed 1. The gate's criteria as `report.pass` defines them; cells are Y1 Y2 Y3 Y4 unless marked.

| | base s1 | base s2 | R net 1-way s1 | R net 1-way s2 | R 0.9 1-way s1 | R 0.9 1-way s2 | G s1 |
|---|---|---|---|---|---|---|---|
| gate: band / supply / spread / free | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ |
| quarters in the band, of 16 | 3 | 4 | 3 | 2 | 2 | 4 | 3 |
| S/F by year | 74 82 93 90% | 76 83 92 90 | 80 83 88 90 | 85 86 87 89 | 79 84 89 89 | 83 88 88 89 | 81 81 86 88 |
| quarters Y3–Y4 | 101 90 90 91 88 90 91 89 | 101 89 91 89 90 91 91 88 | 89 88 86 89 90 93 87 88 | 84 89 88 88 89 88 91 88 | 89 90 88 88 90 90 88 89 | 85 90 89 88 85 90 91 90 | 89 89 81 87 89 87 87 90 |
| NPC pay committed by year | 511 315 366 363M | 478 311 334 338 | 405 306 325 318 | 384 344 403 389 | 419 275 288 310 | 389 323 393 369 | 407 293 309 265 |
| … ÷ budget | off | off | 100 99 99 90% | 100 101 95 87 | 101 99 99 95 | 100 100 100 89 | 123 208 461 832 |
| lever vol·rate means by year | 1·1 | 1·1 | .66·.94 .86·.97 .86·1 1·1 | .61·.93 .70·1 .84·1 1·1 | .69·.95 .83·.95 .69·.98 1·1 | .62·.94 .64·.98 .80·1 .88·1 | .52·.87 .50·.80 .50·.80 .50·.80 |
| days at vol floor by year | – | – | 151 71 0 0 | 150 20 12 0 | 117 106 71 0 | 135 104 30 16 | 280 365 365 365 |
| carry at day 1460 | – | – | +39.6M | +75.3M | +17.0M | +43.8M | −702.8M |
| balance dial (rateMult) at year end | .56 .50 .50 .50 | .54 .50 .50 .50 | .54 .50 .50 .50 | .55 .50 .50 .50 | .54 .50 .50 .50 | .54 .50 .50 .50 | 1 1 1 1 |
| posted/day by year | 705 624 598 603 | 628 607 625 656 | 568 729 667 800 | 474 552 683 875 | 591 703 530 798 | 482 497 656 762 | 464 425 410 410 |
| FD held at year end (after the close) | 42 80 81 115M | 39 78 77 107 | 36 70 73 95 | 37 70 89 121 | 37 65 67 91 | 36 63 81 115 | 36 61 62 73 |
| reserve at year end | 455 449 410 350M | 471 467 432 381 | 500 494 445 400 | 525 520 453 393 | 492 494 454 409 | 519 521 460 402 | 504 490 438 397 |
| net emitted of 600M at day 1460 | 250M | 219M | 200M | 207M | 191M | 198M | 203M |
| price at launch → day 1460 | $.00116 → .000417 | $.00159 → .000555 | $.00142 → .000422 | $.00232 → .000433 | $.00153 → .000382 | $.00242 → .000431 | $.00179 → .000458 |
| supply after launch → end | 80 → 115M | 78 → 107M | 70 → 95M | 70 → 121M | 65 → 91M | 63 → 115M | 61 → 73M |
| npc_market share of faucets, any year | 0% | 0% | 0% | 0% | 0% | 0% | 0% |
| facilities ever bought / owned at end | 0 / 0 | 0 / 0 | 35 / 1 | 7 / 0 | 41 / 1 | 4 / 0 | 8 / 1 |
| population dial: retired / wound down / entered | 0 / 0 / 0 | 0 / 15 / 0 | 4 / 40 / 145 | 6 / 20 / 5 | 5 / 60 / 165 | 12 / 40 / 0 | 53 / 293 / 0 |
| trucks in service at year end | 832 661 799 790 | 830 605 759 787 | 819 604 747 803 | 810 777 911 918 | 801 581 723 799 | 801 772 933 903 | 756 586 674 639 |
| carriers at year end | 516 506 611 683 | 519 495 591 679 | 513 557 667 790 | 492 479 571 654 | 513 550 641 778 | 494 469 552 625 | 386 309 329 350 |
| brokered share of NPC pay, four years | 41% | 34% | 23% | 28% | 23% | 29% | 16% |
| starter hubs' lowest week by year (DAL·LAX·PHX) | 43·123·26 54·106·21 42·99·26 41·109·24 | 37·89·20 48·115·27 59·114·32 68·111·29 | 23·44·10 33·82·16 66·124·32 77·147·38 | 16·19·6 46·73·25 58·120·32 100·146·39 | 23·44·10 32·67·16 37·97·21 75·147·36 | 16·19·6 39·99·25 67·109·30 66·101·27 | 20·44·10 26·72·15 24·61·13 29·77·15 |
| liquidations by year | 77 74 46 74 | 51 69 60 82 | 94 76 63 107 | 72 56 38 77 | 99 72 61 105 | 77 66 39 66 | 64 27 38 34 |
| liquidations, four years (companies) · debt written off | 271 (201) · 605k | 262 (181) · 573k | 340 (226) · 1.6M | 243 (151) · 723k | 337 (238) · 1.2M | 248 (153) · 853k | 163 (132) · 368k |
| OO liquidated prudent / greedy / random | 17 / 18 / 15% | 15 / 18 / 15 | 18 / 19 / 14 | 15 / 19 / 25 | 12 / 20 / 15 | 15 / 22 / 21 | 16 / 14 / 10 |
| OO median wealth prudent / greedy at day 1460 | 40k / 22k | 5k / 3k | 5k / 3k | 10k / 13k | 5k / 12k | 11k / 18k | 8k / 0.9k |
| prudent OO first truck, median day | d49 | d79 | d103 | d167 | d91 | d144 | d126.5 |
| fleets: prudent / greedy liquidated · NW | 43 / 30% · 71k / 282k | 35 / 23% · 113k / 319k | 40 / 70% · 104k / 65k | 18 / 28% · 161k / 204k | 43 / 70% · 52k / 107k | 28 / 20% · 62k / 242k | 30 / 18% · 6k / 134k |
| free path: median day, within 84 d | 21 d, 481/491 | 21 d, 429/496 | 26 d, 505/637 | 39 d, 320/471 | 27 d, 534/660 | 36.5 d, 334/466 | 21 d, 377/490 |
| strategy spread: top ÷ segment median | 1.13× | 1.11× | 1.27× | 1.21× | 1.26× | 1.16× | 2.48× (new:greedy) |

What four years show that eight months hid:

- **The band fails for the baseline too.** On 0.23.0 with the cap off, sinks ÷ faucets sits at 0.87–0.91 through years
  3–4 and 3–4 quarters of 16 land inside [0.90, 1.00]; the other four criteria pass. The cap variants pass 2–4 quarters
  and the same four criteria. The band's floor is where this economy lives, so the quarters flip on noise; what keeps
  the ratio under 0.90 in years 3–4 is not the freight faucet the cap paces but the other operating faucets (purchase
  loans 7–10% of faucets, write-offs, insurance payouts) and one accounting wash: the NPC factor's advances on brokers'
  paper are faucets (`npc_factor` → carrier) later repaid into `sink:npc_factor`, which is why cash paid runs 15–18%
  over the pay committed and both sides of the ratio are inflated toward 1. The gate as written will fail the baseline
  on these two seeds, cap or no cap; moving the floor to 0.85, or taking the factor's pass-through out of both sides,
  is a decision above the cap.
- **R stops binding after year 2.** Once the balance dial reaches its 0.5 floor (year 2, under every schedule and at
  baseline) and the cold start's boom is gone, R's budget (sinks − other faucets + subsidy) sits above what the
  economy commits: the levers sit at 0.86–1.0 from year 3, the carry ends +17 to +75M, and the budget is spent to
  87–95%. With the volume dial stood down meanwhile (the baseline's sits at its 0.75 floor from year 2), the cap-on
  economy posts 20–33% more freight than the baseline in year 4 (800–875 against 603–656 a day), clears 15% more, and
  in seed 2 ends with more FD held than the baseline (121M against 107M). Over four years R emits 200–207M of the 600M
  reserve against the baseline's 219–250M: 5–20% less, all of it in years 1–2.
- **G is a permanent half-volume economy, not a schedule.** The budget is irrelevant from year 2 (committed 208%, 461%,
  832% of it; carry −703M); the levers sit at 0.5 × 0.8 for 1,095 days; the population dial winds down 293 bot carriers
  and holds 53 restarts (carriers 350 against 683), the starter boards stay at 13–15 open loads in Phoenix for four
  years, FD held ends at 73M (−37%), and the owner-operator personas end with 1–14k of wealth. It emits 203M: the same as R.
- **npc_market is 0% of faucets in every year of every run.** Bots bought 35–41 facilities under the cap in seed 1
  (0 at baseline) but held one at the end (load share 1–3%). The 5% tripwire is not approached; nothing to bring under
  the budget.
- **The dial works both ways under R and one way under G.** R's generous years 3–4 run the posted-per-truck ratio over
  the band's ceiling in seed 1 and the dial adds 145–165 bot carriers (none at baseline); G drives it under the floor
  for 542 days.
- **Brokered freight** is 34–41% of NPC pay over four years at baseline, 23–29% under R, 16% under G: the opposite of
  the 120-day reading (brokers' contract rates lag the capped spot early, then the capped economy's thinner board
  starves the broker channel).
- **The starter hubs** are thin only in the opening year under R (the held opening's first week) and at or above the
  baseline from year 2; under G thin throughout.
- **The personas.** Every owner-operator persona ends four years with almost nothing in cash (the season close burns
  what is above four weeks of spending, and day 1460 is a close day) and 3–40k of wealth; liquidated 12–25%, the
  prudent one at or under the greedy one on every run but G. The cap bites leverage where it is: under R in seed 1 the
  greedy fleets liquidate at 70% (30% at baseline) and end with a third of the prudent fleets' net worth; in seed 2 the
  greedy fleets keep their lead with $1,800–2,100 of outside money each. The prudent first truck is a quarter's work
  under R (d91–167 against d49–79), as the 240-day pair said.
- **The launch** (day 730) raises the opening price under the cap (less FD outstanding: $0.0014–0.0024 against
  $0.0012–0.0016) and leaves the end price where the baseline's is ($0.00038–0.00056); the price falls 70–80% in the
  two years after launch on every run. Supply grows 35–82% after launch under R against 38–43% at baseline.

**What this means for the gate's configuration (§12).** The retune does what it was built for — it tames the cold
start (Q1 0.62/0.69 → 0.77/0.79, the opening board alive, month 1 on budget) and, under R, lets go when the economy
has balanced itself — and it does not do what a four-year supply schedule would have to: G cannot be enforced inside
the floors, and R, once slack, hands the volume dial's work to nobody. The one change the four years ask for is small:
the volume dial should also stay one-way under the cap (it may cut NPC volume as it does at baseline, never add), so
the long-run economy keeps the baseline's volume discipline while the cap still cannot be pushed up against; one line
in `monthlyStabilizers` through `dialMayMoveTo`, with the precedence test extended, and one two-seed four-year pair
before the ten seeds. The band itself is a decision above the cap.

## 14. Both dials one-way, and the ratio's accounting (`em2-y4b-base`, `em2-y4b-rnetdd`; the producer's go)

Built: the volume dial under the cap through the same rule as the balance dial (`dialMayMoveTo`; its own switch,
`volumeDialOneWay`), and the ratio's accounting as a measurement beside the gate's: an NPC's advance on a company's
paper — the factor or the lessor paying a carrier what a broker owes it — is tagged apart (`receivables.ts NPC_ADVANCE`,
`faucet:npc_advance`; the repayment lands in `sink:npc_factor` as before), the cash column leaves it out, and
`report.ratios` gives the raw ratio and the corrected one (both sides less the wash) by quarter, with the other
operating faucets by year. The gate's definition and the band in config are unchanged. Then the pair: 1460 days, seeds
1–2, base and R net with both dials one-way ("R both"), beside §13's R net with the balance dial one-way alone ("R rate").

| | base s1 | base s2 | R both s1 | R both s2 | R rate s1 (§13) | R rate s2 (§13) |
|---|---|---|---|---|---|---|
| gate: band / supply / spread / free | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ |
| quarters in the raw band, of 16 | 3 | 4 | **13** | **14** | 3 | 1 |
| S/F by year, raw | 74 82 93 90% | 76 83 92 90 | 88 91 93 92 | 91 94 94 93 | 80 83 88 90 | 85 86 87 89 |
| S/F by year, corrected | 73 81 91 85% | 75 82 91 86 | 87 89 92 89 | 90 93 94 91 | (proxy) 79 80 86 87 | 82 84 85 86 |
| committed ÷ budget by year | off | off | 100 100 100 106% | 101 100 101 101 | 100 99 99 90 | 100 101 95 87 |
| lever vol·rate by year | 1·1 | 1·1 | .62·.94 .62·.93 .53·.87 .50·.80 | .57·.93 .59·.96 .54·.88 .50·.80 | .66·.94 .86·.97 .86·1 1·1 | .61·.93 .70·1 .84·1 1·1 |
| days at vol floor by year | – | – | 153 169 285 365 | 169 99 264 365 | 151 71 0 0 | 150 20 12 0 |
| NPC pay committed by year | 511 315 366 363M | 478 311 334 338 | 335 252 200 155 | 298 263 226 176 | 405 306 325 318 | 384 344 403 389 |
| posted / cleared a day, Y4 | 603 / 323 | 656 / 307 | 303 / 152 | 345 / 176 | 800 / 313 | 875 / 366 |
| carriers · trucks in service, Y4 | 683 · 790 | 679 · 787 | 342 · 441 | 302 · 469 | 790 · 803 | 654 · 918 |
| population dial retired / wound down / entered | 0 / 0 / 0 | 0 / 15 / 0 | 69 / 279 / 0 | 65 / 324 / 0 | 4 / 40 / 145 | 6 / 20 / 5 |
| FD held at year end | 42 80 81 115M | 39 78 77 107 | 27 53 52 58 | 21 20 13 13 | 36 70 73 95 | 37 70 89 121 |
| net emitted of 600M at day 1460 | 250M | 219M | 98M | 78M | 200M | 207M |
| price launch → end | $.00116 → .000417 | $.00159 → .000555 | $.00285 → .000902 | $.0119 → .00106 | $.00142 → .000422 | $.00232 → .000433 |
| companies in debt at the end (FD) | 280 (−251k) | 281 (−991k) | 378 (−12.0M) | **426 (−42.0M)** | 326 (−1.1M) | 184 (−782k) |
| liquidations, four years | 271 | 262 | 169 | 136 | 340 | 243 |
| OO liquidated prudent / greedy | 17 / 18% | 15 / 18 | 16 / 19 | 17 / 16 | 18 / 19 | 15 / 19 |
| fleets liquidated prudent / greedy · NW | 43 / 30% · 71k / 282k | 35 / 23% · 113k / 319k | 28 / 63% · 6k / −62 | 13 / 20% · 7k / 19k | 40 / 70% · 104k / 65k | 18 / 28% · 161k / 204k |
| prudent OO first truck, median day | d49 | d79 | d131 | d189 | d103 | d167 |
| npc_market share of faucets, Y4 | 0% | 0% | 1% | 3% | 0% | 0% |
| starter hubs' lowest week, Y4 (DAL·LAX·PHX) | 41·109·24 | 68·111·29 | 26·54·10 | 24·52·9 | 77·147·38 | 100·146·39 |

- **Both dials one-way puts the ratio in the band by starving the economy.** 13–14 quarters of 16 in [0.90, 1.00], and
  the carriers halve (683 → 342), the trucks in service fall 44%, cleared loads halve (323 → 152 a day), NPC pay in year
  4 is 155–176M against 338–363M, FD held ends at 58M and 13M against 115M and 107M, 378–426 companies are in debt at the
  end (−12M and −42M against −0.3M and −1.0M), the dial winds down 279–324 bot carriers, Phoenix's board sits at 9–10
  open loads for four years, and the prudent first truck comes on day 131 / 189. The mechanism: R's budget re-emits what
  comes back; a volume dial that can only cut takes freight out, the sinks fall with it, the budget falls, the cap's own
  lever cuts more, and nothing adds anything back — a ratchet, which in §13's run the stood-down volume dial had kept
  from closing. The option stays behind `volumeDialOneWay`, off.
- **The corrected ratio.** The NPC advance-and-repayment wash is 5% of faucets in year 1 and 25–29% by years 3–4
  (133–163M a year at baseline), and taking it out of both sides lowers the ratio 1–5 points: the baseline's years 3–4
  read 0.91 / 0.85 and 0.91 / 0.86 corrected against 0.93 / 0.90 and 0.92 / 0.90 raw. The other operating faucets are
  purchase loans (5–6% of faucets in years 1–2, 2–3% after; without them the corrected ratio rises 3–6 points early, 2–3
  late), lease deposits returned (1–4%), and under 0.5% each of insurance payouts, scrap, write-offs, dealer buybacks and
  the NPC market. Quarters passing of 16, base s1 / s2 and R rate s1 / s2 (R rate by proxy, repayments standing in for
  the advances; the proxy sits within 1–3 points of the exact figure on the baseline):

  | band | base s1 | base s2 | R rate s1 | R rate s2 | R both s1 | R both s2 |
  |---|---|---|---|---|---|---|
  | raw [0.90, 1.00] every quarter (the gate today) | 3 | 4 | 3 | 1 | 13 | 14 |
  | raw [0.85, 1.00] every quarter | 12 | 9 | 9 | 12 | 15 | 15 |
  | corrected [0.90, 1.00] every quarter | 1 | 2 | 1 | 0 | 7 | 12 |
  | corrected [0.85, 1.00] every quarter | 8 | 8 | 7 | 10 | 15 | 15 |
  | corrected [0.80, 1.00] every quarter from year 2, of 12 | 11 | 12 | 11 | 12 | – | – |
  | corrected trailing four quarters ≥ 0.85, years 3–4, of 8 | 8 | 8 | 6 | 7 | – | – |

- **Where the ratio lives.** A healthy economy on these rules — the baseline, or the cap that lets go — runs at
  0.85–0.91 corrected in years 3–4 with quarters swinging ±5 points around 0.87. No floor above 0.80 passes every
  quarter on a healthy run; the only runs that pass the band as written are the starved ones. The supply criterion, which
  measures the growth the band is a proxy for, passes on every run.

**Recommendations.**

- *The gate's configuration* — **superseded by §15**: measured on the corrected base, this configuration sits at both
  floors for four years and is the starved economy; §13's release was the wash's re-emission. As written that night:
  R net with the balance dial one-way and the volume dial held (§13's "R rate"), in LIVE_LEVERS spelled out: `token.emission.enabled` true; `firstMonthFd` 36,000,000; `multRange` [0.8, 1]; `volRange`
  [0.5, 1]; `pacing.horizonDays` 30; `pacing.windowDays` 14; `pacing.lagDays` 5; `pacing.stepPerDay` 0.03;
  `pacing.warmStart` 0.5; `pacing.holdAfterLagDays` 2; `refill` 1; `refillNet` true; `refillWindowDays` 90;
  `subsidy.firstMonthFd` 3,000,000; `subsidy.totalFd` 60,000,000; `dialOneWay` true; `volumeDialOneWay` false (capFd
  and genesisFd as the config has them). What it buys: the cold start tamed (Q1 0.62 / 0.69 → 0.77 / 0.79, month 1 on
  budget, the opening board alive, the leveraged bot punished), 5–20% less emitted over four years, and an economy the
  size of the baseline's afterwards; what it does not do: hold a four-year supply schedule, which neither schedule can
  inside the floors without starving the world.
- *The band:* read the corrected ratio (the wash will grow with brokerage and factoring, and today it is a quarter of
  the faucet flow), and read it over the trailing four quarters rather than one, because the quarters swing ±5 points:
  corrected, trailing four quarters, at or above 0.85 and at most 1.00, from the third year — which the baseline passes
  8 of 8 and the healthy cap 6–7 of 8 (its misses at 0.845–0.848), and the starved run would pass while the supply
  criterion would still be the one that catches a runaway. A per-quarter floor at 0.80 corrected from year 2 is the
  alternative (11–12 of 12 on every healthy run); 0.85 per quarter raw keeps the wash in and passes 9–12 of 16. The
  gate's definition and the band in config stay as they are until Jeff and the producer choose.

## 15. The recommended configuration on the corrected base (`em2-y4c-rnetd`; the producer's acceptance review, 2026-11-08)

The retag of §14 changed R net's base. Before it, an NPC's advance on a broker's paper was tagged `npc_factor` or
`npc_lessor`, so it sat inside the freight faucets and was never subtracted from the trailing sinks, while its repayment
(`sink:npc_factor`) counted as a sink: the base re-emitted the wash one for one, 25–29% of faucet flow by years 3–4.
§13's "R rate" ran on that base; §14's "R both" was the only four-year run on the corrected one, and the ratchet and the
smaller base were confounded in it. So the §14 levers exactly — R net, the balance dial one-way, the volume dial held —
on seeds 1–2 for 1460 days on the code as it stands, beside the baseline (`em2-y4b-base`, same code), §13's R rate and
§14's R both. No code changed for this run.

| | base s1 | base s2 | **R net 1-way s1** | **R net 1-way s2** | R rate s1 (§13) | R rate s2 (§13) | R both s1 (§14) | R both s2 (§14) |
|---|---|---|---|---|---|---|---|---|
| gate: band / supply / spread / free | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ | ✗ ✓ ✓ ✓ |
| quarters in the raw band, of 16 | 3 | 4 | **12** | **10** | 3 | 1 | 13 | 14 |
| S/F by year, raw | 74 82 93 90% | 76 83 92 90 | 87 93 91 93 | 89 95 91 90 | 80 83 88 90 | 85 86 87 89 | 88 91 93 92 | 91 94 94 93 |
| S/F by year, corrected | 73 81 91 85% | 75 82 91 86 | 86 91 91 90 | 89 92 90 87 | (proxy) 79 80 86 88 | 83 84 85 86 | 87 89 92 89 | 90 93 94 91 |
| corrected trailing four ≥ 0.85, years 3–4, of 8 | 8 | 8 | 8 | 8 | 5 | 5 | 8 | 8 |
| budget by year | off | off | 330 246 227 193M | 315 268 249 211 | 404 308 330 352 | 383 342 422 448 | 334 252 200 146 | 296 262 225 175 |
| NPC pay committed by year | 511 315 366 363M | 478 311 334 338 | 338 246 239 208 | 330 276 272 236 | 405 306 325 318 | 384 344 403 389 | 335 252 200 155 | 298 263 226 176 |
| committed ÷ budget by year | off | off | **102 100 106 108%** | **105 103 109 112** | 100 99 99 90 | 100 101 95 87 | 100 100 100 106 | 101 100 101 101 |
| lever vol·rate by year | 1·1 | 1·1 | **.52·.86 .50·.80 .50·.80 .50·.80** | **.51·.85 .50·.80 .50·.80 .50·.80** | .66·.94 .86·.97 .86·1 1·1 | .61·.93 .70·1 .84·1 1·1 | .62·.94 .62·.93 .53·.87 .50·.80 | .57·.93 .59·.96 .54·.88 .50·.80 |
| days at vol / rate floor by year | – | – | 285/217 365/365 365/365 365/365 | 318/228 365/365 365/365 365/365 | 151/48 71/25 0/0 0/0 | 150/105 20/0 12/0 0/0 | 153/72 169/104 285/176 365/357 | 169/76 99/44 264/177 365/365 |
| carry at day 1460 | – | – | **−36.0M** | **−71.8M** | +39.6M | +75.3M | −9.2M | −5.2M |
| posted / cleared a day, Y4 | 603 / 323 | 656 / 307 | 408 / 200 | 440 / 213 | 800 / 313 | 875 / 366 | 303 / 152 | 345 / 176 |
| carriers at year end | 516 506 611 683 | 519 495 591 679 | 386 313 360 **404** | 419 318 339 **404** | 513 557 667 790 | 492 479 571 654 | 375 315 310 342 | 318 234 265 302 |
| trucks in service, Y4 | 790 | 787 | 585 | 607 | 803 | 918 | 441 | 469 |
| population dial retired / wound down / entered | 0 / 0 / 0 | 0 / 15 / 0 | 64 / 220 / 0 | 47 / 240 / 0 | 4 / 40 / 145 | 6 / 20 / 5 | 69 / 279 / 0 | 65 / 324 / 0 |
| FD held at year end | 42 80 81 115M | 39 78 77 107 | 28 47 52 61 | 34 54 66 85 | 36 70 73 95 | 37 70 89 121 | 27 53 52 58 | 21 20 13 13 |
| net emitted of 600M at day 1460 | 250M | 219M | 110M | 119M | 200M | 207M | 98M | 78M |
| operating net (F − S) by year | 136 75 39 59M | 120 68 35 51 | 55 25 29 23 | 48 18 36 36 | 92 68 48 44 | 66 57 67 59 | 51 31 20 17 | 37 20 18 18 |
| price launch → end | $.00116 → .000417 | $.00159 → .000555 | $.00291 → .000641 | $.00453 → .00107 | $.00142 → .000422 | $.00232 → .000433 | $.00285 → .000902 | $.0119 → .00106 |
| companies in debt at the end (FD) | 280 (−0.3M) | 281 (−1.0M) | **354 (−17.8M)** | **361 (−8.2M)** | 326 (−1.1M) | 184 (−0.8M) | 378 (−12.0M) | 426 (−42.0M) |
| liquidations, four years | 271 | 262 | 195 | 159 | 340 | 243 | 169 | 136 |
| OO liquidated prudent / greedy | 17 / 18% | 15 / 18 | 17 / 19 | 17 / 23 | 18 / 19 | 15 / 19 | 16 / 19 | 17 / 16 |
| fleets liquidated prudent / greedy · NW | 43 / 30% · 71k / 282k | 35 / 23% · 113k / 319k | 35 / 57% · 19k / 1k | 8 / 18% · 21k / 72k | 40 / 70% · 104k / 65k | 18 / 28% · 161k / 204k | 28 / 63% · 6k / 0 | 13 / 20% · 7k / 19k |
| prudent OO first truck, median day | d49 | d79 | d114.5 | d189 | d103 | d167 | d131 | d189 |
| brokered share of NPC pay | 41% | 34% | 37% | 46% | 23% | 28% | 31% | 25% |
| npc_market share of faucets, Y4 | 0% | 0% | 1% | 0% | 0% | 0% | 1% | 3% |
| starter hubs' lowest week, Y4 (DAL·LAX·PHX) | 41·109·24 | 68·111·29 | 31·70·14 | 39·75·16 | 77·147·38 | 100·146·39 | 26·54·10 | 24·52·9 |

(The trailing-four count here is the flow-weighted ratio over the four quarters from the report's own fields, with
§13's run by the exact-field proxy, which puts R rate at 5 of 8 with readings of 0.84–0.88; §14 counted 6–7 by the
earlier proxy. The misses sit at the floor's edge either way.)

- **It never releases.** The levers open at the warm start and go to both floors inside the first year (285 / 318 days at
  the volume floor, 217 / 228 at the rate floor) and stay there for 1,095 days; committed runs 102–112% of the budget
  every year and the carry ends −36M / −72M. The release after year 2 in §13 was the wash: the old base paid the budget
  25–29% of faucet flow more than the sinks' real return, and that accident is what let the levers go. On the corrected
  base the recommended configuration is G in R's clothing, and unenforceable at the floors like G (§13), though by 6–12%
  rather than 832%.
- **It is the starved run, less the ratchet.** Carriers 404 / 404 against 683 / 679 (−41%), trucks in service 585 / 607
  against 790 / 787 (−26 / −23%), cleared loads 200 / 213 a day against 323 / 307 (−38 / −31%), posted 408 / 440 against
  603 / 656; the dial winds down 220 / 240 bot carriers and retires 64 / 47 (0 / 15 and none at baseline); FD held ends
  61M / 85M against 115M / 107M; 354 / 361 companies are in debt at −17.8M / −8.2M against 280 / 281 at −0.3M / −1.0M;
  the prudent owner-operator's first truck comes on day 114 / 189 against 49 / 79; Phoenix's board sits at 14–16 open
  loads in year 4 against 24–29. §14's R both ended at 342 / 302 carriers: the volume-dial ratchet accounted for the
  last 60–100 of them, the corrected base for the rest.
- **And the band passes.** Corrected 0.86–0.92 by year, the trailing four 0.87–0.94 and 8 of 8, 12 and 10 raw quarters
  of 16 in [0.90, 1.00] — §14's point in its sharpest form: the band cannot fail a binding R net; only liveness floors
  can (carriers and cleared loads at 59–69% of the baseline's; the debt 8–70× it).
- **Net emitted** 110M / 119M of 600M (base 250 / 219; R rate 200 / 207; R both 98 / 78). The operating net, 132M /
  136M over four years, is the subsidy (52M) plus the cold start (12–14M) plus 66–72M the floors could not hold, of
  which the carry is 36M / 72M. The launch price doubles or triples ($0.0029 / $0.0045 against $0.0012 / $0.0016): less
  FD outstanding, a thinner economy to hold it.
- **Against the planned curve** (the producer's column: the opening 36M plus the subsidy, cumulative, so the overshoot is a
  measured number). The month-1 figure of the plan is gross NPC pay while what stays out is net, so the measured net sits
  under the plan until month 12–18 and the whole overshoot accrues at the floors afterwards; the gross overshoot is the
  budget the floors could not hold (Σ committed − Σ budget).

  | closed months | planned | Σ(F − S) s1 / s2 | overshoot s1 / s2 | gross over budget s1 / s2 | reserve drawdown s1 / s2 |
  |---|---|---|---|---|---|
  | 1 | 36.0M | 14.4 / 12.3M | −21.6 / −23.7M | +1.3 / −5.9M | 23.2 / 21.0M |
  | 3 | 41.6M | 30.3 / 19.2 | −11.3 / −22.4 | +8.6 / −1.6 | 39.1 / 27.9 |
  | 6 | 48.9M | 40.0 / 28.5 | −8.9 / −20.4 | −1.0 / +5.3 | 48.8 / 37.2 |
  | 12 | 60.6M | 56.6 / 50.2 | −4.0 / −10.4 | +6.9 / +17.2 | 65.4 / 58.9 |
  | 18 | 69.2M | 72.9 / 60.5 | +3.7 / −8.7 | +2.1 / +23.4 | 81.7 / 69.2 |
  | 24 | 75.5M | 86.2 / 74.1 | +10.7 / −1.4 | +8.4 / +21.3 | 95.0 / 82.8 |
  | 30 | 80.1M | 92.7 / 90.1 | +12.6 / +10.0 | +11.7 / +40.3 | 69.3 / 70.3 (the launch reset) |
  | 36 | 83.5M | 109.4 / 101.4 | +25.8 / +17.9 | +20.2 / +41.3 | 86.2 / 81.8 |
  | 42 | 86.0M | 120.1 / 120.6 | +34.1 / +34.6 | +29.9 / +57.7 | 97.1 / 101.3 |
  | 48 | 87.9M | 132.2 / 136.4 | **+44.3 / +48.5** | **+39.7 / +75.2** | 109.4 / 117.2 |

  The cold start's own line holds on both seeds: month 1 committed 37.3M / 30.1M of a 36.0M budget (104% / 84%); Q1
  corrected 0.80 / 0.83.
- **Why it cannot balance.** The economy retains 10–16% of NPC freight pay as new supply whatever its size: freight pay
  less the base (sinks − advances − other faucets) is 10–16% of freight pay at the baseline in years 3–4 and 11–15% at
  the floors. The cap's levers scale the economy, not the retention rate, so with the subsidy at 4–8M a year in years 3–4
  the only balancing economy is a sixth to a ninth of the baseline's, below the floors; the budget is overshot for three
  years and the world shrinks to where the floors stop it.
- **The base is right; the subsidy is the supply schedule.** The corrected base is the zero-net-emission base by
  construction (sinks less every other faucet is the freight pay consistent with a flat supply), so under R net the
  allowed net emission is the subsidy, plus the cold start and whatever the floors let through. The subsidy at 60M total
  (55M in 48 months: 28 / 15 / 8 / 4M a year) is a near-zero supply policy that this economy cannot live inside; the
  retune's §7 sized it as a growth allowance on top of a base that was, unknowingly, re-emitting the wash. The arithmetic
  of the candidates, as the gap between what the economy pays NPC carriers and the budget it would have had (budget =
  base + subsidy; a positive gap is what the levers must cut before any feedback, a negative one is slack):

  | subsidy schedule | by year, Y1–Y6 | gap at the baseline's flows, Y1–Y4 (s1 / s2) | gap at the floors' flows (this run) |
  |---|---|---|---|
  | current: 3M × 0.95^m, 60M total | 28 15 8 4 2 1M | 23% 18% 8% 15% / 21% 17% 8% 13% | 8% 4% 9% 9% / 7% 1% 10% 13% |
  | 3M × 0.99^m, 300M total | 34 30 27 24 21 19M | 22% 13% 3% 9% / 19% 12% 2% 8% | 6% −2% 1% 0% / 4% −4% 4% 5% |
  | flat 4M a month (48M a year) | 48 48 48 48 48 48M | 19% 8% −3% 3% / 16% 6% −4% 1% | 2% −9% −8% −11% / 0% −11% −4% −5% |
  | G's curve as the subsidy, 36M × 0.94^m | 314 150 71 34 16 8M | −38% −22% −9% 7% / −44% −25% −11% 5% | slack throughout but Y4 s2 (1%) |
  | proportional: `refill` 1.15, no subsidy | 15% of the base | 18% 11% −3% 3% / 16% 9% −3% 2% | 4% −4% −1% −3% / 3% −7% 0% 2% |

  Three candidates are worth a two-seed four-year pair before the ten seeds: **flat 4M a month**
  (`subsidy.firstMonthFd` 4,000,000 with `totalFd` 2,000,000,000, r 0.998 — the config's shape has no flat option),
  which binds in the boom (16–19% in year 1, 6–8% in year 2 at the baseline's flows) and is slack from year 3: §13's R
  rate by design instead of by accident; **3M → 300M** (r 0.99), which still binds 8–9% in year 4 at the baseline's flows
  and would leave the economy somewhat smaller; and the **proportional allowance** (`refill` 1.15, `subsidy.firstMonthFd`
  0), the economy's own retention rate as the budget, which cannot starve because it scales with the base and shaves the
  boom by about a fifth. None of them is G's curve: a baseline-sized economy's natural net emission (35–60M a year by
  year 4, growing with players) exceeds G's increments from year 4 (34M) on, so the published curve and a baseline-sized
  economy part ways in year 4–5 unless the retention rate itself falls — which is the rules' doing (fees, taxes, the
  profit-tax burn), not the cap's.

**Recommendation before the clause** (as put after this batch; 16.5 carries the one that stands). §14's gate
configuration is withdrawn: measured on the base it was meant for, it is the starved economy. The mechanism stands (the draw at the invoice, the horizon, volume before rates, the one-way balance dial, the
corrected base); the subsidy is the supply schedule and its size is Jeff's decision, informed by the pair above (six
sims, 1460 days, seeds 1–2) before the ten seeds. The cap stays off in `economy.config.ts` and `live.ts` meanwhile.

## 16. The gate as approved, the clause, and the subsidy schedules (2026-11-08)

### 16.1 The gate's definition

Jeff approved the three calls put to him — the band, the floors with the cold start's line, and the first truck —
("I approve of all 3 of your calls… I trust you", 2026-11-08; studio/DECISIONS.md) and ruled the first truck hard by
design, as in the real world (buying FD is the fast way): its pacing is reported, never tuned to or gated. The gate, read
over a cap run and its cap-off twin of the same seed on the same code (`npm run gate -- --twin runs/<cap-off> --cap
runs/<cap>`; `apps/sim/src/gate.ts`; its definition `killCriteria.gate` in the config, its own key — the per-quarter band
`killCriteria.sinkFaucetPerQuarter` and the stabilizers' target keep their readings):

- **(a) the band, the rules' check:** the corrected sinks ÷ faucets (the NPC advance-and-repayment wash out of both
  sides, §14) over the trailing four quarters, at every quarter end from the fourth year, in [0.84, 1.00] — approved
  from the third year at 0.85; moved to the fourth year on 2026-11-08 by the producer's rule, because the third year's
  readings lean on the launch quarter (16.4, 16.5); and calibrated to 0.84 from the first ten seeds (16.7), the one
  step the rule allowed and the last: the step is the subsidy's share, a freed cap reading a point or two under its own
  twin. The twin's readings at the same quarter-ends are reported beside the cap's, so the next calibration has the
  figure.
- **(b) the floors, the cap's check,** against the twin at the ends of years 3 and 4: carriers in service at or above
  72% of the twin's at the end of year 3, while the cap is still releasing, and 75% at the end of year 4 (calibrated
  from the ten seeds, 16.7; approved at 75% for both); cleared loads a day (a 30-day mean to the year's last day) at or
  above 75% at both; the companies' debt in FD at or under 7.5% of the FD held. The debt line's history: a multiple of the twin's fails a healthy run when the twin's debt is near
  zero (§13's R rate: 1.1M against 0.25M), a bare figure ignores the world's size; the producer set the scale-free line
  at 3% on the readings then in hand (healthy at or under 1.2%, starved from 9.7%), the subsidy batch (16.3) read 2.1–6.0%
  on the schedules that free the economy, and the line moved to 7.5%, the absolute figure, the twin-relative figure and
  the in-debt count reported beside it. The daily figures `DayMetrics.inDebt` and `debtFd` (closeDay counts companies
  below zero as the report's failures do) let the line read the ends of years 3 and 4 on runs made from this commit on;
  older reports read the end of the run.
- **(c) the cold start's own line:** month 1 committed at or under 110% of its budget; Q1 corrected reported.
- **(d) supply growth, strategy spread and the free path** as `report.pass` defines them.
- **Reported, never gated:** the prudent owner-operator's first truck; the NPC market's purchases as a share of NPC pay
  committed against the 5% tripwire (`emission.pay.market`, whatever route paid the sale — under the cap most facility
  sales are advanced by the factoring contract and post under the factor's tag, so the `npc_market` faucet's share stays
  near zero while the sales are real, 6.4% of NPC pay on one of the red team's seeds; the faucet-tag figure is kept beside
  it for the record); net emitted against the planned curve (the opening month plus the subsidy); the first sizing's
  headroom for the record.

The ten seeds run in two waves of ten (each cap run with its twin), each wave launched in a clear `pgrep -f vitest` gap,
on the schedule Jeff picks; failing his answer, on flat 5M, the producer's recommendation to him.

### 16.2 The clause: the volume dial under the cap

The subsidy batch (16.3) showed the band and the cap's held volume dial at odds: the band's 0.85 was calibrated on the
baseline, whose volume dial trims NPC freight to its 0.75 floor from year 2, while under the cap §13's precedence held the
dial at 1.00, so a cap that lets go posted 12–33% more NPC freight than the twin and lived at 0.83–0.87 corrected. The
producer approved one clause as a design change inside the cap: **the published volume dial follows the rules' dial while
the cap is slack and holds where it stands while the cap binds; it never cuts on the cap's behalf.** Precisely
(`emission.ts emissionSlack`, `volumeDialMayMoveTo`; `step.ts monthlyStabilizers`): the cap is *slack* once the lever
product has sat at 1 for `pacing.lagDays + holdAfterLagDays` closed days (`EmissionState.daysAtOne` counts them) and
*binding* from the day the product drops under 1, when the count restarts — so the reading cannot flap day to day; while
slack the dial moves as the rules say, both ways (or down only with `volumeDialOneWay`); while binding it holds, and keeps
its position across a re-bind rather than resetting. `dialOneWay`'s meaning for the balance dial is unchanged (hold, or
lower only), and `ceiling.ts` keeps it too. With the cap off nothing changes: the replay tests run cap-off and are
byte-identical. Tests (`emission.test.ts`): precedence in every state — off both ways, binding held, slack by the rules'
own step, the re-bind holding where the dial stands, the switch down-only while slack — the hysteresis day by day, and no
path on which the dial cuts under a binding cap, whatever the rules want and whatever the switch says. Why no ratchet:
§14's spiral needed a dial that cut while the cap bound; a dial that only moves while the cap is slack cannot start one.

**The red team's three holes** (its first pass, from the code, 2026-11-08), folded into the same commit so the re-run
measures the corrected cap once:

1. *Brokered and contract freight never saw the rate lever.* The cap's ρ (`w.stab.emissionMult`), the balance dial and the
   reserve factor sat in `rf`, which priced spot alone (freight.ts refRate); an NPC shipper's tender to a broker and an
   NPC contract were priced off the contract index — dpow(ratio) × weather × season, smoothed — with no lever on them, so
   the budget was drawn at the uncut rate on 35–45% of NPC pay, carriers chased the whole brokered pay, and the volume
   lever did the rate lever's work (the brokered share rose to 37–46% under the cap against 34–41% at baseline, §15).
   Now the cap's lever multiplies the haul's pay in both — `lane.baseRate × emissionMult × contractIndex × …` in the
   tender's reference (freight.ts) and in `contractRate` (contracts.ts) — and not the cost pass-throughs (fuel, tolls,
   terrain, theft, deadhead), as `rf` does for spot. The contract index stays the market's own, and the balance dial and
   the reserve factor keep their reach (spot only): that they never reached contracts is the contract market's design,
   a ruleset question outside the cap. With the cap off the multiplier is 1 and nothing changes.
2. *The carry crossed the launch unchanged* (R net on seed 2: −23M at day 730, a beta overspend repaid by cuts in real FD,
   or beta slack spent as real FD). `launchToken` now zeroes `carryFd` beside the wallets' reset; the month in progress
   keeps its budget and its commitments.
3. *Facility sales paid the owner from `npc_market` outside the budget* (saleValue 1.18–1.20 × ref × miles, already cut by
   ρ through ref, but never drawn), and a company hauling its own goods pays itself nothing, so a player with facilities and
   trucks kept the whole sale while NPC spot was cut. `bill()` now draws an `npc_market` purchase on the budget at the
   sale, as its own kind (`market`, beside spot, brokered and contract in `emission.pay`); `npc_market` joins the freight
   faucets (R net's base does not subtract it; the ledger's NPC cash pay and the report's freight tags count it). The
   facilities' output and the 60% hub-share cap scaled by v are the facilities layer's ruleset, recorded there by the
   producer. Noted for later rulesets, no action: the fence's pay (`faucet:fence`) sits outside the budget when the Back
   Lot switches on under the cap. From the red team's runs, for the record: detention under the cap is 3.4–4.0% of NPC
   pay — a dock cost, drawn on the budget at the invoice like the rest, not a hole.

Tests (`emission.test.ts`): the contract rate and every tendered load's shipper rate fall by the lever's share and no
more; the market's purchase draws on the budget as its own kind and lands in the cash column; the launch zeroes the carry
either way and leaves the month's budget. The ablation before these fixes (the clause alone: `em2-y4t-f5`, `-f4`,
`-p120`) is kept beside the re-run in 16.4.

### 16.3 The subsidy batch before the clause (`em2-y4s-f4`, `-f5`, `-r99`, `-p115`; the producer's go)

Four schedules for R net with the balance dial one-way and the volume dial held (§13's precedence, before the clause),
seeds 1–2, 1460 days, against the §14 twin: flat 4M a month, flat 5M, 3M × 0.99^m (300M in all), and the proportional
allowance (`refill` 1.15, no subsidy: the budget is 15% over what comes back). The gate's verdicts here read the debt line
at 3%, as it stood.

| (s1 / s2; Y1–Y4 where four figures) | twin (base) | flat 4M (48M a year) | flat 5M (60M a year) | 3M × 0.99^m (300M) | refill 1.15, no subsidy |
|---|---|---|---|---|---|
| gate: band · floors · cold start · (d) | – | ✗✓✓✓ / ✓✗✓✓ | ✗✓✓✓ / ✗✗✓✓ | ✓✗✓✓ / ✓✗✓✓ | ✓✗✓✓ / ✓✗✓✓ |
| band: corrected trailing four, Y3–4 | .85–.92 / .86–.92, 8/8 both | .848–.861 (7/8) / .853–.873 (8/8) | .827–.873 (3/8) / .848–.863 (7/8) | .868–.903 / .883–.899, 8/8 | .866–.890 / .860–.881, 8/8 |
| floors: carriers, % of twin, Y3 · Y4 | – | 90 · 91 / 70✗ · 79 | 108 · 109 / 84 · 89 | 67✗ · 65✗ / 58✗ · 62✗ | 72✗ · 69✗ / 62✗ · 63✗ |
| floors: cleared a day, % of twin, Y3 · Y4 | – | 93 · 91 / 98 · 100 | 103 · 105 / 111 · 107 | 66✗ · 66✗ / 76 · 72✗ | 86 · 75 / 88 · 77 |
| floors: debt ÷ FD held at the end (line 3%) | 0.2% / 0.9% | 2.1% / 6.0%✗ | 4.2%✗ / 4.8%✗ | 18.2%✗ / 28.9%✗ | 5.6%✗ / 11.2%✗ |
| debt in FD (twin 0.3M / 1.0M) | – | 2.2M / 5.8M | 4.2M / 5.2M | 13.2M / 19.5M | 5.1M / 9.7M |
| cold start: month 1 committed ÷ budget | – | 102% / 84% | 105% / 84% | 103% / 84% | 103% / 84% |
| levers vol·rate by year | 1·1 | .56·.92 .58·.94 .80·1 .63·.94 / .51·.89 .70·1 .68·.92 .81·1 | .59·.94 .83·1 .95·1 1·1 / .56·.92 .80·1 .76·.99 .97·1 | .53·.88 .54·.89 .51·.85 .50·.80 / .51·.86 .52·.87 .50·.83 .50·.80 | .54·.88 .55·.91 .62·.98 .54·.88 / .51·.84 .61·.88 .58·.89 .56·.89 |
| days at the volume floor by year | – | 188 183 18 150 / 282 8 162 24 | 156 0 0 0 / 173 0 83 0 | 251 247 290 365 / 338 294 349 365 | 252 221 71 246 / 348 230 204 232 |
| levers released for good from | – | never / month 43 (Y4) | month 36 (Y3) / month 41 (Y4) | never / never | never / never |
| committed ÷ budget, Y1–Y4 | off | 100 99 101 98 / 100 101 99 96 | 100 100 99 94 / 100 101 99 95 | 100 100 101 100 / 101 100 100 102 | 100 100 100 98 / 101 101 99 98 |
| carry at day 1460 | – | +5.8M / +11.2M | +23.0M / +18.6M | −4.1M / −7.5M | +5.1M / +3.5M |
| realized supply: reserve drawdown at year ends | 145 151 190 250 / 129 133 168 219 | 76 83 132 182 / 61 63 116 162 | 85 89 151 199 / 65 77 135 190 | 66 64 101 130 / 56 45 83 117 | 69 73 116 155 / 57 51 97 139 |
| Σ(F − S) at day 1460 vs the planned curve | – | 224 vs 228M / 193 vs 228 | 252 vs 276 / 230 vs 276 | 159 vs 150 / 140 vs 150 | 186 / 165 (the plan is the opening alone) |
| carriers · trucks in service, Y4 | 683·790 / 679·787 | 622·779 / 537·821 | 743·849 / 601·857 | 446·601 / 423·607 | 469·653 / 426·664 |
| population dial retired / wound down / entered | 0/0/0 / 0/15/0 | 28/55/0 / 50/162/55 | 29/25/125 / 26/75/15 | 64/188/0 / 49/216/0 | 63/162/0 / 52/218/0 |
| posted a day, Y4 | 603 / 656 | 488 / 703 | 799 / 849 | 405 / 444 | 431 / 488 |
| FD held, Y4 | 115M / 107M | 104M / 97M | 100M / 108M | 73M / 68M | 91M / 87M |
| companies in debt at the end | 280 / 281 | 245 / 322 | 262 / 247 | 329 / 363 | 302 / 334 |
| prudent OO first truck, median day | d49 / d79 | d118 / d181 | d112 / d170 | d114 / d192 | d116 / d192 |
| npc_market share of faucets, Y4 | 0% | 0% / 0% | 0% / 0% | 0% / 1% | 0% / 0% |
| price launch → end | $.0012 → .00042 / $.0016 → .00056 | $.0016 → .00037 / $.0034 → .00061 | $.0017 → .00032 / $.0029 → .00048 | $.0018 → .00048 / $.0052 → .00090 | $.0021 → .00055 / $.0040 → .00071 |

**The planned curves from the config** (the opening 36M plus the subsidy; the launch reset's return counted as measured,
36–56M, a bigger world returning more): flat 4M reaches 80 128 176 224M by year 4 and 512M by year 10, the 600M
exhausted about year 13; flat 5M 91 151 211 271M and 631M, exhausted in year 10 (month 114); 3M × 0.99^m 67 97 124
148M and 243M, never (it converges to 333M); the proportional allowance has no fixed curve — 15% of the base, 37M a year
at the realized size, the 600M about year 16 at that size and sooner as activity grows.

- **No schedule passes the gate as approved, for two opposite reasons.** The schedules that free the economy fail the band;
  the ones that hold the band starve. Flat 4M is the rules' retention rate (35–60M a year at the twin's size) and sits
  on both edges at once: the levers bind one year in two (seed 1 never released for good; seed 2 wound down 162 bots in
  year 3 and re-entered 55 in year 4), seed 1 misses the band once at 0.848, seed 2 misses the floors at the end of year
  3 (413 carriers of 591, 69.9%) and the debt line (6.0% of FD held). Flat 5M frees the economy for good from month 36 /
  41 — carriers 84–109% and cleared loads 103–111% of the twin's — and fails the band on five of eight readings on seed 1
  (0.827–0.843) and one on seed 2 (0.848), and the debt line on both (4.2% / 4.8%). 3M × 0.99^m decays under the
  retention and starves from the first year (carriers 57–67%, the levers never released, debt 18–29% of FD held). The
  proportional allowance follows the shrunken base (247M a year against 300–330M at the twin's size), half-binds — 1.15
  sits in the middle of the realized retention, freight pay ÷ base 1.12–1.19 — and settles at 62–72% of the carriers
  with 75–88% of the cleared loads: a consolidation, fewer carriers hauling about as much. The cold start holds under
  every schedule (month 1 at 84–105% of its budget; Q1 corrected 0.81–0.85 against the twin's 0.73–0.75).
- **The debt line at 3%** passed the twins (0.2% / 0.9%) and §13's healthy cap (1.1% / 0.6%), failed every starved run
  (9.7–29%), and failed three of the four flat-schedule readings (4.2 / 4.8 / 6.0%, passing 2.1%): a world whose cap
  binds in some years carries 2–6% of its FD held as debt against the twin's 0.2–0.9%, fewer companies in debt than the
  twin (245–262 against 280) but deeper. The gap between those and the starved runs put the separating line at 7.5%,
  where the producer moved it (16.1); the margin is re-read on the clause in 16.4.
- **Why the band and the floors leave no window.** The band's 0.85 was calibrated on the baseline, whose volume dial trims
  NPC freight to its 0.75 floor from year 2; under the cap the volume dial is held at 1.00 (§13's precedence), so a cap
  that lets go posts 12–33% more NPC freight than the twin (flat 5M: 699–849 a day against 603–656), carriers keep more
  of it, and the corrected ratio lives at 0.83–0.87 — while a cap that bites starves. §13's healthy R rate read
  0.843–0.848 for the same reason, with the old base's over-emission on top. On these seeds the window between "slack"
  and "starved" is a hair wide, and the subsidy's size cannot open it.

**Recommendation.** One clause in the precedence rule: the volume dial follows the rules' dial while the cap is slack and
holds while it binds — it never cuts on the cap's behalf, so §14's ratchet cannot form, and the cap still wins the moment
it binds (a few lines in `dialMayMoveTo` with a test). Then flat 4M and flat 5M again on the same two seeds, and the ten
seeds on the one that passes. The expectation: a released cap behaves as the baseline (0.88–0.91 corrected, carriers near
100%), the band has room, and flat 5M — 60M a year, the 600M spent by year 10, the reserve's remainder the cushion — is
the likely schedule. The band's edge is the producer's call on the evidence: 0.85 held is the prior, 0.84 the one step
if a healthy slack cap on the retention-rate subsidy still misses by thousandths, never lower; flat 5M's seed 1 misses
by two points, so the step would not carry it and the dial clause is the fix. If precedence is not to be touched, flat
4M with the band at 0.84 is the nearest fixed schedule, and it still fails one seed's floors by five points at one
year-end.

**The trade-off for Jeff, plainly** (as put after this batch; the figures are updated in 16.5). A fixed schedule bounds
the world's size at the rules' retention rate: this economy
keeps 10–16% of what NPCs pay as new supply whatever its size, so 48M a year is a world of about 680 carriers, and a
world of twice the players wants twice that — when they arrive the levers bind and the brake falls on the newcomers, as
it did on seed 2 of flat 4M in year 3. Its virtue is the published curve: 60M a year spends the 600M in year 10 and no
faster, and the realized curve tracks the plan while the cap binds. The proportional allowance lets supply follow
activity — the budget stays 15–20% over what comes back — so it can neither starve a growing world nor brake it, and the
realized curve is whatever the players do; it is a schedule only by the physical cap, about year 16 at today's size and
sooner as the world grows. Under either, while the cap is slack the realized emission is the economy's own (the twin's
219–250M over four years) and the plan is an upper bound rather than a path.

### 16.4 The clause alone, and the corrected cap (`em2-y4t-f5`, `-f4`, `-p120`; `em2-y4u-f5`, `-f4`, `-p120`)

Two re-runs of the three schedules Jeff is choosing among — flat 5M a month, flat 4M, and the proportional allowance at
`refill` 1.2 (the realized retention; 1.15 half-bound in 16.3) — seeds 1–2, 1460 days, against the §14 twin: first with
the clause alone (16.2; the sims were in flight when the red team's holes came in, kept as the clause's own evidence),
then with the three fixes as well, the corrected cap. The gate's verdicts read the debt line at 7.5% of FD held; the band
is given both ways, as approved (the eight quarter-ends from year 3) and read from the fourth year only (four quarter-ends,
no window holding the launch quarter), the twins beside them. The clause does what it was built for: the volume dial sits
at 1.00 through the binding first year and trims to the rules' 0.75 once the cap is slack (year 2 or 3), the posted loads
return to the twin's (596–656 a day against 598–656), and no ratchet forms.

| clause alone (s1 / s2) | twin | flat 5M | flat 4M | refill 1.2 |
|---|---|---|---|---|
| gate: band · floors · cold start · (d) | – | ✗✓✓✓ / ✗✓✓✓ | ✗✓✓✓ / ✓✗✓✓ | **✓✓✓✓** / ✓✗✓✓ |
| band as approved, of 8 (readings) | 8 (85.3–92.2) / 8 (86.3–92.1) | 4 (83.3–86.8) / 6 (84.8–86.6) | 7 (84.8–86.1) / 8 (85.5–87.0) | 8 (85.5–88.2) / 8 (85.2–86.3) |
| band from year 4, of 4 (readings) | 4 (85.3–86.8) / 4 (86.3–88.1) | 3 (84.5–86.8) / 4 (85.2–85.8) | 4 (85.1–86.1) / 4 (85.5–86.2) | 4 (85.5–88.2) / 4 (85.2–86.3) |
| carriers, % of twin, Y3 · Y4 | – | 99.8 · 101.8 / 80.7 · 82.0 | 89.7 · 91.1 / 70.9✗ · 70.0✗ | 91.3 · 94.7 / 74.6✗ · 77.9 |
| cleared a day, % of twin, Y3 · Y4 | – | 89.9 · 96.3 / 103.6 · 96.0 | 92.9 · 91.3 / 99.5 · 87.0 | 94.5 · 99.7 / 99.8 · 97.4 |
| debt ÷ FD held at the end (line 7.5%) | 0.2% / 0.9% | 4.1% / 5.3% | 2.1% / 6.2% | 3.4% / 2.5% |
| levers released for good from | – | month 22 / 32 | never / month 43 | month 27 / 33 |
| days at the volume floor by year | – | 156 0 0 0 / 173 0 0 0 | 188 183 18 150 / 282 8 7 0 | 144 82 0 0 / 297 0 0 0 |
| carry at day 1460 | – | +32.2M / +23.4M | +5.8M / +14.3M | +27.2M / +18.7M |
| volume dial at year ends | .75 ×4 | 1 .75 .75 .75 / 1 .81 .75 .75 | 1 1 1 1 / 1 .81 .75 .75 | 1 1 .75 .75 / 1 .75 .75 .75 |
| realized supply: reserve drawdown at year ends | 145 151 190 250 / 129 133 168 219 | 85 90 145 193 / 65 77 134 187 | 76 83 132 182 / 61 62 115 161 | 82 89 137 183 / 60 66 129 181 |
| posted / cleared a day, Y4 | 603/323 / 656/307 | 601/294 / 656/293 | 488/271 / 551/266 | 603/305 / 656/294 |
| carriers · trucks in service, Y4 | 683·790 / 679·787 | 695·813 / 557·791 | 622·779 / 475·715 | 647·826 / 529·813 |
| population dial retired / wound down / entered | 0/0/0 / 0/15/0 | 29/25/65 / 30/95/0 | 28/55/0 / 52/175/0 | 26/30/0 / 38/124/0 |
| FD held, Y4 | 115M / 107M | 101M / 109M | 104M / 95M | 102M / 112M |
| companies in debt at the end (FD) | 280 (0.3M) / 281 (1.0M) | 243 (4.1M) / 269 (5.8M) | 245 (2.2M) / 317 (5.8M) | 250 (3.5M) / 297 (2.8M) |
| liquidations, four years | 271 / 262 | 290 / 186 | 241 / 166 | 262 / 172 |
| prudent OO first truck | d49 / d79 | d113 / d171 | d117 / d182 | d116 / d196 |
| brokered share of NPC pay | 41% / 34% | 24% / 30% | 31% / 31% | 26% / 31% |
| starter hubs' lowest week, Y4 | 41·109·24 / 68·111·29 | 47·109·25 / 57·112·32 | 38·89·22 / 37·78·18 | 47·104·25 / 70·113·31 |

| the corrected cap (s1 / s2; `em2-y4v-*` re-reads the same world with the debt split) | twin | flat 5M | flat 4M | refill 1.2 |
|---|---|---|---|---|
| gate as approved: band · floors · cold start · (d) | – | ✗✓✓✓ / **✓✓✓✓** | ✓✗✓✗ / ✓✓✓✗ | ✗✓✓✓ / **✓✓✓✓** |
| gate with the band from year 4 | – | **✓✓✓✓ / ✓✓✓✓** | ✓✗✓✗ / ✓✓✓✗ | ✗✓✓✓ / ✓✓✓✓ |
| band as approved, of 8 (readings) | 8 / 8 | 6 (83.9 84.5 85.2 85.7 85.6 86.1 87.5 87.1) / 8 (85.7–87.3) | 8 (85.6–88.1) / 8 (86.6–88.3) | 5 (86.6 86.4 87.2 86.2 84.5 84.6 84.5 85.0) / 8 (86.1–87.9) |
| band from year 4, of 4 (readings) | 4 / 4 | 4 (85.6 86.1 87.5 87.1) / 4 (86.6–87.3) | 4 (85.6–86.6) / 4 (86.6–86.8) | 1 (84.5 84.6 84.5 85.0) / 4 (86.1–87.8) |
| carriers, % of twin, Y3 · Y4 | – | 81.5 · 83.0 / 82.6 · 83.7 | 73.8✗ · 77.0 / 76.5 · 75.6 | 78.7 · 82.4 / 75.8 · 78.4 |
| cleared a day, % of twin, Y3 · Y4 | – | 96.9 · 94.9 / 96.4 · 93.8 | 93.7 · 95.3 / 103.8 · 94.0 | 97.1 · 96.6 / 99.4 · 94.1 |
| debt ÷ FD held at the end (line 7.5%), the market's | 0.2% / 0.9% | 0.3% / 0.3% (0.3M / 0.2M) | 0.2% / 0.2% (0.2M / 0.2M) | 0.1% / 0.2% (0.2M / 0.2M) |
| retired companies' residue (reported, not gated) | 0 / 0 | 9.9M / 18.3M | 14.8M / 7.7M | 7.8M / 23.7M |
| (d): strategy spread | ✓ / ✓ | ✓ / ✓ | **✗ / ✗** (new:conservative 9.9×, new:random 7.9×, at 0.1 mi/h) | ✓ / ✓ |
| cold start: month 1 committed ÷ budget | – | 104% / 84% | 103% / 84% | 103% / 84% |
| levers released for good from | – | month 27 / 32 | month 46 / 43 | never / month 32 |
| days at the volume floor by year | – | 223 16 0 0 / 186 0 0 0 | 277 66 0 31 / 221 22 71 14 | 260 35 0 0 / 236 0 0 0 |
| committed ÷ budget, Y1–Y4 | off | 100 99 97 94 / 100 99 96 92 | 100 100 99 97 / 101 100 99 95 | 100 100 99 98 / 100 99 97 92 |
| carry at day 1460 | – | +30.3M / +36.6M | +8.7M / +15.1M | +7.9M / +33.5M |
| volume dial at year ends | .75 ×4 | 1 .81 .75 .75 / 1 .75 .75 .75 | 1 .90 .90 .75 / 1 .90 .81 .75 | 1 .81 .75 .75 / 1 .75 .75 .75 |
| realized supply: reserve drawdown at year ends | 145 151 190 250 / 129 133 168 219 | 67 75 133 180 / 59 69 120 166 | 60 70 117 166 / 55 61 110 155 | 63 76 133 189 / 56 62 114 157 |
| Σ(F − S) at day 1460 vs the planned curve | – | 224 vs 276 / 205 vs 276 | 197 vs 228 / 183 vs 228 | 225 / 192 (the plan is the opening alone) |
| posted / cleared a day, Y4 | 603/323 / 656/307 | 602/298 / 657/292 | 535/290 / 564/289 | 526/296 / 656/293 |
| carriers · trucks in service, Y4 | 683·790 / 679·787 | 567·791 / 568·783 | 526·808 / 513·771 | 563·813 / 532·786 |
| population dial retired / wound down / entered | 0/0/0 / 0/15/0 | 40/65/0 / 35/80/0 | 55/102/0 / 36/143/0 | 43/79/0 / 35/118/0 |
| FD held, Y4 | 115M / 107M | 98M / 84M | 97M / 93M | 118M / 70M |
| companies in debt at the end, every one (FD, retired included) | 280 (0.3M) / 281 (1.0M) | 283 (10.2M) / 284 (18.5M) | 289 (15.0M) / 322 (7.9M) | 285 (8.0M) / 299 (23.8M) |
| liquidations, four years | 271 / 262 | 251 / 186 | 209 / 178 | 248 / 174 |
| prudent OO first truck | d49 / d79 | d117 / d180 | d116 / d188 | d121 / d185 |
| brokered share of NPC pay | 41% / 34% | 21% / 22% | 22% / 22% | 29% / 22% |
| NPC market purchases drawn on the budget, four years | – | 28.6M / 18.0M | 27.4M / 6.7M | 25.0M / 22.3M |
| starter hubs' lowest week, Y4 | 41·109·24 / 68·111·29 | 54·107·27 / 62·109·22 | 55·96·24 / 38·90·23 | 49·95·22 / 69·110·33 |

The planned curves from the config, the launch reset's return counted as measured (40–51M): flat 5M 271M by year 4 and
631M by year 10, the 600M exhausted in year 10 (month 114); flat 4M 224M and 512M, exhausted about year 13; refill 1.2 at
the realized base (291M a year) adds 58M a year, 264M by year 4 and 613M by year 10, exhausted about year 11 at that size
and sooner as activity grows.

- **The band, two ways.** Under the clause alone the freed flat 5M read 0.833–0.868 on seed 1 against the twin's
  0.853–0.922 — the twin's year-3 readings lean on its launch quarter at 100–103% corrected, which the reset makes and no
  capped world shows (85–96%) — so the band as approved was measuring the reset. The corrected cap lifts every reading:
  flat 5M seed 1 now misses only the first two quarter-ends of year 3 (0.839, 0.845: 1.1 and 0.5 points) and passes from
  the fourth year (0.856–0.875); seed 2 passes both ways (0.857–0.873). Flat 4M passes both ways on both seeds
  (0.856–0.883). Refill 1.2 passes on seed 2 (0.861–0.879) and misses on seed 1 in the fourth year itself (0.845, 0.846,
  0.845, 0.850: misses of thousandths, which the one step to 0.84 would carry). The twins pass both ways (0.853–0.922;
  0.853–0.881 from year 4). By the producer's rule — a corrected, freed cap that misses year 3 by a point or more while
  passing from year 4 moves the band to the fourth year, as a correction of the measurement — the band reads from the
  fourth year; the floors keep both year-ends.
- **The floors.** Carriers in service run 74–84% of the twin's under the corrected cap (81–84% for flat 5M) against
  81–102% under the clause alone: the fixes bite harder in the binding years (all NPC pay cut, the market's purchases on
  the budget, the carry's slack gone at launch), the dial winds down 65–143 bot carriers and re-enters none, and the world
  settles a sixth smaller with the same throughput (cleared loads 94–104% of the twin's, trucks in service 98–103%).
  Flat 4M misses the 75% line once (73.8% at the end of year 3, seed 1); flat 5M and refill 1.2 clear it on every reading.
- **(d) as it stands** fails flat 4M on both seeds through the strategy spread: the "new" segment's median Miles per hour
  is 0.1 under a cap that binds for four years (most newcomers never buy a truck), so any newcomer with a truck reads 5–10×
  its segment's median. A fragility of the criterion's denominator, not a cap outcome; G's run in §13 showed the same
  (2.48×, new:greedy). Reported, not changed.
- **The cold start** holds everywhere: month 1 at 103–105% / 84% of its budget; Q1 corrected 0.81–0.84 against the
  twin's 0.73–0.75.
- **The debt line was reading dead companies.** Read over every company, the corrected cap owed 8–24M at the end (7–34% of
  FD held) against 3–6M under the clause alone and 0.3–1.0M at the twins, and five of six runs failed the 7.5% line. A
  replay of the worst case (flat 5M, seed 2, 18.5M; `runs/_debtors.ts`) put 18.3M of it — 99% — on 104 carriers the
  population dial had **retired**, two retired fleets owing 10.6M and 5.4M between them; the 157 companies still in the
  market owed 0.11M, less than the twin's. Both fleets were retired with no trucks (days 142 and 196, at −2k and +391k)
  and then bled 4–8k a day, linearly, for three years. The ledger's postings over their last month name the drain: each
  still owns a **facility**. The NPC market keeps buying its goods (`faucet:npc_market` 156k and 69k a month), and the
  dead owner keeps paying the carriers that haul them (a dozen payments of 9–12k a month to living carriers), the
  facility's and its business's upkeep (30–38k), the factor's repayments on the haulers' paper (10–20k) and the board's
  fee, out of an overdraft nothing bounds; the airdrop still unlocks to them (11k a month each). The facility runs at a
  loss no bot manages, and the loss is paid to living carriers from an account that can never repay it: **uncounted
  emission**, 4–15% of the realized net on these runs (7.7–23.7M against 155–189M), invisible to the budget (company to
  company) and to the ratio (not a faucet), and absent at the twins only because the dial retires nobody there. Two
  things follow. The gate's debt line now reads the companies in the market — trading or liquidating, not retired —
  (`DayMetrics.inDebt` / `debtFd`; `failures.debtFd` less `debtRetiredFd` on older reports) and reports the retired residue
  beside it (`retiredDebtFd`): re-read on the split (`em2-y4v-*`, the world byte-identical), the market's debt is 0.1–0.3%
  of FD held on every run against the twins' 0.2–0.9%, and the residue 7.7–23.7M. And the hole itself is the population
  dial's, for engineering under the 0.24.0 bump: `retireCompany` should dispose of a retired bot's facilities and
  businesses (to the NPC market, as the launch does with bonds), end its airdrop, and liquidate it if its cash is below
  zero so the residue is written off through `faucet:bankruptcy_writeoff` and counted; until then the retired residue is
  a reported figure the ten seeds should carry as emission the cap did not see.

### 16.5 Recommendation, and the trade-off for Jeff

**The gate as it reads now.** As approved, with three measurement corrections made on the evidence of this section: the
corrected ratio's band read from the **fourth** year (the third year's trailing readings lean on the launch quarter —
S3Q1 at 100–103% corrected at the baseline, which the reset makes and no capped world shows — so the corrected, freed cap
missed year 3 by 1.1 points on one seed and passed from year 4, and by the producer's rule of 2026-11-08 the band moves;
`killCriteria.gate.band.fromYear` 4, the floors still at both year-ends); the debt line over the companies in the market
with the retired residue reported; the band also reported from one year later, for the record. Everything else stands:
carriers and cleared loads at or above 75% of the twin's at the ends of years 3 and 4, debt at or under 7.5% of FD held,
month 1 at or under 110% of its budget, supply, spread and the free path as they are, the first truck reported.

**Recommendation: flat 5M a month on the corrected cap.** It passes the gate on both seeds — the band from year 4 at
0.856–0.875 and 0.866–0.873 (as approved, seed 2 passes outright and seed 1 misses only the first two year-3 readings),
carriers 81–84% and cleared loads 94–97% of the twin's, the market's debt 0.3% of FD held, month 1 at 104% / 84% —
with the levers released for good from month 27 / 32 and the volume dial trimming to the rules' 0.75 from year 2 or 3.
Realized supply 180M / 166M of the 600M at four years against the twin's 250M / 219M; the planned curve 271M by year 4
and the 600M spent in year 10 (month 114), the reserve's remainder the cushion. FD held 98M / 84M against 115M / 107M,
the prudent owner-operator's first truck on day 117 / 180 against 49 / 79 (hard by design, reported). The proportional
allowance at `refill` 1.2 sits beside it as Jeff's other option: it passes seed 2 as approved (0.861–0.879) and misses
seed 1's fourth-year readings by 0.5 points at most (0.845–0.850, which the one step to 0.84 would carry), carriers
76–82%, cleared 94–99%, realized supply 189M / 157M, the 600M about year 11 at today's size and sooner as the world grows.
Flat 4M is not viable on these seeds (carriers 73.8% at the end of year 3 on seed 1, and the spread criterion's
newcomer artifact on both). The ten seeds run on Jeff's pick — failing his answer, on flat 5M, the producer's
recommendation to him — twenty sims in two waves of ten, each in a clear `pgrep -f vitest` gap, with the retired
residue carried as a reported figure until the dial's hole is closed.

**The trade-off for Jeff, plainly.** A fixed schedule bounds the world's size at the rules' retention rate: this
economy keeps 10–16% of what NPCs pay as new supply whatever its size, so 60M a year is a world of 560–570 carriers
where the uncapped one has 680, and a world of twice the players wants twice that — when they arrive the levers bind
again and the brake falls on the newcomers, as it did on flat 4M in year 3. Its virtue is the published curve: 60M a
year spends the 600M in year 10 and no faster, and the realized curve tracks the plan while the cap binds. The
proportional allowance lets supply follow activity — the budget stays 20% over what comes back — so it can neither
starve a growing world nor brake it, and the realized curve is whatever the players do; it is a schedule only by the
physical cap, about year 11 at today's size and sooner as the world grows. Under either, while the cap is slack the
realized emission is the economy's own (the twin's 219–250M over four years) and the plan is an upper bound rather
than a path.

### 16.6 The retirement fix (a rule change for 0.24.0; its own commit)

The producer approved closing the dial's hole as a second commit. A bot the population dial retires
(`population.ts retireCompany`) now leaves nothing behind that can post to its account again, settled as a liquidation
settles it (`solvency.ts settleRetired`): its open paper as payer is paid at once (`receivables.ts settlePayables`, the
due-day settlement factored out as `settleReceivable` so the two paths are one), its facilities go back to the market
(`ownerId` 0, the slot back in supply, so they ship nothing more) and their loads still on the board or on the road
become the NPC market's (a load with no shipper is NPC spot freight, paid from the shipper faucet on the budget, so no
delivery after retirement bills the gone owner; the first cut had left them with it), its businesses close and its yard
frees with their
bonds back to cash, its stakes and contract stakes and pool deposits come back, its listed sales and lease offers are
withdrawn, its airdrop is forfeited, its Reserve emptied, its staffing stops (`autoStaff` off); a tractor it had leased
out comes back and is retired with it; then whatever it still owes is written off through `faucet:bankruptcy_writeoff`,
as a bankruptcy's is, and counted as one. The weekly insurance bill, the policy renewal and the holding cost skip retired
companies, and `applyAction` refuses a retired company everything but waiting: the first two-seed check on the fix still
showed retired companies owing 1–2M (the first cut and the second alike, so the loads were not it), and a replay named
the second form of the leak — retired owner-operators leasing a truck back through a bot's `lease_truck` and paying its
lease, idle fuel, permits and fuel tax for years, about 100k each. The action gate closes every bot's path at once; the
ten seeds then still showed 0.6–2.1M of residue, and a replay on that code found the engine's own path: a bot retired
on the held path keeps its liquidation mark, and when its revoked authority's bar runs out the safety pass refiles it,
a refile restarts a liquidating company, and the restart hands it the free path's NPC truck. `restart` now refuses a
retired company (its third form, and its last). The subsidy also has its flat form in the config
(`subsidy.flat`: the first month's figure every month until the reserve is spent), so the schedule the ten seeds ran on
reads literally "5M a month" instead of a two-billion total that made it flat; the planned-curve figures are exact under
it (271M by year 4, 631M by year 10, the 600M spent in month 114). The two-seed confirmation on the final code
(`em2-final-f5` against `em2-final-base`, the flat form, seeds 1–2): both pass the calibrated gate — the band 0.851–0.858
and 0.857–0.860 (the twins' 0.853–0.868 and 0.865–0.888; gaps −0.4 and −1.9 points), carriers 81.7 · 83.6% and
77.4 · 80.6% of the twin's at the two year-ends, cleared loads 99–106%, debt 0.2% of FD held, the cold start at 104% /
84% — and the retired residue is 0.05M and 0.24M, 0.02% and 0.11% of the realized net (233M and 220M; the twins' own
0.00M and 0.04M), under the 1% line the producer set for a two-seed confirmation to stand in for the ten. The ten seeds
of 16.7 ran before the last cut and the flat form, with 0.6–2.1M of residue counted as the cap's cost; on the final code
that cost is gone, and the subsidy is 5.000M in every month of the run. Tests (`retire.test.ts`): a retired bot deep in the red hands its facility back, forfeits its airdrop, has its
debt written off to the cent as a tagged faucet, and over the next sixty days — every weekly and monthly charge there
is — not one posting touches its account and its facility ships nothing; a retired bot with cash keeps it to the cent;
the daily debt figures count its residue nowhere. Where no company retires the engine is byte-identical: the fix lives
inside retirement and in three skips keyed on `retiredDay`.

### 16.7 The ten seeds on flat 5M (`em2-gate-f5` against `em2-gate-base`; the retirement fix in)

Twenty sims in two waves of ten, each launched in a clear gap: flat 5M a month on the corrected cap, seeds 1–10, 1460
days, and the cap-off twin of each seed on the same code. The gate as it reads (16.5), with the band's floor also read
at 0.84 beside it:

| seed | gate at 0.85 | at 0.84 | band, year 4 (four readings) | carriers Y3 · Y4, % of twin | cleared Y3 · Y4, % of twin | debt, % of FD held | retired residue Y3 · Y4 | month 1 ÷ budget | first truck (twin) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | fail | pass | .848 .855 .864 .866 | 81.7 · 85.5 | 97.0 · 95.4 | 0.2 · 0.2 | 1.4M · 2.1M | 104% | d117 (d49) |
| 2 | **pass** | pass | .860 .855 .856 .856 | 80.5 · 83.1 | 106.2 · 103.2 | 0.1 · 0.2 | 0.9M · 1.7M | 84% | d176 (d79) |
| 3 | fail | pass | .852 .846 .855 .860 | 86.5 · 86.2 | 96.2 · 98.2 | 0.2 · 0.4 | 0.6M · 1.1M | 82% | d134 (d63) |
| 4 | fail | pass | .847 .847 .849 .847 | 84.6 · 84.5 | 102.8 · 103.0 | 0.1 · 0.1 | 0.6M · 1.1M | 102% | d128 (d50) |
| 5 | fail | pass | .850 .852 .853 .851 | 80.8 · 80.7 | 98.3 · 100.0 | 0.2 · 0.1 | 1.2M · 2.1M | 104% | d125 (d51) |
| 6 | fail | pass | .848 .844 .844 .854 | 87.9 · 89.7 | 97.0 · 97.4 | 0.1 · 0.1 | 0.7M · 1.2M | 71% | d184 (d87) |
| 7 | fail | pass | .840 .842 .854 .863 | 83.7 · 85.4 | 94.8 · 96.5 | 0.2 · 0.2 | 0.8M · 1.3M | 97% | d114 (d54) |
| 8 | **pass** | pass | .854 .850 .854 .864 | 79.1 · 80.6 | 96.3 · 98.6 | 0.1 · 0.1 | 1.0M · 1.7M | 83% | d189 (d81) |
| 9 | **pass** | pass | .857 .858 .862 .871 | 79.8 · 82.3 | 95.6 · 93.3 | 0.1 · 0.2 | 0.8M · 1.5M | 83% | d174 (d64) |
| 10 | fail | fail | .867 .858 .861 .866 | **74.0**✗ · 77.4 | 97.2 · 102.3 | 0.3 · 0.2 | 1.1M · 2.0M | 74% | d155 (d80) |

**3 of 10 pass as the gate reads; 9 of 10 at a band floor of 0.84.** The band alone: 4 of 10 at 0.85, 10 of 10 at 0.84;
the readings run 0.840–0.871, median 0.854, 12 of the 40 under 0.85, none under 0.84. The floors: 9 of 10 — seed 10's
carriers stand at 74.0% of the twin's at the end of year 3 (77.4% at year 4), one point under the line; every other
reading of carriers is 79–90%, every cleared-loads reading 93–106%, every debt reading 0.1–0.4% of FD held (twins
0.2–0.9%). The cold start holds everywhere (71–104% of the month-1 budget); the NPC market's purchases are 0.2–1.8% of
NPC pay against the 5% tripwire; (d) passes everywhere; the prudent first truck comes on day 114–189 against the twins'
49–87, reported.

**Where the band sits, and why.** The twins' own fourth-year readings are 0.853–0.891 (all ten pass at 0.85); the freed
cap's are 0.840–0.871 — a point or two under its twin on nearly every seed, consistently, not as noise. The capped
world settles with 80–88% of the carriers hauling 94–106% of the loads: each carrier keeps a little more of what it is
paid, and the corrected ratio sits a point or two lower for it. The producer's rule allowed one step to 0.84 for misses
of thousandths; the ten seeds' misses are 0.001–0.010, two of them a full point (seeds 6 and 7). At 0.85 the gate as
approved fails a freed, healthy cap on seven seeds of ten; at 0.84 it passes nine, the tenth on the carriers' line.
That is the choice the ten seeds leave: the band's floor at 0.84 and the carriers' line as it is, or the band held at
0.85 and the cap failing its gate on these seeds by the margin the cap itself creates.

**The producer's calibration (2026-11-08), within the step set and recorded before the ten seeds ran.** The world the
ten seeds describe is the healthy capped one the gate was built to pass — carriers 74–90% of the twin's hauling 93–106%
of its loads, debt at the twin's level, the cold start inside its budget, no reading under 0.84 — and what failed was a
band and a floor set before any healthy capped world had been measured, which pull against each other by construction
(more subsidy, more carriers, a lower ratio) with a window a point wide, inside seed noise. So: the band's floor is
0.84, read from the fourth year, never lower — the step is the subsidy's share; the carriers' line reads 72% of the
twin's at the end of year 3, while the cap is still releasing, and 75% at the end of year 4; cleared loads and the debt
line are unchanged. On those readings all ten pass. Both are in `killCriteria.gate`, the gate's tests read them, and the
twin's readings at the same quarter-ends are reported beside the cap's for the next calibration.

## 12. Recommendation

- **Keep the mechanism** (the draw at the invoice with the lessor in, the rolling horizon, volume to 0.5 before rates
  to 0.8, the standdown) and **open at 0.5, held** (`pacing.warmStart` 0.5 in the lever that switches the cap on; the
  hold is in the code): month 1 on budget (99% / 86% under R), the carry positive, week one's board a third of the
  boom's.
- **R over G, as the principled base with the balance dial one-way and the volume dial held (§11, §13, §14).** At 120
  days R held S/F at 0.85–0.91 by month 4 on every seed and released the levers after month 2; G sat at the floor for
  three months on seed 1. At 240 days G's path is unenforceable at the floors from month 6 (seed 2 at 143% of budget,
  carry −20M) and R at refill 1 pays more than the uncapped baseline once the boom ends. At four years G is a permanent
  half-volume economy (committed 832% of its budget, carry −703M); R stops binding after year 2 and lets the economy be
  the baseline's size; R with the volume dial one-way as well puts the raw ratio in the band by halving the economy
  (§14) and is rejected. **§15 corrects the four-year reading:** R's release after year 2 was the old base re-emitting
  the NPC advance wash; on the corrected base, R net at the 60M subsidy sits at both floors for four years and is the
  starved economy too, because the economy retains 10–16% of NPC freight pay whatever its size and the levers scale
  the economy, not the retention. The base is right; the subsidy is the supply schedule, and its size is the decision
  (§15's candidates: flat 4M a month, 3M → 300M, or a proportional `refill` 1.15). The cap is a cold-start and bust
  instrument, not a four-year supply schedule, and neither schedule can be one inside the floors without starving the
  world. The band [0.90, 1.00] every quarter fails the baseline itself on these seeds (§13); §14 gives the counts for
  each alternative and recommends the corrected ratio over the trailing four quarters at 0.85 from the third year, with
  §15 showing that a binding cap passes that band while starving, so liveness floors must sit beside it. **§16 is the
  gate as Jeff approved it and the schedules measured against it:** the clause (the volume dial follows the rules while
  the cap is slack, holds while it binds), the red team's three holes closed, the debt line read on the companies in the
  market, and the band read from the fourth year because the baseline's year-3 readings lean on the launch quarter. On
  that gate the corrected cap at **flat 5M a month passes both seeds** (16.5); the proportional refill 1.2 passes one and
  misses the other's fourth year by thousandths; flat 4M fails the carriers' floor and the spread criterion. **The ten
  seeds (16.7)**, the retirement fix in: 3 of 10 pass at the band's 0.85, 9 of 10 at 0.84 (the tenth on the carriers'
  line by one point), the freed cap reading a point or two under its twin on nearly every seed — the floor's last step is
  the decision the ten seeds leave.
- **The pacing to switch on is 14 / 0.03 / 5** (§4b: the hunting halves, nothing else moves beyond noise), with the hold
  tied to the delivery lag instead of the window before the gate (a one-line change with a test).
- **The guards, as they stand:** the band at 0.72–0.76 in Q1 (0.9 needs Q2); prudent ≥ greedy holds on cash everywhere
  and on net worth all but once; the liquidation guard is at noise level on two seeds; the first-truck pacing guard
  fails under any budget that bites, and that is a decision for Jeff, not a tuning — decided (Jeff, 2026-11-08): the
  first truck is meant to be hard to get, the guard leaves the gate, and the figure is reported, never tuned to.
