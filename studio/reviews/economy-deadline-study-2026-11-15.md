# Economy: when "Deliver by" binds, a study for the director's §10 (2026-11-15)

**The director's question:** at 99.9% on time, "Deliver by" almost never binds once a load is booked. What would the
commodities' delivery hours (`windowHours`) need to be for a normal carrier to be late on a few loads in a hundred, and
what would it cost the gate?

**The study:**
- 0.25.2's live profile (the three fixes on) at dae2317, seeds 1–2, four years.
- Every commodity's `windowHours` scaled in memory: 1, ½, ¼ and 0.
- A tap of each delivered load's hours to spare at the receiver ("Deliver by" less the arrival).
- Study only. Nothing moves before the director decides.

## The answer

**`windowHours` alone can't get there at a fair price.** The slack isn't mostly in `windowHours`.

- **"Deliver by" is built from four parts:** the ready time, plus the pickup window (24 h for an appointment, 48 h
  first come), plus the legal transit, plus `windowHours` (24–120 h).
- **A carrier that picks up early keeps the pickup window as slack.** Bots book 80% of their loads ahead and pick up
  near the ready time, so even at `windowHours` 0 a load arrives with 22 hours to spare on average.
- **What each scale gives:**
  - a quarter of today's hours: about 1 load in 100 late;
  - zero: about 2 in 100, at a steep cost.

| Seeds 1–2 | Today (×1) | ×½ | ×¼ | **×0** |
|---|---|---|---|---|
| Delivered late (past "Deliver by") | 0.09% | 0.36% | 0.92% | **2.25%** |
| … within 6 h of it, or late | 0.42% | 1.7% | 4.9% | 12.5% |
| … within 24 h, or late | 2.9% | 12% | 28% | 61% |
| Mean hours to spare at the receiver | 99 | 57 | 38 | **22** |
| Late claims a run · their FD (M) | 366 · 0.28 | 1,442 · 1.08 | 3,696 · 2.67 | **8,787 · 6.12** |
| Spoiled loads (24–48 h past "Deliver by") | 1 | 4 | 16 | 24 |
| Reputation p10 / p50 / p90 (on-time based, today's formula) | 0.955/0.980/0.996 | 0.952/0.977/0.994 | 0.939/0.971/0.991 | 0.915/0.957/0.985 |
| Owner-operators' · fleets' profit per truck-week | 1,722 · 1,648 | 1,713 · 1,619 | 1,692 · 1,601 | **1,614 · 1,515** |
| Companies bankrupt (OO) | 139 (79.5) | 130.5 (71) | 141.5 (82.5) | **166.5 (109.5)** |
| Cleared loads · share of postings lost | 410,942 · 53.3% | 409,668 · 53.4% | 408,209 · 54.0% | **394,959 · 56.4%** |
| FD in circulation, year 4 (M) | 82.2 | 83.6 | 80.4 | 73.9 |

**Reading it:**
- **At ×¼, about one load in a hundred is late,** and the deadline starts to show:
  - claims grow tenfold to 2.7M;
  - reputation widens a little;
  - carriers lose 2–3% of profit;
  - bankruptcies and cleared loads stay within two seeds' noise.
- **At ×0, two in a hundred are late, but the cost is steep:**
  - owner-operator bankruptcies +38%;
  - carriers' profit −6 to −8%;
  - cleared loads −4%;
  - FD in circulation −10%.
  
  The deadline then binds the booking too: fewer loads can be made, so more are lost (56% of postings).
- **By commodity at ×0,** late runs 0.7–3.6%. The short-window freight (parcels, auto parts, produce) is near the top.
- **What it would cost the gate** can't be read on two seeds: the carriers' floor needs twins. The direction is clear:
  ×¼ is mild, ×0 is a large cost. A chosen scale gets the ten-seed gate.

## The structural option: count "Deliver by" from the ready time (probed: costlier, not cheaper)

**The idea.** The slack that never binds is the pickup window, which every deadline adds even for the carrier that
picks up at once. Counting "Deliver by" from the ready time, instead of from the pickup's close, leaves a carrier that
picks up late less time. That is the "tight bookings" the director names.

A scratch build of it ran at dae2317: `windowHours` ×1, ×½ and ×¼, two seeds, against the scaled windows above.

| Seeds 1–2 | Today | ×¼ | ×0 | **From ready, ×1** | **From ready, ×½** | **From ready, ×¼** |
|---|---|---|---|---|---|---|
| Delivered late | 0.09% | 0.92% | 2.25% | **0.48%** | **1.74%** | **3.32%** |
| Mean hours to spare | 99 | 38 | 22 | 63 | 27 | 14 |
| Late claims · FD (M) | 366 · 0.28 | 3,696 · 2.67 | 8,787 · 6.12 | 1,958 · 1.40 | 6,695 · 4.71 | 11,506 · 7.74 |
| Owner-operators' · fleets' profit per truck-week | 1,722 · 1,648 | 1,692 · 1,601 | 1,614 · 1,515 | 1,670 · 1,631 | 1,556 · 1,486 | 1,392 · 1,384 |
| Companies bankrupt (OO) | 139 (79.5) | 141.5 (82.5) | 166.5 (109.5) | 151 (88.5) | 169 (95.5) | 226 (137.5) |
| Cleared loads · share of postings lost | 410,942 · 53.3% | 408,209 · 54.0% | 394,959 · 56.4% | 411,140 · 53.4% | 388,050 · 56.3% | 350,135 · 62.1% |
| Reputation p10 / p50 (today's formula) | 0.955 / 0.980 | 0.939 / 0.971 | 0.915 / 0.957 | 0.950 / 0.976 | 0.926 / 0.962 | 0.898 / 0.948 |
| FD in circulation, year 4 (M) | 82.2 | 80.4 | 73.9 | 81.8 | 73.2 | 61.3 |

**It is costlier per point of lateness, not cheaper:**
- From the ready time at ×1, 0.48% late costs owner-operators 3% and adds 12 bankruptcies.
- Scaling to ×¼ gets 0.92% for 1.7%.
- From the ready time at ×½, 1.74% late costs about 10% and 30 bankruptcies; ×0 gets 2.25% for 6–8%.

**Why it's costlier:** the bots never book what they can't make (`canMake`). A deadline that bites the late pickup
mostly takes loads away from them, so more postings are lost and fewer cleared. It doesn't make them late. Lateness
comes only from what happens after booking (breakdowns, docks, fatigue), and that is small against any slack the board
can live with.

## For the director

- **The economy's answer: ×¼ is the best buy.**
  - A quarter of today's `windowHours`, with the deadline counted as now, makes about 1 load in 100 late.
  - It costs carriers 2–3% of profit, with bankruptcies and cleared loads inside two seeds' noise.
  - "A few in a hundred" (2–3%) costs 6–8% of carriers' profit at ×0, and more by any other route, on top of the 19%
    windows already cost. I don't recommend it.
- **The teeth are better found after booking than in the deadline,** where a normal carrier's lateness really comes
  from. The reefer unit (§10's later part) is that kind of risk; breakdowns and dock waits are the others. They make a
  careful carrier late sometimes, without taking loads off the board.
- **If ×¼ is chosen,** its ten-seed gate with twins comes first, since the carriers' floor can't be read on two seeds.
- **Whichever is chosen:**
  - reputation's three parts (economy-reputation-2026-11-15.md) already carry "deliveries past Deliver by" as a
    service failure, so lateness would move it;
  - spoilage stays near zero until the reefer-unit rule (§10's later part), since the spoil hours count 24–48 h past
    the deadline;
  - the logbook milestone (L3) gets its teeth back with any deadline that binds.
