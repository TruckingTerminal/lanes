# Economy: reputation in three parts, the pair (2026-11-15)

The pair is on engineering's build at 111ac43 (8cf173e; engineering-bus-home-2026-11-15.md §9): `reputation.threeParts`
on against off, on 0.25.3's profile (the seven 0.25.3 switches on under both arms). It ran ten seeds, 1,460 days, each
arm with its cap-off twin. The red team's L3 (`token.airdrop.logbook.serviceMilestones`) was read apart on seeds 1–2.

## Verdict

**Within the spread on every line. It can ride. L3 can ride beside it; it moves the airdrop by a hair.**

- **The gate passes 10 of 10.** The worst carriers read 83·83 (seed 7), against 81·84 off; the band is 0.878–0.912.
- **Every gate line is inside the spread:**
  - bankruptcies 137.4 against 138.4;
  - owner-operators' profit per truck-week 1,704 against 1,691, fleets' 1,636 against 1,650;
  - cleared loads −1.0%, the rate the same;
  - defaults and seizures a little lower.
- **Reputation separates carriers as sized:**
  - The field's 10th to 90th percentile is 0.87–1.00, about 6% of the price ceiling. Today it is 0.96–1.00, about
    1.5%.
  - The median clean carrier reads 0.987, the median corner-cutter 0.939 and outlaws 0.945: a 2.2% edge in a bid.
  - Newcomers average 0.929 in their first 120 days.
- **The clean carrier wins what the corner-cutter doesn't:**
  - clean owner-operators' share of loads rises from 0.446 to 0.462;
  - corner-cutting owner-operators' falls from 0.126 to 0.122, and corner-cutting fleets' from 0.081 to 0.076.
  
  Pay per load barely moves (corner-cutters 2,669 against clean 2,634 FD), so on ten seeds the edge lands in which
  loads they win, not in their price.
- **L3, the logbook's service milestones,** on seeds 1–2 with reputation on:
  - honest logbook payouts are 7.90M against 7.92M;
  - clean-quarter milestones 592 against 600;
  - the on-time milestone count is unchanged (309);
  - recipients and FD minted are the same.
  
  Under one deadline the on-time share and the service-failure share pick out nearly the same carriers, because
  failures are rare (about 0.5% of loads). L3 is a correctness fix more than a money change.
- **The newcomer's month holds** (the test page's world at Dallas, 24 seeds, the seven 0.25.3 switches in both arms):
  - mean 7,526 FD on 7.4 loads against 7,999 on 7.7 (t −0.33);
  - median 7,845 against 7,566;
  - higher on 10 of 24 seeds.
  
  The newcomer ends its month at 0.955 against a pack at 0.991, and wins its loads by price, as the director expected.

## The lines (ten-seed means; the range across seeds in brackets)

| 0.25.3's profile | Reputation as today | **Three parts** |
|---|---|---|
| **The gate** | | |
| Seeds passing · worst carriers · band | 10 of 10 · 81·84 · 0.881–0.922 | **10 of 10 · 83·83 · 0.878–0.912** |
| **Carriers** | | |
| Owner-operators' · fleets' profit per truck-week | 1,691 · 1,650 | **1,704 · 1,636** |
| Pay per truck-week | 7,163 | **7,159** |
| Cleared loads · rate | 415,946 · 3.632 | **411,680 · 3.630** |
| **Failures** | | |
| Companies bankrupt (OO · fleet · broker) | 138.4 (77.4 · 19.8 · 21.4) | **137.4 (72.9 · 20.9 · 21.4)** |
| OO liquidated: greedy · random · prudent | .213 · .227 · .139 | **.201 · .199 · .139** |
| Fleets liquidated: greedy · random · prudent | .170 · .147 · .177 | **.205 · .155 · .163** |
| Loan defaults · trucks seized | 204 · 154 | **199 · 144** |
| Claims a run: late · no-show · cancel | 370 · 173 · 1,735 | **358 · 168 · 1,710** |
| **Reputation** | | |
| Reputation p10 / p50 / p90, end of years 1–4 | 0.963/0.983/0.993 · 0.967/0.988/0.996 · 0.959/0.986/0.996 · 0.955/0.980/0.996 | **0.867/0.991/1.000 · 0.870/0.981/1.000 · 0.869/0.967/0.999 · 0.863/0.952/0.999** |
| Median reputation: clean · corner-cutter · outlaw · newcomers | 0.988 · 0.987 · 0.974 · 0.936 | **0.987 · 0.939 · 0.945 · 0.929** |
| Share of loads: OO clean · OO corner-cutter · fleet clean · fleet corner-cutter | .446 · .126 · .280 · .081 | **.462 · .122 · .274 · .076** |
| Pay · net per load, years 2–4: OO clean · OO corner-cutter | 2,638/1,355 · 2,665/1,303 | **2,634/1,351 · 2,669/1,316** |
| **FD and the free path** | | |
| FD in circulation, year 4 (M) | 83.2 | **84.4** |
| Median days to a first truck · first truck within a year | 38.0 · 350 | **36.4 · 357** |

**The scratch probe's −2 to −3% on carriers' profit doesn't hold on ten seeds** (+0.8% and −0.8%). It was four seeds'
noise.

## How it ran

- **The worktree:** a scratch worktree at 111ac43 (lanes-rep), from the gated pair script with pauses between waves,
  09:20–10:15. The L3 arm ran 10:17–10:24.
- **The base under both arms:** `standing.enabled`, `labor.busHome.enabled`, `labor.truckLessHomeByHub`,
  `windows.releaseCurrent`, `labor.dueHomePlan.enabled`, `assets.handOverAtTruck` and `labor.coDriversCount`, as live
  0.25.3.
- **On:** `reputation.threeParts.enabled`. **L3:** the same plus `token.airdrop.logbook.serviceMilestones`.

Nothing in the shared checkout changed and nothing is staged.
