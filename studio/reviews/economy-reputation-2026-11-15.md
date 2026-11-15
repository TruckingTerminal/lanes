# Economy: reputation in three parts, the sizes (2026-11-15)

**Confirmed in play (02:20): no size changes.** A scratch build of exactly this formula ran four seeds, four years, with
cap-off twins, plus the newcomer's month on 24 seeds:
- **The spread holds.** Reputation runs 0.87–1.00 between the 10th and 90th percentiles, about 5.9% of the price
  ceiling.
- **Clean against corner-cutting.** The median clean carrier reads 0.991 and the median corner-cutter 0.940, a 2.3%
  edge.
- **The gate passes 4 of 4.** The worst seed's carriers read 82% of their twin at year 3 and 85% at year 4, against 87
  and 89 for the base; the band is 0.889–0.912.
- **The newcomer's month improves:** 9,759 FD against 8,538, over 24 seeds. The newcomer starts nearer the pack than
  under today's flat reputation.

The details are at the end. The ten-seed pair follows on engineering's build.

For the director's ruling (director-reputation-2026-11-14.md): reputation reads the safety record, service failures
and experience, with its weight back to about 6% of the price ceiling. These are the sizes for the engineer building
it behind a switch. They are fitted on a scratch measurement of 0.25.1's live profile: b8e3799, four seeds, four years,
every carrier's record snapshotted each quarter. A scratch build of the formula is being probed in play now; I'll flag
any change it forces here.

## The formula

**Reputation = 1 − 0.132 × s − 0.066 × f − 0.055 × e**, where s, f and e each run from 0 (a clean part) to 1 (the part
at its worst).

- `board.scoreWeights.reputation` stays **0.25**, so each part's most is a share of the price ceiling in the bid:
  - safety: 0.132 × 0.25 = 0.033 of the score, the same as 6% of the ceiling (0.55 × 0.06);
  - service: 3%;
  - experience: 2.5%.
- Reputation runs from 0.747 (every part at its worst) to 1.00.

| Part | Its most, as a share of the ceiling | What sets it |
|---|---|---|
| **s, the safety record** | **6%** | the CSA-style record the player already sees |
| **f, service failures** | **3%** | no-shows, releases, deliveries past "Deliver by" and cargo claims, per load |
| **e, experience** | **2.5%** | loads delivered, decaying, against a cap |

### s, the safety record

**s = min(1, (m.hos + m.unsafe + m.maintenance) / 1.0 + m.crash / 3.0)**, with floors:
- `safety.rating === "conditional"`: at least 0.5;
- any open safety alert: at least 0.75;
- `"unsatisfactory"`: 1.

Here `m` is `c.safety.measures`, safety.ts `measures()` as the weekly pass leaves it:
- hos, unsafe and maintenance are time-weighted violation points per time-weighted inspection;
- crash is the time-weighted crash severity per truck, over trucks plus two.

So it reads the two-year record the engine already keeps, with its 3/2/1 time weights:
- one defect found at an inspection (4 points) costs a tenth to a third of the part, 0.6–2.2% of the ceiling,
  depending on how many clean inspections the record holds;
- a corner-cutter's typical heavy record, seven violations and 24–36 points, takes all of it;
- an at-fault crash on a one-truck company costs a third to a half of it, fading over two years. Crash points are
  at-fault only;
- a conditional rating costs half, an alert three quarters, and unsatisfactory all of it.

**It enters the bid once.** Today the safety record reaches bidding only through the vetting gate (fraud.ts
`vettingBlock`: Standard and Strict loads refuse an unsatisfactory rating or an open cargo claim, and Strict also a
conditional rating or an alert) and through insurance prices. It is in no score. The gate stays a gate, a yes or no on
vetted loads. The safety part grades carriers inside the field that may bid. Nothing else changes.

### f, service failures

**f = min(1, F / (L + 10) / 0.10)**:
- F is the carrier's failures, decayed with a **45-day half-life**: each no-show, release, delivery past
  "Deliver by" and cargo claim (fraud.ts theft) counts 1.
- L is its loads delivered, decayed the same way.
- 10 is the prior: the existing `reputation.priorLoads`, so one failure can't sink a newcomer.

**Examples:**
- Failing 10% of its loads puts a carrier at the part's worst (3% of the ceiling).
- Two releases in 90 days on about 40 loads cost about 1.2%.
- One release in a quarter on a 30-truck fleet's 300 loads costs nothing measurable.

The money side of each failure (the claims) is unchanged. This is the market's memory of it, about three months.

### e, experience

**e = 1 − min(1, X / 30)**. X is the company's loads delivered, decayed with a **90-day half-life**: each delivery adds
1, and X halves in 90 days without one.

- **The cap is 30.** A one-truck owner-operator at the median pace (23 loads a quarter) holds about 33, so a working
  carrier sits at the cap. A slower one (15 a quarter) holds about 21, so e is 0.3 and costs 0.8% of the ceiling.
- **A new company starts at e = 1**, a reputation of 0.945. That is 2.5% of the ceiling below a clean established
  carrier. After about 15 loads (one to two months for an owner-operator) it costs half that.
- Experience is per company, not per truck: a fleet reaches the cap in its first weeks.

## What it gives on the measured field (0.25.1, four seeds, quarters 4–16)

The share of the price ceiling reputation costs a carrier in the bid, among active carriers with 20 or more loads:

| | 10th pct | Median | 90th pct | Mean | Safety part (mean) | Service part | Experience part |
|---|---|---|---|---|---|---|---|
| All carriers | 0.00% | 0.90% | 5.83% | 1.68% | | | |
| Clean | 0.00% | **0.44%** | 2.49% | 0.98% | 0.33% | 0.13% | 0.52% |
| Corner-cutters | 0.02% | **2.50%** | 6.86% | 3.47% | 2.73% | 0.13% | 0.61% |
| Outlaws | 0.22% | **2.49%** | 7.03% | 3.26% | 1.67% | 0.06% | 1.53% |
| New companies (authority 120 days or less) | | | | 2.18% | | | 1.05% |

**Reading it:**
- **The spread is 5.83% of the ceiling** between the field's 10th and 90th percentiles. Before one deadline it was
  6.4%, and today it is 1.5%.
- **The clean carrier wins what the corner-cutter doesn't.** At the median, a corner-cutter has to bid about 2% of the
  ceiling lower to win the same load at the same deadhead. Its record shows the deferred maintenance: a median 7
  violation points in two years against the clean carrier's 0, and twice the crashes.
- **Outlaws** mostly run legal now (70% of their quarters, after a bad review frightens them), so their median safety
  part is 0. Their tail is the heaviest in the field.
- **Service failures are a small part on average** (0.13%), because about 0.5% of loads fail and three quarters of
  carriers have none in a quarter. They bite on the carrier that fails often, which is what the part is for.
- **The newcomer sits below the pack by about 2.2%,** close to today's gap (about 2.3%). The 24-seed probe found that
  gap leaves the newcomer's month unchanged.

## For the build

- **Switch.** Engineering's name, for example `reputation.threePart`. Off: today's on-time formula, byte for byte.
- **Where it's computed.** Whenever a part moves, and weekly after the safety pass (weeklySafety, after
  `s.measures`), so the decay shows in bids:
  - at a delivery (trips.ts `deliver`, where reputation is set now);
  - at a failure (windows.ts `markFailed`, fraud.ts's theft);
  - at a late delivery past "Deliver by", inside `deliver`.

  The decayed counters can be kept as `{ day, x, l, f }` on the Company and aged on read (value × 2^(−Δdays/half-life)).
- **The season close** (season.ts `reputationDecay`) no longer touches reputation's parts, which age on their own. It
  keeps scaling `delivered`, `onTime` and `late` for Miles' level (`reputationFactor`) as now.
- **A new company** starts at 1 − 0.055 = 0.945.
- **A bankruptcy's fresh start** (solvency.ts) restarts experience and service. The safety record follows the company,
  as the old revocation already does.
- **The other readers:**
  - contracts.ts (the standing: reputation × tender acceptance) reads the new figure;
  - Miles' level reads `delivered`, unchanged;
  - the explain and copy (`standing.reputation`) need the three parts' words, for the writer.
- **The director's display:** "Reputation 0.91: safety record clean · 2 releases in 90 days · 46 loads delivered".
  - Safety: "clean" when s = 0. Otherwise the record's violations and crashes in figures, with the rating when it isn't
    satisfactory.
  - Service: the failures' counts in the last 90 days.
  - Experience: X, rounded.
- **Tests:**
  1. Switch off, the digest is unchanged.
  2. A defect at an inspection lowers s; an alert floors it at 0.75; unsatisfactory sets it to 1.
  3. Two releases in 90 days on 40 loads give f ≈ 0.4; the same releases on 300 loads give under 0.07.
  4. A new company reads 0.945; after 30 loads in a month, 1.00 with a clean record; after 90 idle days, X halves.
  5. The bid score's reputation term spans at most 0.0633 of the score (0.25 × 0.253).

## The scratch probe in play (added 02:20)

The scratch build is in a scratch worktree at b8e3799 (lanes-g21). It is exactly the formula above:
- computed at each delivery and failure, and weekly after the safety pass;
- new companies start at 0.945;
- a bankruptcy restarts experience and service.

It ran four seeds, 1,460 days, with twins. The base is 0.25.1's live profile.

| Four seeds | 0.25.1 today | **Three parts** |
|---|---|---|
| Reputation p10 / p50 / p90, end of years 1–4 | 0.963/0.983/0.993 · 0.968/0.988/0.996 · 0.960/0.986/0.996 · 0.955/0.980/0.996 | **0.869/0.996/1.000 · 0.873/0.985/1.000 · 0.868/0.973/1.000 · 0.867/0.953/1.000** |
| Median reputation: clean · corner-cutter · outlaw (quarters 4–16) | 0.988 · 0.987 · 0.975 | **0.991 · 0.940 · 0.945** |
| New companies (authority 120 days or less), mean | 0.936 | **0.951** |
| Gate | 4 of 4; worst carriers 87·84 | **4 of 4; worst 82·85** |
| Owner-operators' · fleets' profit per truck-week | 1,705 · 1,633 | **1,673 · 1,581** |
| Cleared loads · rate | 411,983 · 3.634 | **411,270 · 3.618** |
| Bankruptcies · loan defaults | 136 · 202 | **135 · 213** |
| Newcomer's month, 24 seeds (mean · median) | 8,538 · 7,027 FD on 9.4 loads | **9,759 · 9,014 FD on 9.8 loads** |

**Reading it:**
- **The median slides across the years** (0.996 to 0.953) for two reasons, both the parts working. The year-4 downturn
  thins every carrier's loads (36 to 30 a quarter), which trims experience. And cash-short corner-cutters defer more
  maintenance, so their median safety part rises from 0.21 to 0.58.
- **The corner-cutters keep their volume by bidding lower.** The bots' win-rate band lowers a carrier's pricing when it
  loses bids, so reputation lands as price, not volume:
  - fleet corner-cutters lose share (0.087 to 0.074);
  - owner-operator corner-cutters hold theirs (0.115 to 0.124, within four seeds' noise);
  - the cleared rate falls 0.4% as the marked-down carriers bid lower.
- **Carriers' profit dips 2–3%,** inside four seeds' range. This is the reverse of the +1.4% that one deadline's flat
  reputation gave: a spread makes carriers compete on price again.
- **The ten-seed pair** will read profit per load by conduct directly; the runner gains that tap. It also reads the
  carriers' floor on ten seeds.
