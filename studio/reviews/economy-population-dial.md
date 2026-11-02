# Economy review: the population dial (2026-11-02)

Economy designer, for the producer. Jeff: "Load to truck ratio should maintain within a band so that the game
always welcomes new players. Boom and bust cycles still persist though, so there must be variance so that players
who are prudent businessmen win in the long run."

Nothing is committed. Live levers and the ruleset are untouched. Batch v57: two years, seeds 1, 4, 8
(`runs/compare-v57.md`).

## 1. The rule as built

**Switch:** `population.dial.enabled` (off) in `packages/config/src/economy.config.ts`. Engine:
`packages/engine/src/population.ts`; the bots' part: `packages/agents/src/ruleBots.ts runDial`.

| Key | Value | Reads |
|---|---|---|
| `windowDays` | 28 | the measure is the mean of the last four weeks |
| `band` | [0.55, 1.25] | the floor and ceiling of NPC loads posted a day per truck in service |
| `startDay` | 112 | the dial waits out the opening, while the free path is still forming the fleet |
| `entrantsPerWeek` | 5 | over the ceiling: new bot companies a week, at most |
| `windDownPerWeek` | 5 | under the floor: weakest bots told to wind down a week, at most |

**The measure is national: loads posted a day ÷ every company's trucks on the road.** "On the road" means not
parked, listed or retired, free-path leases included. It is recorded daily as `DayMetrics.trucksInService`.

- **Why national.** The dial acts on how many carriers exist, and carriers move between hubs. A hub cluster's ratio
  is pricing's job: the engine's own spot ratio sets rates hub by hub. A cluster dial would add bots where a city is
  briefly crowded and leave them stranded when the trucks move on.
- **Why posted loads and not the spot ratio.** The spot ratio counts idle trucks and the NPC's virtual capacity,
  and is clamped. Posted loads per truck is the structural balance: freight per truck.
- **Why four weeks.** It smooths the weekly noise and keeps the seasons and the cycle.

**What the dial does outside the band, and only there:**

- **Under the floor:**
  - A bot carrier that goes under and has finished its liquidation is not restarted. It leaves the market: its NPC
    lease goes back with its own deposit, its staff go, and its debt stays on its books. Not writing it off is one
    faucet fewer.
  - Each week, up to five of the weakest bots wind down: those losing money per truck over their last weeks, the
    worst first, none in its first eight weeks. Their orders stop, leases go back as trucks come home, owned trucks
    are sold on the used market or traded in, and once nothing runs and nothing is on order they leave.
- **Over the ceiling:** up to five new bot companies a week enter on the free path, an NPC-leased Workhorse each,
  with no starting grant. They mint nothing; their first trip runs on credit until the lessor pays on delivery.

**What it never does:** it never touches freight, cash, rates or costs, and never acts on a player or a wave
newcomer standing in for one. Nobody is bailed out. A bust still bankrupts whoever it bankrupts; the dial only
decides how many simulated carriers are in the market afterwards. Its one ledger entry of its own is the return
of a leaving bot's lease deposit, which is that bot's own FD.

**`token.demandScalesWithCarriers` (on live): turn it off under the dial.** The code already holds it off whenever
the dial is on (`token.ts scaleDemand`).

- **Against it under the dial.** It moves freight to the carriers. The dial moves carriers to the freight; if freight
  also followed carriers, the ratio would never move. Worse, the dial's entrants would pull NPC freight up with them:
  a faucet that grows with the bot population. It also lets fake sign-ups summon freight.
- **For it.** It was built so that newcomers find freight. Under the dial they find it anyway, because the bots
  make room.
- **Recommendation:** set the live lever false when the dial goes live, so the config says what the world does.

**Tests:** four, at the end of `packages/engine/test/engine.test.ts`:

- The band and window logic: nothing before the start day or a full window, the window turning over slowly, and
  the dial off reading "within".
- A bankrupt bot not restarted under the floor, with no write-off, while inside the band it restarts as before.
- The slow actions: entrants with no grant and only on dial days, at most two wind-downs a week in the test, never
  the player, and leavers ending with nothing on the road.
- The no-faucet property: with the dial on and the band never left, the world runs exactly as with it off, the
  reserve's daily path and every ledger tag identical.

The full `npm test` passes, 235 of 235.

## 2. The band, from v55-a's own swing

| v55-a, days 112–400 (v57-0 reproduces it exactly) | seed 1 | seed 4 | seed 8 |
|---|---|---|---|
| Lowest four-week mean (the spring and cycle trough) | 0.56 | 0.56 | 0.57 |
| Median | 0.77 | 0.71 | 0.75 |
| Highest | 1.04 | 1.03 | 1.01 |

- **The floor, 0.55,** sits just under every seed's normal trough. An ordinary bust stays inside; extra crowding on
  top of a bust (a wave, a bot glut) crosses it.
- **The ceiling, 1.25,** sits 20% over the year-one boom. In year two the beta fleet thins (trucks in service fall
  from about 800 to about 650 by day 546 with the dial off), and the year-two booms reach 1.4–1.6 on two seeds.
  That is when entrants come.
- **The opening is excluded.** Days 28–111 run 0.6–1.4 while the free path forms the fleet.

## 3. What v57 shows

Means of seeds 1, 4, 8 over two years.

| Measure | v57-0 (off) | v57-a (dial) | v57-w0 (wave, off) | v57-w (wave + dial) |
|---|---|---|---|---|
| Loads per truck from day 112: mean / p5–p95 / min–max | 0.88 / 0.59–1.37 / 0.56–1.59 | 0.87 / 0.59–1.38 / 0.56–1.57 | 0.79 / 0.55–1.26 / 0.50–1.44 | 0.79 / 0.55–1.23 / 0.52–1.31 |
| Booms / busts (demand dial over 1.1 / under 0.9); spread (sd) | 1.08 / 0.69; 0.24 | 1.08 / 0.69; 0.23 | 0.98 / 0.63; 0.21 | 0.96 / 0.63; 0.20 |
| Days under the floor / over the ceiling | 0% / 10% | 0% / 8% | 6% / 5% | 4% / 3% |
| Days the dial read under / over; bots retired / wound down / entered | off | 0 / 52; 0 / 0 / 35 | off | 25 / 19; 9 / 18 / 15 |
| Carriers trading at day 112 / 365 / 546 / 730 | 515 / 516 / 505 / 512 | 515 / 516 / 505 / 543 | 515 / 612 / 600 / 605 | 515 / 604 / 572 / 591 |
| Trucks in service at day 112 / 365 / 546 / 730 | 801 / 803 / 655 / 648 | 801 / 803 / 655 / 655 | 801 / 901 / 740 / 745 | 801 / 903 / 727 / 725 |
| Sinks ÷ faucets by quarter | 76 85 85 82 80 96 91 85% | 76 85 85 82 80 96 89 88% | 76 87 88 86 84 99 94 88% | 76 87 88 86 83 97 92 89% |
| Whole run, burns included | 87% | 88% | 89% | 89% |
| Liquidations / debt written off at restarts (faucet) | 327 / 1.3M | 342 / 1.4M | 402 / 1.9M | 398 / 1.7M |
| Wave: newcomers / bought a truck (median days; within 84) / liquidated | | | 96 / 96 (26; 94) / 34 | 96 / 96 (26; 94) / 35 |

**The cycles still show.** With the dial on, booms read 1.08 and busts 0.69 as without it, and the spread barely
moves (0.24 against 0.23). The dial only acts at the edges, and slowly.

**On the standard profile the dial only works on the ceiling.** No seed's bust reaches 0.55. Seeds 1 and 4 sat over
the ceiling 80 and 75 days in year two, as the beta fleet thinned, and took in 55 and 50 entrants. Seed 8 never left
the band in two years. At five a week the entrants are too slow to hold the ceiling against the beta's attrition:
days over fell only from 10% to 8%. If Jeff wants the ceiling held, raise `entrantsPerWeek` to about 15, still
slower than the free path's opening. Otherwise call it a soft ceiling. Liquidations rose by 15 because the entrants
fail too, and nobody is bailed out.

**In the wave the dial works both ways.** The 96 newcomers pushed the ratio under the floor in the spring after
they arrived and again in year two's bust, on two seeds of three. The dial:

- read under the floor 25 days on average and over the ceiling 19;
- kept 9 bankrupt bots from restarting, wound 18 down, and let 15 in when the market thinned;
- cut days outside the band from 11% to 7% and the debt written off from 1.9M to 1.7M.

**It doesn't change the newcomers' fate.** All 96 bought a first truck, median 26 days, and about 35 went under with
or without the dial. The dial can't save them by design. It acts after a bust, on bots, five a week; their failures
come from arriving into a crowded spring and from their personas (§4).

## 4. "Prudent businessmen win": not yet, and what would have to change

**The test fails with the dial on or off.** Over two years the greedy persona beats the conservative one:

| Segment | v57-0 conservative / greedy | v57-a conservative / greedy |
|---|---|---|
| Owner-operators: mean wealth | 55k / 98k | 49k / 91k |
| Owner-operators: share liquidated | 18% / 14% | 21% / 15% |
| Fleets: mean wealth | 128k / 322k | 128k / 328k |
| Fleets: share liquidated | 9% / 9% | 9% / 8% |

In the wave, conservative newcomers went under 47–59% of the time against greedy's 14–31%. The dial decides how
many bots stand, not which ones win, so it can't change this.

**Why the conservative bot loses:**

1. **It overprices, which isn't prudence.** It asks 97% of the ceiling in sealed bids, against the greedy bot's
   break-even plus 30% stepping down to plus 6%. Price weighs 55% in the poster's score, so the conservative bot
   wins fewer loads, and its trucks sit burning idle fuel and per diem.
2. **Leverage costs almost nothing and pays.** Purchase loans run 0.2–0.4% a week, 10–20% a year. A truck returns
   3k FD a week on 50–180k, 85–300% a year. Nothing the cycle does makes the payments unaffordable: the busts
   bottom at 0.56 loads per truck, about a third under the median, and the rate stabilizer cushions them.
3. **Cash earns nothing and, after the launch, is taxed.**
   - In the beta the conservative bot parks spare FD in Equipment Finance, which lent nothing in v55-a.
   - After the launch the holding cost (2% a week on cash above a month of spending) taxes exactly the cushion a
     prudent owner keeps.
   - In a bust the cheap fire-sale trucks go to whoever buys them, and the conservative bot's hurdles (payback in 26
     weeks, 60-day lead times) keep it out.

**Options, in the order I'd take them. None is a change yet.**

- **A. Fix the persona before judging the rules (bots, not rules).** "Conservative" should mean prudent finance at
  market prices: big reserves, little leverage, buying cheap in busts. Today it asks near the ceiling. Without this
  the batch measures overpricing, not prudence. Cost: one profile in `ruleBots.ts`; no rule.
- **B. Price leverage by risk (rule, small; my recommendation if A isn't enough).**
  - Purchase-loan rates follow the borrower's leverage (debt ÷ the trucks' value) as well as its credit.
  - A covenant in a bust: below a set debt-service cover the lender raises the rate, or takes a truck at the next
    missed payment instead of the second.
  - Leverage then costs most exactly when it is most dangerous. It uses `credit.ts` and `purchaseLoans.ts` as they
    stand and touches nobody who borrows little.
- **C. Let busts bite (rule, broad).** Deeper or longer troughs, for example the demand dial to 0.6, and less
  smoothing from the rate stabilizer in a bust. It punishes the over-leveraged, but hits every carrier and the free
  path's first months; I'd test it last.
- **D. Stop taxing the cushion (rule, after the launch).** Raise the holding cost's exemption from one month of
  spending to two or three. The prudent owner's reserve then costs nothing to hold. The lock discounts, Jeff's
  other new rule, give cash a better home than the account.
- **E. Make cash a weapon in busts (bots, then perhaps rules).** Fire sales already start at 70% of value and fall
  ten points a week. A prudent bot that buys them is the real "prudent wins" story. If bots with cash still don't
  get them, fire-sale listings could go first to buyers with no open loans.

**Recommendation:** A, then a v57-style batch; B if prudence still loses; D at the launch; C only if the first three
leave the cycle toothless.

## 5. For the producer

- **To switch the dial on:** `population.dial.enabled` and `token.demandScalesWithCarriers` false, with the ruleset
  bump and a restart with no players. The band is v55-a's; re-read it if the free path or the beta's fleet cap
  changes.
- **Open choices for Jeff:** whether five entrants a week is slow enough (§3); and the prudence options (§4).
- **The wave** is a batch scenario (`population.wave`), not a rule; it stays off.
