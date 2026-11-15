# Economy: ruleset 0.25.2's four fixes, the pair (2026-11-15)

**The three fixes confirmed on ten seeds (04:48): within the spread on every line. They ride 0.25.2.**

The run is `windows.claimsInFull`, `windows.spoilAfterDeadline` and `safety.hotLoads.premiumFromArrival` on, with their
twin, against the off arm below.

| Ten seeds | Off | **The three on** |
|---|---|---|
| Gate | 10 of 10; worst carriers 85·84 | **10 of 10; worst 84·83 (seed 7); band 0.881–0.913** |
| Companies bankrupt (OO · fleet · broker) | 138.2 (73.6 · 20.6 · 21.6) | **138.7 (75.2 · 19.7 · 22.2)** |
| OO liquidated: greedy · random · prudent | .205 · .208 · .136 | **.217 · .205 · .138** |
| Owner-operators' · fleets' profit per truck-week | 1,707 · 1,598 | **1,694 · 1,615** |
| Cleared loads · rate | 412,210 · 3.631 | **411,366 · 3.628** |
| Loan defaults · trucks seized | 211 · 155 | **210 · 153** |
| FD in circulation, year 4 (M) | 84.2 | **82.8** |

`labor.truckLessHomeByHub` stays held for the bus home (the director's §9). It is paired when that lands.

The pair is on engineering's build at dae2317: the four switches on against off, on 0.25.1's live profile. It ran ten
seeds, 1,460 days, each arm with its cap-off twin, plus a two-seed split to find the cause. The fixes close the red
team's L1, L2, L4 and L7 (redteam-sprint-2026-11-15.md); this note doesn't describe the holes.

## Verdict

**Three of the four ride 0.25.2. Hold `labor.truckLessHomeByHub` until a stranded driver has a way home.**

- **Together the four fail one watched line by far.** The gate passes 10 of 10, but bankruptcies rise from 138 to 219
  a run, nearly all owner-operators (74 → 142).
- **The split puts all of it on `labor.truckLessHomeByHub`:**
  - that switch alone reproduces it (225.5 bankruptcies, 151.5 of them owner-operators, on seeds 1–2);
  - the other three together read as off (139 and 79.5, against 136.5 and 82.5).
- **The truckless rule strands drivers.** A driver taken off a truck away from home is only re-seated on an empty truck
  at that same hub (labor.ts's re-seating reads `lastHub`). A truckless driver has no Send home. So the driver waits
  there for good:
  - on per diem: 0.93M → 6.0M FD over four years, about 137 drivers stranded on an average day;
  - with every undriven day a day away: truckless clean drivers average 192 days away by year 4, outlaws' 779;
  - and with no rest: 17.7% of clean drivers are tired by year 4, against 4.3% off.
- **An owner-operator whose driver is stranded pays per diem with no truck earning, and goes under.** The prudent are
  hit hardest (liquidated .386 against .136), likely because they run the fewest trucks to re-seat on.
- **`windows.claimsInFull`, `windows.spoilAfterDeadline` and `safety.hotLoads.premiumFromArrival` move little money.**
  - Every windows claim together totals 1.17M FD over four years, against 1.06M.
  - The cargo-claim sink loses 1.18M as spoilage nearly ends.
  - The ten-seed confirmation of the three without the truckless rule is running: on, plus its twin against the off
    arm here. The result goes at the top of this note.
- **For the director: perishables almost stop spoiling.** Spoiled loads fall from 322 a run to 1.4. The spoil clock now
  starts at "Deliver by", and "Deliver by" already carries 35–168 hours of slack. If spoilage should still be a real
  risk for a slow reefer, that is a design call: for example, a shorter spoil time counted from "Deliver by", or from
  the appointment as before.

## The lines (ten-seed means; the range across seeds in brackets)

| 0.25.1's live profile | All four off | **All four on** |
|---|---|---|
| **The gate** | | |
| Seeds passing | 10 of 10 | **10 of 10** |
| Worst carriers, % of twin (Y3 · Y4) | 85 · 84 | **83 · 85** |
| Band, year 4 | 0.886–0.912 | **0.889–0.919** |
| Debt, % of FD held, year 4 | 0.1–0.2% | **0.2–0.5%** |
| **Carriers** | | |
| Owner-operators' · fleets' profit per truck-week | 1,707 · 1,598 | **1,669 · 1,596** |
| Pay per truck-week | 7,125 | **7,061** |
| Cleared loads · rate | 412,210 · 3.631 | **414,564 · 3.627** |
| **Failures** | | |
| Companies bankrupt (OO · fleet · broker) | 138 (73.6 · 20.6 · 21.6) | **219 (141.9 · 21.5 · 23.2)** |
| OO liquidated: greedy · random · prudent | .205 · .208 · .136 | **.329 · .349 · .386** |
| Fleets liquidated: greedy · random · prudent | .198 · .175 · .143 | **.205 · .155 · .177** |
| Loan defaults · trucks seized | 211 · 155 | **225 · 161** |
| In debt at the end · FD owed (M) | 157.5 · 0.15 | **109.5 · 0.29** |
| **Drivers** | | |
| Per diem (M) | 0.93 | **6.01** |
| Share of clean drivers tired, years 1–4 | 1.2 / 1.9 / 2.6 / 4.3% | **2.7 / 6.7 / 10.4 / 17.7%** |
| … of corner-cutters' | 49 / 55 / 45 / 44% | **58 / 69 / 62 / 68%** |
| … of outlaws' | 38 / 33 / 15 / 19% | **74 / 88 / 86 / 89%** |
| Truckless clean drivers' mean days away, years 1–4 | 1.6 / 0.4 / 0.4 / 0.2 | **42 / 79 / 156 / 192** |
| **Claims and spoilage** | | |
| Claims a run: late · no-show · cancel | 312 · 568 · 1,296 | **391 · 598 · 1,364** |
| Claims' FD (M): late · no-show · cancel | 0.22 · 0.44 · 0.39 | **0.29 · 0.47 · 0.41** |
| Spoiled loads · their cargo claims (M) | 322 · 1.19 | **1.4 · 0.006** |
| **FD and the free path** | | |
| FD in circulation, year 4 (M) | 84.2 | **83.9** |
| Median days to a first truck · first truck within a year | 38.0 · 354 | **39.2 · 333** |

**Claims count once each.** A capped claim now posts in two parts, and the tap counts one claim per load. The late
count rises 25% because claims in full always post: before, a broke carrier's claim was capped at zero and never
posted. It isn't more lateness.

## The split (seeds 1–2)

| Seeds 1–2 | Off | All four | **Truckless rule alone** | **The other three** |
|---|---|---|---|---|
| Companies bankrupt (OO) | 136.5 (82.5) | 229.5 (150) | **225.5 (151.5)** | **139 (79.5)** |
| Prudent · greedy owner-operators liquidated | .177 · .243 | .398 · .347 | **.417 · .373** | **.169 · .231** |
| Per diem (M) | 0.93 | 6.01 | **5.86** | **0.92** |
| Clean drivers tired, year 4 | 3.9% | 17.4% | **17.5%** | **4.2%** |
| Truckless clean drivers' days away, year 4 | 0.3 | 191 | **191** | **0.2** |
| Owner-operators' · fleets' profit per truck-week | 1,719 · 1,606 | 1,698 · 1,617 | 1,681 · 1,623 | 1,722 · 1,648 |
| Spoiled loads | 322 | 1 | 340 | 1 |

## What the truckless rule needs before it rides

**The economy's constraint:** the stranded state must end within days, at a cost about a stranded day's. The rule's
aim is that rest counts only at home. It can keep that aim if a truckless driver away from home goes home. One shape:
- **After a day off the truck away from home,** the driver travels home at a fare of about one day's per diem (30 FD),
  plus the days the trip takes (one a day per 500 miles).
- **Those days count as days away,** with no rest, as the rule intends. Arrival is home.
- **Bots take it at once.** A player gets a Send home on the truckless driver, and it happens by itself after a few
  days.

The design is the director's and engineering's. The pair repeats on the build: the same ten seeds, against this off
arm.

## How it ran

- **The worktree:** a scratch worktree at dae2317 (lanes-r0252), from gated scripts. The four arms ran 02:44–03:34
  and the split 03:40–03:47.
- **The off arm** is the live profile as it is. With the switches off, engineering's digest (995612c74cb2a3b7) and
  60-day sim are identical.
- **New taps:**
  - spoiled loads (`sink:cargo_claims` on a load);
  - claims counted once per load, and the part posted to the sink;
  - drivers' fatigue, the tired share, days away and the 14-days-out share, weekly by conduct, with the truckless
    drivers apart.

Nothing in the shared checkout changed and nothing is staged.
